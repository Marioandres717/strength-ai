import { createHash, randomUUID } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { generateOnDemandWorkout, OnDemandWorkoutOutputSchema } from "./ai"
import {
  buildOnDemandWorkoutUserMessage,
  ON_DEMAND_WORKOUT_GENERATION_PROMPT,
} from "./prompts"
import { appTimezone, onDemandWorkoutDailyCap } from "./env"
import {
  exercise,
  onDemandWorkout,
  onDemandWorkoutExercise,
  onDemandWorkoutGenerationRequest as requests,
  onDemandWorkoutRevision,
  program,
  sessionTemplate,
  userProfile,
  workoutLog,
} from "./schema"
import { getOnDemandWorkoutOperation } from "./onDemandWorkouts.server"
import type { WorkoutDatabase } from "./onDemandWorkouts.server"
import type {
  GenerationResult,
  GenerateOnDemandWorkoutInput,
  GenerationRequestSummary,
  OnDemandWorkoutGenerationContext,
} from "../src/types/on-demand-workout"
import {
  generateOnDemandWorkoutInputSchema,
  parseOnDemandWorkoutPrompt,
} from "../src/types/on-demand-workout"
import { onDemandWorkoutLoadEstimates } from "../data/on-demand-workout-load-estimates"
import { workoutHistory } from "./workoutHistory.server"
import { suggestLoad } from "./loadSuggestions"
import { parseRepRangeLower, parseRepRangeUpper } from "./rules"
import { estimateOnDemandWorkoutDuration } from "./onDemandWorkoutDuration"
import {
  listGenerationReceipts,
  preflightRecovery,
  readGenerationReceipt,
  recoveryDirectory,
  writeGenerationReceipt,
} from "./onDemandWorkoutRecovery.server"
import type { GenerationReceipt } from "./onDemandWorkoutRecovery.server"

function quotaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}
function resetAt(now = new Date()) {
  const day = quotaDay(now)
  let next = now.getTime()
  while (quotaDay(new Date(next)) === day) next += 60_000
  return new Date(Math.floor(next / 60_000) * 60_000).toISOString()
}
function fail(
  requestId: string,
  code: string,
  reason: string,
  attemptConsumed = false
): GenerationResult {
  return { status: "failed", requestId, code, reason, attemptConsumed }
}
function hashInput(input: GenerateOnDemandWorkoutInput) {
  const { requestId: _id, ...rest } = input
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...rest,
        equipment: rest.equipment
          ? [...new Set(rest.equipment)].sort()
          : undefined,
      })
    )
    .digest("hex")
}

export function buildGenerationContext(
  database: WorkoutDatabase,
  input: GenerateOnDemandWorkoutInput
): OnDemandWorkoutGenerationContext {
  const profile = database
    .select()
    .from(userProfile)
    .where(isNull(userProfile.userId))
    .orderBy(desc(userProfile.createdAt))
    .get()
  const catalog = database
    .select()
    .from(exercise)
    .all()
    .filter((e) => onDemandWorkoutLoadEstimates[e.name] !== undefined)
  const vocabulary = new Set(catalog.flatMap((e) => e.equipment))
  const parsed = parseOnDemandWorkoutPrompt(input.prompt)
  const equipment = [
    ...new Set(input.equipment ?? parsed.equipment ?? profile?.equipment ?? []),
  ].sort()
  if (equipment.some((k) => !vocabulary.has(k)))
    throw new Error(
      "Unknown equipment. Choose from the available equipment list."
    )
  if (!profile && (!input.experience || !input.equipment))
    throw new Error(
      "Choose experience and available equipment before generating."
    )
  const constraints = {
    timeMinutes:
      input.timeMinutes ??
      parsed.timeMinutes ??
      profile?.sessionLengthMin ??
      30,
    equipment,
    focus:
      input.focus ??
      (profile?.goal === "strength"
        ? ("strength" as const)
        : profile?.goal === "hypertrophy"
          ? ("hypertrophy" as const)
          : ("mixed" as const)),
    energy: input.energy ?? null,
    soreness: input.soreness ?? null,
    defaults: {
      timeMinutes:
        input.timeMinutes !== undefined
          ? ("control" as const)
          : parsed.timeMinutes
            ? ("prompt" as const)
            : profile
              ? ("profile" as const)
              : ("fallback" as const),
      equipment: input.equipment
        ? ("control" as const)
        : parsed.equipment
          ? ("prompt" as const)
          : profile
            ? ("profile" as const)
            : ("fallback" as const),
    },
  }
  const library = catalog.filter((e) =>
    e.equipment.every((k) => equipment.includes(k))
  )
  if (!library.length)
    throw new Error("No supported exercises match this equipment.")
  const priorDefinition = input.regenerateFromId
    ? getOnDemandWorkoutOperation(database, input.regenerateFromId)
    : null
  const history = workoutHistory(database)
  const units = profile?.units ?? input.units ?? "kg"
  const baselines: OnDemandWorkoutGenerationContext["baselines"] =
    Object.fromEntries(
      library.slice(0, 35).map((e) => [
        e.id,
        suggestLoad({
          baselineKg: onDemandWorkoutLoadEstimates[e.name],
          repRange: "8-12",
          rirTarget: 2,
          units,
          history: history.latest.get(e.id),
        }),
      ])
    )
  for (const entry of library) {
    const prior = history.latest.get(entry.id),
      baseline = baselines[entry.id]
    if (!prior || !baseline) continue
    const weights = prior.sets.map((s) => s.weightKg).sort((a, b) => a - b),
      middle = Math.floor(weights.length / 2)
    baseline.targetHistory = {
      completedAt: prior.completedAt,
      medianLoadKg:
        weights.length % 2
          ? weights[middle]
          : (weights[middle - 1] + weights[middle]) / 2,
      minimumReps: Math.min(...prior.sets.map((s) => s.reps)),
      minimumRir: Math.min(...prior.sets.map((s) => s.rirActual ?? 0)),
    }
  }
  const prog = database
    .select()
    .from(program)
    .where(and(eq(program.status, "active"), isNull(program.userId)))
    .orderBy(desc(program.createdAt))
    .get()
  let nextPlannedSession: string | null = null
  if (prog) {
    const currentWeek = Math.max(
      1,
      Math.min(
        prog.weeksTotal,
        Math.floor((Date.now() - prog.createdAt.getTime()) / (7 * 86400000)) + 1
      )
    )
    const templates = database
      .select()
      .from(sessionTemplate)
      .where(
        and(
          eq(sessionTemplate.programId, prog.id),
          eq(sessionTemplate.weekNumber, currentWeek)
        )
      )
      .orderBy(sessionTemplate.weekNumber, sessionTemplate.orderIndex)
      .all()
    const completed = new Set(
      database
        .select()
        .from(workoutLog)
        .where(isNull(workoutLog.userId))
        .all()
        .filter((l) => l.completedAt)
        .map((l) => l.sessionTemplateId)
    )
    const next = templates.find((t) => !completed.has(t.id))
    if (next)
      nextPlannedSession = `Next planned: ${next.dayLabel} (${next.focus}), week ${next.weekNumber}`
  }
  const context: OnDemandWorkoutGenerationContext = {
    constraints,
    profile: {
      experience: profile?.experience ?? input.experience ?? "beginner",
      units,
      directives: (profile?.customDirectives ?? "").slice(0, 1500),
    },
    library,
    baselines,
    recentHistory: history.recent,
    ...(priorDefinition
      ? {
          previousWorkout: {
            title: priorDefinition.title,
            exercises: priorDefinition.exercises.map((e) => ({
              exerciseId: e.exercise.id,
              sets: e.prescription.sets,
              repRange: e.prescription.repRange,
            })),
          },
        }
      : {}),
    nextPlannedSession,
  }
  // Conservative upper bound; no token-counting API and no silently dropped constraints.
  if (
    (buildOnDemandWorkoutUserMessage(input, context).length +
      ON_DEMAND_WORKOUT_GENERATION_PROMPT.length) /
      3 >
    8000
  )
    throw new Error(
      "Generation context exceeds the input budget. Shorten the prompt."
    )
  return context
}

export function getOnDemandWorkoutGenerationOperation(
  database: WorkoutDatabase,
  requestId: string
): GenerationResult {
  const request = database
    .select()
    .from(requests)
    .where(and(eq(requests.id, requestId), isNull(requests.userId)))
    .get()
  if (!request) return { status: "unknown", requestId }
  const definition = database
    .select()
    .from(onDemandWorkout)
    .where(eq(onDemandWorkout.generationRequestId, requestId))
    .get()
  if (definition)
    return {
      status: "saved",
      requestId,
      onDemandWorkoutId: definition.id,
      preview: definition.deletedAt
        ? null
        : getOnDemandWorkoutOperation(database, definition.id),
    }
  if (request.status === "reserved" || request.status === "calling")
    return { status: "in_progress", requestId }
  if (request.status === "save_pending")
    return { status: "save_pending", requestId }
  if (request.status === "unknown") return { status: "unknown", requestId }
  return fail(
    requestId,
    request.errorCode ?? "FAILED",
    request.errorCode === "DURATION"
      ? "The generated workout exceeds the time budget. The attempt was used; start a new generation to try again."
      : "The workout could not be generated or validated. Start a new request to try again.",
    request.callStartedAt !== null
  )
}

export function finalizeGenerationReceipt(
  database: WorkoutDatabase,
  receipt: GenerationReceipt
): GenerationResult {
  const request = database
    .select()
    .from(requests)
    .where(and(eq(requests.id, receipt.requestId), isNull(requests.userId)))
    .get()
  if (request?.requestHash !== receipt.requestHash)
    throw new Error("Recovery request identity conflict.")
  if (request.status === "saved")
    return getOnDemandWorkoutGenerationOperation(database, receipt.requestId)
  let errorCode = "VALIDATION"
  try {
    const output = OnDemandWorkoutOutputSchema.parse({
      result: receipt.response,
    }).result
    if (output.status === "infeasible") throw new Error("No feasible workout.")
    const context = request.context
    const expected = context.constraints,
      actual = output.resolvedConstraints
    if (
      actual.timeMinutes !== expected.timeMinutes ||
      actual.focus !== expected.focus ||
      output.focus !== expected.focus ||
      actual.energy !== expected.energy ||
      actual.soreness !== expected.soreness ||
      JSON.stringify([...actual.equipment].sort()) !==
        JSON.stringify(expected.equipment)
    )
      throw new Error("Resolved controls conflict.")
    if (
      new Set(output.exercises.map((e) => e.exerciseId)).size !==
        output.exercises.length ||
      output.exercises.reduce((n, e) => n + e.sets, 0) > 40
    )
      throw new Error("Duplicate exercise or too many sets.")
    const exercises = output.exercises
      .map((e) => {
        const libraryEntry = context.library.find((x) => x.id === e.exerciseId)
        const baseline = context.baselines[e.exerciseId]
        if (
          !libraryEntry ||
          !baseline ||
          !libraryEntry.equipment.every((k) =>
            expected.equipment.includes(k)
          ) ||
          parseRepRangeLower(e.repRange) > parseRepRangeUpper(e.repRange)
        )
          throw new Error("Invalid exercise prescription.")
        // Recheck against the actual proposed targets using bounded captured history.
        const load = suggestLoad({
          baselineKg: baseline.loadKg,
          repRange: e.repRange,
          rirTarget: e.rirTarget,
          units: context.profile.units,
          modelLoadKg: Math.min(e.loadKg, baseline.loadKg),
          history: baseline.targetHistory
            ? {
                workoutLogId: "captured-baseline",
                completedAt: baseline.targetHistory.completedAt,
                sets: [
                  {
                    weightKg: baseline.targetHistory.medianLoadKg,
                    reps: baseline.targetHistory.minimumReps,
                    rirActual: baseline.targetHistory.minimumRir,
                  },
                ],
              }
            : null,
        })
        return {
          ...e,
          ...load,
          loadBasis:
            load.loadKg === 0 ? ("bodyweight" as const) : baseline.loadBasis,
          loadHistoryAt: baseline.loadHistoryAt
            ? new Date(baseline.loadHistoryAt)
            : null,
          movement: libraryEntry.movement,
          coachNote: libraryEntry.equipment.includes("dumbbell")
            ? `${e.coachNote.slice(0, 350)} Enter the weight of one dumbbell.`
            : e.coachNote,
        }
      })
      .sort(
        (a, b) =>
          Number(a.movement === "isolation") -
          Number(b.movement === "isolation")
      )
    const duration = estimateOnDemandWorkoutDuration(exercises)
    if (duration > expected.timeMinutes * 60) {
      errorCode = "DURATION"
      throw new Error("Duration exceeds budget.")
    }
    database.transaction((tx) => {
      const existing = tx
        .select()
        .from(onDemandWorkout)
        .where(eq(onDemandWorkout.generationRequestId, request.id))
        .get()
      if (existing) return
      const id = randomUUID(),
        revisionId = randomUUID()
      tx.insert(onDemandWorkout)
        .values({ id, generationRequestId: request.id })
        .run()
      tx.insert(onDemandWorkoutRevision)
        .values({
          id: revisionId,
          onDemandWorkoutId: id,
          revisionNumber: 1,
          title: output.title,
          prompt:
            request.input.prompt +
            (request.input.tweak ? `\nTweak: ${request.input.tweak}` : ""),
          constraints: expected,
          focus: output.focus,
          estimatedDurationSeconds: duration,
          reasoning: output.reasoning,
          editKind: "generated",
        })
        .run()
      tx.insert(onDemandWorkoutExercise)
        .values(
          exercises.map(({ movement: _movement, ...e }, i) => ({
            ...e,
            id: randomUUID(),
            onDemandWorkoutRevisionId: revisionId,
            orderIndex: i,
          }))
        )
        .run()
      tx.update(requests)
        .set({ status: "saved", updatedAt: new Date(), errorCode: null })
        .where(eq(requests.id, request.id))
        .run()
    })
  } catch (error) {
    // Constraint/schema failures are final; storage failures preserve the valid receipt for retry.
    const storage =
      error instanceof Error &&
      (/SQLITE_|database|disk|readonly|locked|Failed query/i.test(
        error.message
      ) ||
        "code" in error)
    if (storage) {
      try {
        database
          .update(requests)
          .set({ status: "save_pending", updatedAt: new Date() })
          .where(eq(requests.id, request.id))
          .run()
      } catch {
        /* Receipt remains authoritative recovery input. */
      }
      return { status: "save_pending", requestId: request.id }
    }
    database
      .update(requests)
      .set({ status: "failed", errorCode, updatedAt: new Date() })
      .where(eq(requests.id, request.id))
      .run()
  }
  return getOnDemandWorkoutGenerationOperation(database, receipt.requestId)
}

export function retryOnDemandWorkoutSaveOperation(
  database: WorkoutDatabase,
  id: string,
  directory = recoveryDirectory()
): GenerationResult {
  const receipt = readGenerationReceipt(id, directory)
  return receipt
    ? finalizeGenerationReceipt(database, receipt)
    : getOnDemandWorkoutGenerationOperation(database, id)
}

export async function generateOnDemandWorkoutOperation(
  database: WorkoutDatabase,
  raw: GenerateOnDemandWorkoutInput,
  directory = recoveryDirectory()
): Promise<GenerationResult> {
  const input = generateOnDemandWorkoutInputSchema.parse(raw),
    requestHash = hashInput(input)
  const prior = database
    .select()
    .from(requests)
    .where(eq(requests.id, input.requestId))
    .get()
  if (prior) {
    if (prior.userId !== null || prior.requestHash !== requestHash)
      return fail(
        input.requestId,
        "CONFLICT",
        "This request ID belongs to different input."
      )
    return retryOnDemandWorkoutSaveOperation(
      database,
      input.requestId,
      directory
    )
  }
  if (
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === "your_api_key_here"
  )
    return fail(
      input.requestId,
      "MISSING_KEY",
      "Configure the Anthropic key before generating."
    )
  let context: OnDemandWorkoutGenerationContext
  try {
    context = buildGenerationContext(database, input)
    preflightRecovery(directory)
  } catch {
    return fail(
      input.requestId,
      "PRE_DISPATCH",
      "Check experience, equipment, prompt length and server recovery storage before trying again."
    )
  }
  const reservation = database.transaction((tx) => {
    const duplicate = tx
      .select()
      .from(requests)
      .where(eq(requests.id, input.requestId))
      .get()
    if (duplicate) return "duplicate"
    const rows = tx.select().from(requests).where(isNull(requests.userId)).all()
    if (rows.some((r) => r.status === "calling" || r.status === "reserved"))
      return "busy"
    if (
      rows.filter(
        (r) =>
          r.quotaDay === quotaDay() &&
          (r.callStartedAt !== null || r.status === "reserved")
      ).length >= onDemandWorkoutDailyCap
    )
      return "cap"
    tx.insert(requests)
      .values({
        id: input.requestId,
        requestHash,
        input,
        context,
        status: "reserved",
        quotaDay: quotaDay(),
        updatedAt: new Date(),
      })
      .run()
    return "reserved"
  })
  if (reservation === "duplicate")
    return getOnDemandWorkoutGenerationOperation(database, input.requestId)
  if (reservation === "busy")
    return fail(
      input.requestId,
      "BUSY",
      "Another generation is still running. Check recent requests."
    )
  if (reservation === "cap")
    return {
      ...fail(
        input.requestId,
        "DAILY_CAP",
        "Daily generation allowance reached."
      ),
      remaining: 0,
      resetsAt: resetAt(),
    } as GenerationResult
  database
    .update(requests)
    .set({
      status: "calling",
      callStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(requests.id, input.requestId))
    .run()
  let response: unknown
  try {
    response = await generateOnDemandWorkout(input, context)
  } catch {
    database
      .update(requests)
      .set({ status: "failed", errorCode: "PROVIDER", updatedAt: new Date() })
      .where(eq(requests.id, input.requestId))
      .run()
    return getOnDemandWorkoutGenerationOperation(database, input.requestId)
  }
  const receipt: GenerationReceipt = {
    version: 1,
    requestId: input.requestId,
    requestHash,
    input,
    context,
    response,
    receivedAt: new Date().toISOString(),
  }
  let captured = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      writeGenerationReceipt(receipt, directory)
      captured = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
  if (!captured) {
    database
      .update(requests)
      .set({
        status: "unknown",
        errorCode: "RECEIPT_FAILED",
        updatedAt: new Date(),
      })
      .where(eq(requests.id, input.requestId))
      .run()
    return { status: "unknown", requestId: input.requestId }
  }
  return finalizeGenerationReceipt(database, receipt)
}

export function listOnDemandWorkoutGenerationsOperation(
  database: WorkoutDatabase,
  limit = 20
): GenerationRequestSummary[] {
  const definitions = database
    .select()
    .from(onDemandWorkout)
    .where(isNull(onDemandWorkout.userId))
    .all()
  return database
    .select()
    .from(requests)
    .where(isNull(requests.userId))
    .orderBy(desc(requests.createdAt), desc(requests.id))
    .limit(limit)
    .all()
    .map((r) => ({
      requestId: r.id,
      promptExcerpt: r.input.prompt.slice(0, 120),
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      onDemandWorkoutId:
        definitions.find((d) => d.generationRequestId === r.id)?.id ?? null,
    }))
}

/** Startup only: never expire a call while the serving process is running. */
export function reconcileOnDemandWorkoutGenerations(
  database: WorkoutDatabase,
  directory = recoveryDirectory()
) {
  for (const id of listGenerationReceipts(directory))
    retryOnDemandWorkoutSaveOperation(database, id, directory)
  for (const row of database
    .select()
    .from(requests)
    .where(isNull(requests.userId))
    .all()) {
    if (row.status === "reserved")
      database
        .update(requests)
        .set({
          status: "failed",
          errorCode: "RESTARTED_BEFORE_CALL",
          updatedAt: new Date(),
        })
        .where(eq(requests.id, row.id))
        .run()
    if (row.status === "calling")
      database
        .update(requests)
        .set({ status: "unknown", updatedAt: new Date() })
        .where(eq(requests.id, row.id))
        .run()
  }
}
