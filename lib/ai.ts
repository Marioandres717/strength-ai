import Anthropic, {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import {
  ADAPTATION_PROMPT,
  PLAN_GENERATION_PROMPT,
  SWAP_PROMPT,
  buildAdaptationUserMessage,
  buildPlanUserMessage,
  buildSwapUserMessage,
} from "./prompts"

// ── Model ──────────────────────────────────────────────────────────────────────
const MODEL = "claude-sonnet-4-6" as const

// ── Error types ────────────────────────────────────────────────────────────────
export type AIErrorCode =
  | "MISSING_API_KEY"
  | "VALIDATION_ERROR"
  | "EXERCISE_NAME_MISMATCH"
  | "API_ERROR"
  | "RATE_LIMITED"

export class AICallError extends Error {
  readonly code: AIErrorCode

  constructor(code: AIErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = "AICallError"
    this.code = code
    this.cause = cause
  }
}

// ── Client singleton ───────────────────────────────────────────────────────────
let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new AICallError(
        "MISSING_API_KEY",
        "ANTHROPIC_API_KEY environment variable is not set"
      )
    }
    _client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }
  return _client
}

// ── Input types ────────────────────────────────────────────────────────────────
// Input types are plain TS interfaces — they come from our own DB, not from AI,
// so runtime validation via Zod is not needed here.

export interface ExerciseLibraryEntry {
  id: string
  name: string
  movement: "squat" | "hinge" | "push" | "pull" | "carry" | "isolation"
  primaryMuscles: string[]
  equipment: string[]
}

export interface PlanGenerationInput {
  goal: "strength" | "hypertrophy" | "both" | "recomp" | "fat_loss"
  experience: "beginner" | "intermediate" | "advanced"
  equipment: string[]
  sessionsPerWeek: number
  sessionLengthMin: number
  customDirectives?: string
  exerciseLibrary: ExerciseLibraryEntry[]
}

export interface PlannedExerciseSummary {
  exerciseName: string
  sets: number
  repRange: string
  loadKg: number
  rirTarget: number
  restSeconds: number
}

export interface SessionPlanSummary {
  dayLabel: string
  focus: "strength" | "hypertrophy" | "mixed"
  exercises: PlannedExerciseSummary[]
}

export interface SetLogSummary {
  exerciseName: string
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number | null
}

export interface SessionLogSummary {
  dayLabel: string
  focus: "strength" | "hypertrophy" | "mixed"
  fatigueRating: number | null
  notes: string | null
  sets: SetLogSummary[]
}

export interface AdaptationInput {
  weekNumber: number
  sessions: SessionPlanSummary[]
  logs: SessionLogSummary[]
  exerciseLibrary: ExerciseLibraryEntry[]
}

export interface SwapInput {
  exerciseToReplace: ExerciseLibraryEntry
  sessionContext: PlannedExerciseSummary[]
  availableEquipment: string[]
  exerciseLibrary: ExerciseLibraryEntry[]
}

// ── Output Zod schemas ─────────────────────────────────────────────────────────
// These validate AI responses at runtime. Types are inferred — not written by hand.
// Schemas and types must always evolve together, so they live in the same file.

const FocusSchema = z.enum(["strength", "hypertrophy", "mixed"])

const PlannedExerciseOutputSchema = z.object({
  exerciseName: z.string(),
  orderIndex: z.number().int().min(0),
  sets: z.number().int().min(1).max(10),
  repRange: z.string(),
  loadKg: z.number().min(0),
  rirTarget: z.number().int().min(0).max(5),
  restSeconds: z.number().int().min(30).max(600),
  coachNote: z.string(),
})

const SessionOutputSchema = z.object({
  dayLabel: z.string(),
  focus: FocusSchema,
  exercises: z.array(PlannedExerciseOutputSchema),
})

const WeekOutputSchema = z.object({
  weekNumber: z.number().int().min(1).max(4),
  sessions: z.array(SessionOutputSchema),
})

export const PlanGenerationSchema = z.object({
  program: z.object({
    name: z.string(),
    weeksTotal: z.literal(4),
    sessionsPerWeek: z.number().int().min(1).max(7),
    aiRationale: z.string(),
  }),
  weeks: z.array(WeekOutputSchema).min(4).max(4),
})

export const AdaptationSchema = z.object({
  changes: z.array(
    z.object({
      sessionDayLabel: z.string(),
      exerciseName: z.string(),
      field: z.enum([
        "sets",
        "repRange",
        "loadKg",
        "rirTarget",
        "restSeconds",
        "exerciseSwap",
      ]),
      oldValue: z.union([z.string(), z.number()]),
      newValue: z.union([z.string(), z.number()]),
      reason: z.string(),
    })
  ),
  reasoning: z.string(),
})

export const SwapSchema = z.object({
  candidates: z
    .array(
      z.object({
        exerciseName: z.string(),
        rank: z.number().int().min(1).max(3),
        reason: z.string(),
      })
    )
    .min(1)
    .max(3),
  reasoning: z.string(),
})

export type PlanGenerationOutput = z.infer<typeof PlanGenerationSchema>
export type AdaptationOutput = z.infer<typeof AdaptationSchema>
export type SwapOutput = z.infer<typeof SwapSchema>

// ── Logging ────────────────────────────────────────────────────────────────────

function logSuccess(fnName: string, latencyMs: number, summary: string): void {
  console.warn(`[AI] ${fnName} completed in ${latencyMs}ms | ${summary}`)
}

function logFailure(fnName: string, latencyMs: number, error: string): void {
  console.error(`[AI] ${fnName} failed in ${latencyMs}ms | ${error}`)
}

// ── SDK error wrapping ─────────────────────────────────────────────────────────

function wrapSDKError(err: unknown, fnName: string): AICallError {
  if (err instanceof RateLimitError) {
    return new AICallError(
      "RATE_LIMITED",
      `${fnName}: rate limit exceeded`,
      err
    )
  }
  if (err instanceof AuthenticationError) {
    return new AICallError(
      "MISSING_API_KEY",
      `${fnName}: authentication failed — check ANTHROPIC_API_KEY`,
      err
    )
  }
  if (err instanceof APIError) {
    const msg = err.message ?? ""
    if (
      msg.includes("Failed to parse structured output") ||
      msg.includes("Validation issues")
    ) {
      return new AICallError(
        "VALIDATION_ERROR",
        `${fnName}: AI response failed schema validation — ${msg}`,
        err
      )
    }
    return new AICallError(
      "API_ERROR",
      `${fnName}: API error (status ${err.status}) — ${msg}`,
      err
    )
  }
  return new AICallError(
    "API_ERROR",
    `${fnName}: unexpected error — ${String(err)}`,
    err
  )
}

// ── Exercise name resolution ───────────────────────────────────────────────────
// Pure function — no DB access. Applied after every generatePlan and swapExercise
// call to ensure AI-returned names map to canonical library names.

function buildNameIndex(
  library: ExerciseLibraryEntry[]
): Map<string, ExerciseLibraryEntry> {
  return new Map(library.map((e) => [e.name.toLowerCase().trim(), e]))
}

function normalizeTokens(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .sort()
    .join(" ")
}

function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const ba = bigrams(a)
  const bb = bigrams(b)
  let intersection = 0
  for (const bg of ba) {
    if (bb.has(bg)) intersection++
  }
  return (2 * intersection) / (ba.size + bb.size)
}

// Exported for unit testing.
export function resolveExerciseName(
  aiName: string,
  library: ExerciseLibraryEntry[],
  index: Map<string, ExerciseLibraryEntry>
): string {
  // Tier 1: exact case-insensitive match
  const t1 = index.get(aiName.toLowerCase().trim())
  if (t1) return t1.name

  // Tier 2: normalized token match (sort tokens, strip punctuation)
  const normalizedAi = normalizeTokens(aiName)
  const t2 = library.find((e) => normalizeTokens(e.name) === normalizedAi)
  if (t2) return t2.name

  // Tier 3: best Dice coefficient similarity ≥ 0.6
  let bestScore = 0
  let bestEntry: ExerciseLibraryEntry | null = null
  for (const entry of library) {
    const score = diceSimilarity(normalizedAi, normalizeTokens(entry.name))
    if (score > bestScore) {
      bestScore = score
      bestEntry = entry
    }
  }
  if (bestScore >= 0.6 && bestEntry !== null) {
    console.warn(
      `[AI] Exercise name fuzzy-matched: "${aiName}" → "${bestEntry.name}" (score: ${bestScore.toFixed(2)})`
    )
    return bestEntry.name
  }

  throw new AICallError(
    "EXERCISE_NAME_MISMATCH",
    `AI returned exercise name "${aiName}" that does not match any entry in the exercise library`
  )
}

function resolveNamesInPlan(
  output: PlanGenerationOutput,
  library: ExerciseLibraryEntry[]
): PlanGenerationOutput {
  const index = buildNameIndex(library)
  return {
    ...output,
    weeks: output.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) => ({
        ...session,
        exercises: session.exercises.map((ex) => ({
          ...ex,
          exerciseName: resolveExerciseName(ex.exerciseName, library, index),
        })),
      })),
    })),
  }
}

function resolveNamesInSwap(
  output: SwapOutput,
  library: ExerciseLibraryEntry[]
): SwapOutput {
  const index = buildNameIndex(library)
  return {
    ...output,
    candidates: output.candidates.map((c) => ({
      ...c,
      exerciseName: resolveExerciseName(c.exerciseName, library, index),
    })),
  }
}

// ── Exported functions ─────────────────────────────────────────────────────────
// All Anthropic SDK calls go through these three functions only.
// Never import or call the Anthropic SDK directly from routes or server functions.

export async function generatePlan(
  input: PlanGenerationInput
): Promise<PlanGenerationOutput> {
  const client = getClient()
  const start = Date.now()
  const summary = `goal=${input.goal} exp=${input.experience} sessions=${input.sessionsPerWeek} exercises=${input.exerciseLibrary.length}`

  try {
    const message = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 16000,
        temperature: 0,
        system: PLAN_GENERATION_PROMPT,
        messages: [{ role: "user", content: buildPlanUserMessage(input) }],
        output_config: { format: zodOutputFormat(PlanGenerationSchema) },
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } }
    )

    if (!message.parsed_output) {
      throw new AICallError(
        "VALIDATION_ERROR",
        "generatePlan: parsed_output was null"
      )
    }

    const resolved = resolveNamesInPlan(
      message.parsed_output,
      input.exerciseLibrary
    )
    logSuccess("generatePlan", Date.now() - start, summary)
    return resolved
  } catch (err) {
    if (err instanceof AICallError) {
      logFailure("generatePlan", Date.now() - start, err.message)
      throw err
    }
    const wrapped = wrapSDKError(err, "generatePlan")
    logFailure("generatePlan", Date.now() - start, wrapped.message)
    throw wrapped
  }
}

export async function adaptWeek(
  input: AdaptationInput
): Promise<AdaptationOutput> {
  const client = getClient()
  const start = Date.now()
  const summary = `week=${input.weekNumber} sessions=${input.sessions.length} logs=${input.logs.length}`

  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: ADAPTATION_PROMPT,
      messages: [{ role: "user", content: buildAdaptationUserMessage(input) }],
      output_config: { format: zodOutputFormat(AdaptationSchema) },
    })

    if (!message.parsed_output) {
      throw new AICallError(
        "VALIDATION_ERROR",
        "adaptWeek: parsed_output was null"
      )
    }

    logSuccess("adaptWeek", Date.now() - start, summary)
    return message.parsed_output
  } catch (err) {
    if (err instanceof AICallError) {
      logFailure("adaptWeek", Date.now() - start, err.message)
      throw err
    }
    const wrapped = wrapSDKError(err, "adaptWeek")
    logFailure("adaptWeek", Date.now() - start, wrapped.message)
    throw wrapped
  }
}

export async function swapExercise(input: SwapInput): Promise<SwapOutput> {
  const client = getClient()
  const start = Date.now()
  const summary = `replacing="${input.exerciseToReplace.name}" equipment=${input.availableEquipment.length}`

  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      system: SWAP_PROMPT,
      messages: [{ role: "user", content: buildSwapUserMessage(input) }],
      output_config: { format: zodOutputFormat(SwapSchema) },
    })

    if (!message.parsed_output) {
      throw new AICallError(
        "VALIDATION_ERROR",
        "swapExercise: parsed_output was null"
      )
    }

    const resolved = resolveNamesInSwap(
      message.parsed_output,
      input.exerciseLibrary
    )
    logSuccess("swapExercise", Date.now() - start, summary)
    return resolved
  } catch (err) {
    if (err instanceof AICallError) {
      logFailure("swapExercise", Date.now() - start, err.message)
      throw err
    }
    const wrapped = wrapSDKError(err, "swapExercise")
    logFailure("swapExercise", Date.now() - start, wrapped.message)
    throw wrapped
  }
}
