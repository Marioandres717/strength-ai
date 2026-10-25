import type {
  GenerateOnDemandWorkoutInput,
  OnDemandWorkoutGenerationContext,
} from "../src/types/on-demand-workout"
import { constraintsSchema } from "../src/types/on-demand-workout"
import {
  ON_DEMAND_WORKOUT_GENERATION_PROMPT,
  buildOnDemandWorkoutUserMessage,
} from "./prompts"
import Anthropic, {
  APIError as AnthropicAPIError,
  AuthenticationError as AnthropicAuthenticationError,
  RateLimitError as AnthropicRateLimitError,
} from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import OpenAI, {
  APIError as OpenAIAPIError,
  AuthenticationError as OpenAIAuthenticationError,
  RateLimitError as OpenAIRateLimitError,
} from "openai"
import { zodTextFormat } from "openai/helpers/zod"
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
const ANTHROPIC_MODEL = "claude-sonnet-4-6" as const
const OPENAI_MODEL = "gpt-4o-mini" as const

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
  console.warn(
    `[AI] ${fnName} ${providerLabel()} completed in ${latencyMs}ms | ${summary}`
  )
}

function logFailure(fnName: string, latencyMs: number, error: string): void {
  console.error(
    `[AI] ${fnName} ${providerLabel()} failed in ${latencyMs}ms | ${error}`
  )
}

// ── SDK error wrapping ─────────────────────────────────────────────────────────

export type AIProviderName = "anthropic" | "openai" | "ollama"

interface StructuredGenerationRequest<T> {
  systemPrompt: string
  userPrompt: string
  schemaName: string
  schema: z.ZodType<T>
  maxOutputTokens: number
  model?: string
  maxRetries?: number
  timeout?: number
}

interface AIProvider {
  generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T>
}

export function resolveAIProvider(
  value = process.env.AI_PROVIDER
): AIProviderName {
  if (!value || value === "anthropic") return "anthropic"
  if (value === "openai" || value === "ollama") return value

  throw new AICallError(
    "API_ERROR",
    `Unsupported AI_PROVIDER "${value}". Use "anthropic", "openai", or "ollama".`
  )
}

export function ollamaConfiguration(): {
  baseUrl: string
  model: string
  timeout: number
  numCtx: number
} {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
  const model = process.env.OLLAMA_MODEL ?? "qwen3:14b"
  const positiveInteger = (name: string, fallback: number): number => {
    const value = Number(process.env[name] ?? fallback)
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
      throw new AICallError(
        "API_ERROR",
        `${name} must be a positive integer no greater than 2147483647`
      )
    }
    return value
  }
  try {
    const url = new URL(baseUrl)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid URL")
  } catch {
    throw new AICallError(
      "API_ERROR",
      "OLLAMA_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment"
    )
  }
  if (!model.trim())
    throw new AICallError("API_ERROR", "OLLAMA_MODEL must not be empty")
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    timeout: positiveInteger("OLLAMA_TIMEOUT_MS", 300000),
    numCtx: positiveInteger("OLLAMA_NUM_CTX", 32768),
  }
}

export function validateAIConfiguration(): void {
  const name = resolveAIProvider()
  if (name === "ollama") {
    ollamaConfiguration()
    return
  }
  const keyName = name === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"
  const key = process.env[keyName]?.trim()
  if (!key || key === "your_api_key_here")
    throw new AICallError(
      "MISSING_API_KEY",
      `Configure ${keyName} before generating.`
    )
}

function providerLabel(): string {
  const name = resolveAIProvider()
  const model =
    name === "ollama"
      ? ollamaConfiguration().model
      : name === "openai"
        ? (process.env.OPENAI_MODEL ?? OPENAI_MODEL)
        : (process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL)
  return `provider=${name} model=${model}`
}

class OllamaProvider implements AIProvider {
  async generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const config = ollamaConfiguration()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeout)
    try {
      const response = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          stream: false,
          think: false,
          format: z.toJSONSchema(request.schema),
          options: {
            temperature: 0,
            num_predict: request.maxOutputTokens,
            num_ctx: config.numCtx,
          },
        }),
      })
      if (!response.ok)
        throw new AICallError(
          "API_ERROR",
          response.status === 404
            ? `Ollama model ${config.model} is unavailable. Run ollama pull ${config.model} and check OLLAMA_BASE_URL.`
            : `Ollama request failed (HTTP ${response.status}). Check the Ollama server.`
        )
      try {
        const envelope = z
          .object({
            done: z.literal(true),
            done_reason: z.string().optional(),
            message: z.object({ content: z.string().min(1) }),
          })
          .parse(await response.json())
        if (envelope.done_reason === "length")
          throw new Error("Truncated output")
        return request.schema.parse(JSON.parse(envelope.message.content))
      } catch (error) {
        if (controller.signal.aborted) throw error
        throw new AICallError(
          "VALIDATION_ERROR",
          "Ollama returned incomplete or invalid structured output",
          error
        )
      }
    } catch (error) {
      if (error instanceof AICallError) throw error
      throw new AICallError(
        "API_ERROR",
        controller.signal.aborted
          ? `Ollama exceeded the ${config.timeout}ms deadline. Adjust OLLAMA_TIMEOUT_MS or use a smaller model.`
          : "Cannot reach Ollama. Start Ollama and check OLLAMA_BASE_URL.",
        error
      )
    } finally {
      clearTimeout(timer)
    }
  }
}

class AnthropicProvider implements AIProvider {
  private client: Anthropic | null = null

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new AICallError(
          "MISSING_API_KEY",
          "ANTHROPIC_API_KEY environment variable is not set"
        )
      }
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    }
    return this.client
  }

  async generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const response = await this.getClient().messages.parse(
      {
        model: request.model ?? process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
        max_tokens: request.maxOutputTokens,
        temperature: 0,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
        output_config: { format: zodOutputFormat(request.schema) },
      },
      { maxRetries: request.maxRetries, timeout: request.timeout }
    )

    if (!response.parsed_output) {
      throw new AICallError(
        "VALIDATION_ERROR",
        "Anthropic returned no parsed structured output"
      )
    }
    return request.schema.parse(response.parsed_output)
  }
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI | null = null

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new AICallError(
          "MISSING_API_KEY",
          "OPENAI_API_KEY environment variable is not set"
        )
      }
      this.client = new OpenAI({ apiKey })
    }
    return this.client
  }

  async generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const response = await this.getClient().responses.parse(
      {
        model: request.model ?? process.env.OPENAI_MODEL ?? OPENAI_MODEL,
        instructions: request.systemPrompt,
        input: request.userPrompt,
        max_output_tokens: request.maxOutputTokens,
        temperature: 0,
        store: false,
        text: { format: zodTextFormat(request.schema, request.schemaName) },
      },
      { maxRetries: request.maxRetries, timeout: request.timeout }
    )

    if (!response.output_parsed) {
      throw new AICallError(
        "VALIDATION_ERROR",
        "OpenAI returned no parsed structured output"
      )
    }
    return request.schema.parse(response.output_parsed)
  }
}

let provider: AIProvider | null = null
let configuredProvider: AIProviderName | null = null

function getProvider(): AIProvider {
  validateAIConfiguration()
  const providerName = resolveAIProvider()
  if (!provider || configuredProvider !== providerName) {
    provider =
      providerName === "ollama"
        ? new OllamaProvider()
        : providerName === "openai"
          ? new OpenAIProvider()
          : new AnthropicProvider()
    configuredProvider = providerName
  }
  return provider
}

function wrapProviderError(err: unknown, fnName: string): AICallError {
  if (err instanceof z.ZodError) {
    return new AICallError(
      "VALIDATION_ERROR",
      `${fnName}: AI response failed schema validation`,
      err
    )
  }
  if (
    err instanceof AnthropicRateLimitError ||
    err instanceof OpenAIRateLimitError
  ) {
    return new AICallError(
      "RATE_LIMITED",
      `${fnName}: rate limit exceeded`,
      err
    )
  }
  if (
    err instanceof AnthropicAuthenticationError ||
    err instanceof OpenAIAuthenticationError
  ) {
    return new AICallError(
      "MISSING_API_KEY",
      `${fnName}: authentication failed â€” check the configured provider API key`,
      err
    )
  }
  if (err instanceof AnthropicAPIError || err instanceof OpenAIAPIError) {
    return new AICallError(
      "API_ERROR",
      `${fnName}: API error (status ${err.status}) â€” ${err.message ?? ""}`,
      err
    )
  }
  return _wrapSDKError(err, fnName)
}

function _wrapSDKError(err: unknown, fnName: string): AICallError {
  if (err instanceof AnthropicRateLimitError) {
    return new AICallError(
      "RATE_LIMITED",
      `${fnName}: rate limit exceeded`,
      err
    )
  }
  if (err instanceof AnthropicAuthenticationError) {
    return new AICallError(
      "MISSING_API_KEY",
      `${fnName}: authentication failed — check ANTHROPIC_API_KEY`,
      err
    )
  }
  if (err instanceof AnthropicAPIError) {
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
// All provider calls go through these four functions only.
// Never import or call a provider SDK directly from routes or server functions.

export async function generatePlan(
  input: PlanGenerationInput
): Promise<PlanGenerationOutput> {
  const aiProvider = getProvider()
  const start = Date.now()
  const summary = "validated response"

  try {
    const output = await aiProvider.generateObject({
      systemPrompt: PLAN_GENERATION_PROMPT,
      userPrompt: buildPlanUserMessage(input),
      schemaName: "workout_plan",
      schema: PlanGenerationSchema,
      maxOutputTokens: 16000,
    })
    const resolved = resolveNamesInPlan(output, input.exerciseLibrary)
    logSuccess("generatePlan", Date.now() - start, summary)
    return resolved
  } catch (err) {
    if (err instanceof AICallError) {
      logFailure("generatePlan", Date.now() - start, err.code)
      throw err
    }
    const wrapped = wrapProviderError(err, "generatePlan")
    logFailure("generatePlan", Date.now() - start, wrapped.code)
    throw wrapped
  }
}

export async function adaptWeek(
  input: AdaptationInput
): Promise<AdaptationOutput> {
  const aiProvider = getProvider()
  const start = Date.now()
  const summary = "validated response"

  try {
    const output = await aiProvider.generateObject({
      systemPrompt: ADAPTATION_PROMPT,
      userPrompt: buildAdaptationUserMessage(input),
      schemaName: "weekly_adaptation",
      schema: AdaptationSchema,
      maxOutputTokens: 2048,
    })

    logSuccess("adaptWeek", Date.now() - start, summary)
    return output
  } catch (err) {
    if (err instanceof AICallError) {
      logFailure("adaptWeek", Date.now() - start, err.code)
      throw err
    }
    const wrapped = wrapProviderError(err, "adaptWeek")
    logFailure("adaptWeek", Date.now() - start, wrapped.code)
    throw wrapped
  }
}

export async function swapExercise(input: SwapInput): Promise<SwapOutput> {
  const aiProvider = getProvider()
  const start = Date.now()
  const summary = "validated response"

  try {
    const output = await aiProvider.generateObject({
      systemPrompt: SWAP_PROMPT,
      userPrompt: buildSwapUserMessage(input),
      schemaName: "exercise_swap",
      schema: SwapSchema,
      maxOutputTokens: 1024,
    })

    const resolved = resolveNamesInSwap(output, input.exerciseLibrary)
    logSuccess("swapExercise", Date.now() - start, summary)
    return resolved
  } catch (err) {
    if (err instanceof AICallError) {
      logFailure("swapExercise", Date.now() - start, err.code)
      throw err
    }
    const wrapped = wrapProviderError(err, "swapExercise")
    logFailure("swapExercise", Date.now() - start, wrapped.code)
    throw wrapped
  }
}

export const OnDemandWorkoutOutputSchema = z.object({
  result: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("workout"),
      title: z.string().min(1).max(100),
      focus: FocusSchema,
      reasoning: z.string().min(1).max(1000),
      resolvedConstraints: constraintsSchema,
      estimatedDurationSeconds: z.number().int().min(1).max(7200),
      exercises: z
        .array(
          z.object({
            exerciseId: z.string().min(1),
            sets: z.number().int().min(1).max(10),
            repRange: z.string().regex(/^([1-9][0-9]?|100)-([1-9][0-9]?|100)$/),
            loadKg: z.number().min(0).max(500),
            rirTarget: z.number().int().min(0).max(5),
            restSeconds: z.number().int().min(30).max(600),
            coachNote: z.string().min(1).max(400),
          })
        )
        .min(1)
        .max(12),
    }),
    z.object({
      status: z.literal("infeasible"),
      reasoning: z.string().min(1).max(1000),
    }),
  ]),
})
export type OnDemandWorkoutOutput = z.infer<
  typeof OnDemandWorkoutOutputSchema
>["result"]
export async function generateOnDemandWorkout(
  input: GenerateOnDemandWorkoutInput,
  context: OnDemandWorkoutGenerationContext
): Promise<OnDemandWorkoutOutput> {
  const aiProvider = getProvider()
  const start = Date.now()
  try {
    const output = await aiProvider.generateObject({
      systemPrompt: ON_DEMAND_WORKOUT_GENERATION_PROMPT,
      userPrompt: buildOnDemandWorkoutUserMessage(input, context),
      schemaName: "on_demand_workout",
      schema: OnDemandWorkoutOutputSchema,
      maxOutputTokens: 4096,
      maxRetries: 0,
      timeout: 90000,
    })
    logSuccess(
      "generateOnDemandWorkout",
      Date.now() - start,
      "validated response"
    )
    return output.result
  } catch (error) {
    const wrapped =
      error instanceof AICallError
        ? error
        : wrapProviderError(error, "generateOnDemandWorkout")
    logFailure("generateOnDemandWorkout", Date.now() - start, wrapped.code)
    throw wrapped
  }
}
