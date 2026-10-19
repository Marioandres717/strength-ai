import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull, or, lt } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type * as schema from "./schema"
import {
  exercise,
  onDemandWorkout,
  onDemandWorkoutGenerationRequest,
  onDemandWorkoutExercise,
  onDemandWorkoutRevision,
  plannedExercise,
  program,
  sessionTemplate,
  setLog,
  userProfile,
  workoutLog,
} from "./schema"
import type {
  OnDemandWorkoutLibraryPage,
  OnDemandWorkoutPreview,
  StartWorkoutInput,
} from "../src/types/on-demand-workout"
import {
  constraintsSchema,
  editOnDemandWorkoutInputSchema,
  snapshotSchema,
  startWorkoutInputSchema,
} from "../src/types/on-demand-workout"
import type { SessionRun } from "../src/types/session"
import { onDemandWorkoutLoadEstimates } from "../data/on-demand-workout-load-estimates"
import { suggestLoad } from "./loadSuggestions"
import { workoutHistory } from "./workoutHistory.server"
import { estimateOnDemandWorkoutDuration } from "./onDemandWorkoutDuration"
import { validateWorkoutTimestamp } from "./workoutValidation"
import type { z } from "zod"

export type WorkoutDatabase = BetterSQLite3Database<typeof schema>

export function getOnDemandWorkoutOperation(
  database: WorkoutDatabase,
  id: string
): OnDemandWorkoutPreview {
  const definition = database
    .select()
    .from(onDemandWorkout)
    .where(
      and(
        eq(onDemandWorkout.id, id),
        isNull(onDemandWorkout.userId),
        isNull(onDemandWorkout.deletedAt)
      )
    )
    .get()
  if (!definition) throw new Error("On-demand workout is unavailable.")
  const revision = database
    .select()
    .from(onDemandWorkoutRevision)
    .where(eq(onDemandWorkoutRevision.onDemandWorkoutId, id))
    .orderBy(desc(onDemandWorkoutRevision.revisionNumber))
    .get()
  if (!revision) throw new Error("Workout revision is unavailable.")
  const constraints = {
    ...revision.constraints,
    ...constraintsSchema.parse(revision.constraints),
  }
  const profile = database
    .select()
    .from(userProfile)
    .where(isNull(userProfile.userId))
    .orderBy(desc(userProfile.createdAt))
    .get()
  const request = database
    .select()
    .from(onDemandWorkoutGenerationRequest)
    .where(
      eq(onDemandWorkoutGenerationRequest.id, definition.generationRequestId)
    )
    .get()
  const units = profile?.units ?? request?.context.profile.units ?? "kg"
  const history = workoutHistory(database)
  const rows = database
    .select({ prescription: onDemandWorkoutExercise, exercise })
    .from(onDemandWorkoutExercise)
    .innerJoin(exercise, eq(onDemandWorkoutExercise.exerciseId, exercise.id))
    .where(eq(onDemandWorkoutExercise.onDemandWorkoutRevisionId, revision.id))
    .orderBy(onDemandWorkoutExercise.orderIndex)
    .all()
  const catalog = database
    .select()
    .from(exercise)
    .all()
    .filter(
      (e) =>
        onDemandWorkoutLoadEstimates[e.name] !== undefined &&
        e.equipment.every((k) => constraints.equipment.includes(k))
    )
  const exercises = rows.map(({ prescription: p, exercise: ex }) => {
    const prior = history.latest.get(ex.id)
    const suggestion = suggestLoad({
      baselineKg: onDemandWorkoutLoadEstimates[ex.name] ?? p.loadKg,
      repRange: p.repRange,
      rirTarget: p.rirTarget,
      units,
      history: prior,
      modelLoadKg: prior ? undefined : p.loadKg,
    })
    return {
      exercise: ex,
      prescription: {
        ...p,
        ...suggestion,
        ref: {
          kind: "on_demand_workout" as const,
          onDemandWorkoutExerciseId: p.id,
        },
      },
      priorPerformance: prior
        ? { ...prior.sets[0], date: prior.completedAt }
        : null,
    }
  })
  const alternatives = Object.fromEntries(
    rows.map(({ prescription: p, exercise: ex }) => [
      p.id,
      catalog
        .filter(
          (e) =>
            !rows.some((row) => row.exercise.id === e.id) &&
            (e.movement === ex.movement ||
              e.primaryMuscles.some((m) => ex.primaryMuscles.includes(m)))
        )
        .sort(
          (a, b) =>
            Number(b.movement === ex.movement) -
              Number(a.movement === ex.movement) || a.name.localeCompare(b.name)
        )
        .slice(0, 5),
    ])
  )
  const snapshot = snapshotSchema.parse({
    version: 1,
    revisionId: revision.id,
    title: revision.title,
    units,
    loadPolicyVersion: 1,
    exercises: exercises.map(({ prescription: p, exercise: ex }) => ({
      onDemandWorkoutExerciseId: p.id,
      exerciseId: ex.id,
      sets: p.sets,
      repRange: p.repRange,
      loadKg: p.loadKg,
      loadBasis: p.loadBasis,
      loadHistoryAt: p.loadHistoryAt,
      rirTarget: p.rirTarget,
      restSeconds: p.restSeconds,
      coachNote: p.coachNote,
    })),
  })
  return {
    id,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    title: revision.title,
    prompt: revision.prompt,
    focus: revision.focus,
    constraints,
    reasoning: revision.reasoning,
    editKind: revision.editKind,
    estimatedDurationSeconds: revision.estimatedDurationSeconds,
    createdAt: definition.createdAt.toISOString(),
    units,
    exercises,
    alternatives,
    snapshot,
  }
}

export function listOnDemandWorkoutsOperation(
  database: WorkoutDatabase,
  input: { limit?: number; cursor?: { createdAt: string; id: string } } = {}
): OnDemandWorkoutLibraryPage {
  const limit = input.limit ?? 20
  const cursor = input.cursor
  const definitions = database
    .select()
    .from(onDemandWorkout)
    .where(
      and(
        isNull(onDemandWorkout.userId),
        isNull(onDemandWorkout.deletedAt),
        cursor
          ? or(
              lt(onDemandWorkout.createdAt, new Date(cursor.createdAt)),
              and(
                eq(onDemandWorkout.createdAt, new Date(cursor.createdAt)),
                lt(onDemandWorkout.id, cursor.id)
              )
            )
          : undefined
      )
    )
    .orderBy(desc(onDemandWorkout.createdAt), desc(onDemandWorkout.id))
    .limit(limit + 1)
    .all()
  const revisions = database
    .select()
    .from(onDemandWorkoutRevision)
    .where(isNull(onDemandWorkoutRevision.userId))
    .orderBy(desc(onDemandWorkoutRevision.revisionNumber))
    .all()
  const logs = database
    .select({
      id: workoutLog.id,
      revisionId: workoutLog.onDemandWorkoutRevisionId,
      completedAt: workoutLog.completedAt,
    })
    .from(workoutLog)
    .where(isNull(workoutLog.userId))
    .all()
  const items = definitions.slice(0, limit).map((d) => {
    const revision = revisions.find((r) => r.onDemandWorkoutId === d.id)
    if (!revision) throw new Error("Workout revision is unavailable.")
    const ids = new Set(
      revisions.filter((r) => r.onDemandWorkoutId === d.id).map((r) => r.id)
    )
    return {
      id: d.id,
      revisionId: revision.id,
      title: revision.title,
      promptExcerpt: revision.prompt.slice(0, 120),
      focus: revision.focus,
      estimatedDurationSeconds: revision.estimatedDurationSeconds,
      createdAt: d.createdAt.toISOString(),
      completedRunIds: logs
        .filter((l) => l.completedAt && l.revisionId && ids.has(l.revisionId))
        .map((l) => l.id),
      timesCompleted: new Set(
        logs
          .filter((l) => l.completedAt && l.revisionId && ids.has(l.revisionId))
          .map((l) => l.id)
      ).size,
    }
  })
  const tombstoneIds = database
    .select()
    .from(onDemandWorkout)
    .where(isNull(onDemandWorkout.userId))
    .all()
    .filter((d) => d.deletedAt)
    .map((d) => d.id)
  const last = items.at(-1)
  return {
    items,
    tombstoneIds,
    nextCursor:
      definitions.length > limit && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  }
}

export function deleteOnDemandWorkoutOperation(
  database: WorkoutDatabase,
  id: string
) {
  return database.transaction((tx) => {
    const row = tx
      .select()
      .from(onDemandWorkout)
      .where(and(eq(onDemandWorkout.id, id), isNull(onDemandWorkout.userId)))
      .get()
    if (!row) throw new Error("On-demand workout is unavailable.")
    const deletedAt = row.deletedAt ?? new Date()
    tx.update(onDemandWorkout)
      .set({ deletedAt })
      .where(eq(onDemandWorkout.id, id))
      .run()
    return { deletedAt: deletedAt.toISOString() }
  })
}

export function editOnDemandWorkoutOperation(
  database: WorkoutDatabase,
  raw: z.infer<typeof editOnDemandWorkoutInputSchema>
): { status: "saved" | "conflict"; preview: OnDemandWorkoutPreview } {
  const input = editOnDemandWorkoutInputSchema.parse(raw)
  const status = database.transaction((tx) => {
    const preview = getOnDemandWorkoutOperation(
      database,
      input.onDemandWorkoutId
    )
    if (preview.revisionId !== input.expectedRevisionId)
      return "conflict" as const
    const rows = tx
      .select()
      .from(onDemandWorkoutExercise)
      .where(
        eq(
          onDemandWorkoutExercise.onDemandWorkoutRevisionId,
          preview.revisionId
        )
      )
      .orderBy(onDemandWorkoutExercise.orderIndex)
      .all()
    const target = rows.find(
      (r) => r.id === input.action.onDemandWorkoutExerciseId
    )
    if (!target) throw new Error("Exercise does not belong to this revision.")
    if (input.action.kind === "remove" && rows.length === 1)
      throw new Error("Keep at least one exercise.")
    let next = rows.filter(
      (r) => input.action.kind !== "remove" || r.id !== target.id
    )
    if (input.action.kind === "swap") {
      const replacement = preview.alternatives[target.id]?.find(
        (e) =>
          e.id ===
          (input.action.kind === "swap"
            ? input.action.replacementExerciseId
            : "")
      )
      if (!replacement)
        throw new Error("Replacement does not meet this workout's constraints.")
      const history = workoutHistory(database)
      const load = suggestLoad({
        baselineKg: onDemandWorkoutLoadEstimates[replacement.name],
        repRange: target.repRange,
        rirTarget: target.rirTarget,
        units: preview.units,
        history: history.latest.get(replacement.id),
      })
      next = next.map((r) =>
        r.id === target.id
          ? {
              ...r,
              exerciseId: replacement.id,
              ...load,
              loadHistoryAt: load.loadHistoryAt
                ? new Date(load.loadHistoryAt)
                : null,
              coachNote: `Use controlled repetitions and stop at the prescribed RIR.${replacement.equipment.includes("dumbbell") ? " Enter the weight of one dumbbell." : ""}`,
            }
          : r
      )
    }
    const catalog = tx.select().from(exercise).all()
    next.sort(
      (a, b) =>
        Number(
          catalog.find((e) => e.id === a.exerciseId)?.movement === "isolation"
        ) -
          Number(
            catalog.find((e) => e.id === b.exerciseId)?.movement === "isolation"
          ) || a.orderIndex - b.orderIndex
    )
    const duration = estimateOnDemandWorkoutDuration(next)
    if (duration > preview.constraints.timeMinutes * 60)
      throw new Error("Edited workout exceeds the time budget.")
    const revision = tx
      .select()
      .from(onDemandWorkoutRevision)
      .where(eq(onDemandWorkoutRevision.id, preview.revisionId))
      .get()!
    const id = randomUUID()
    tx.insert(onDemandWorkoutRevision)
      .values({
        ...revision,
        id,
        revisionNumber: revision.revisionNumber + 1,
        estimatedDurationSeconds: duration,
        editKind: "preview_edit",
        createdAt: new Date(),
      })
      .run()
    tx.insert(onDemandWorkoutExercise)
      .values(
        next.map((r, i) => ({
          ...r,
          id: randomUUID(),
          onDemandWorkoutRevisionId: id,
          orderIndex: i,
          createdAt: new Date(),
        }))
      )
      .run()
    return "saved" as const
  })
  return {
    status,
    preview: getOnDemandWorkoutOperation(database, input.onDemandWorkoutId),
  }
}

export function getWorkoutRunOperation(
  database: WorkoutDatabase,
  id: string
): SessionRun {
  const log = database
    .select()
    .from(workoutLog)
    .where(and(eq(workoutLog.id, id), isNull(workoutLog.userId)))
    .get()
  if (!log) throw new Error("Workout run is unavailable.")
  const profile = database
    .select()
    .from(userProfile)
    .where(isNull(userProfile.userId))
    .orderBy(desc(userProfile.createdAt))
    .get()
  const sets = database
    .select()
    .from(setLog)
    .where(eq(setLog.workoutLogId, id))
    .all()
  const persistedSets = sets.map((s) => ({
    setLogId: s.id,
    prescriptionRef: s.plannedExerciseId
      ? { kind: "planned" as const, plannedExerciseId: s.plannedExerciseId }
      : {
          kind: "on_demand_workout" as const,
          onDemandWorkoutExerciseId: s.onDemandWorkoutExerciseId!,
        },
    setNumber: s.setNumber,
    weightKg: s.weightKg,
    reps: s.reps,
    rirActual: s.rirActual ?? 0,
    loggedAt: s.loggedAt,
  }))
  const history = workoutHistory(database)
  if (log.onDemandWorkoutRevisionId) {
    const revision = database
      .select()
      .from(onDemandWorkoutRevision)
      .where(eq(onDemandWorkoutRevision.id, log.onDemandWorkoutRevisionId))
      .get()!
    const snapshot = snapshotSchema.parse(log.runSnapshot)
    const rows = database
      .select({ p: onDemandWorkoutExercise, exercise })
      .from(onDemandWorkoutExercise)
      .innerJoin(exercise, eq(onDemandWorkoutExercise.exerciseId, exercise.id))
      .where(eq(onDemandWorkoutExercise.onDemandWorkoutRevisionId, revision.id))
      .orderBy(onDemandWorkoutExercise.orderIndex)
      .all()
    return {
      workoutLogId: id,
      source: {
        kind: "on_demand_workout",
        onDemandWorkoutId: revision.onDemandWorkoutId,
        onDemandWorkoutRevisionId: revision.id,
      },
      title: snapshot.title,
      programName: null,
      units: snapshot.units,
      startedAt: log.startedAt,
      persistedSets,
      snapshot,
      exercises: rows.map(({ p, exercise: ex }) => {
        const target = snapshot.exercises.find(
          (e) => e.onDemandWorkoutExerciseId === p.id
        )!
        const prior = history.latest.get(ex.id)
        return {
          exercise: ex,
          prescription: {
            ...p,
            ...target,
            ref: { kind: "on_demand_workout", onDemandWorkoutExerciseId: p.id },
          },
          priorPerformance: prior
            ? { ...prior.sets[0], date: prior.completedAt }
            : null,
        }
      }),
    }
  }
  if (!log.sessionTemplateId) throw new Error("Invalid workout source.")
  const template = database
    .select()
    .from(sessionTemplate)
    .where(eq(sessionTemplate.id, log.sessionTemplateId))
    .get()!
  const prog = database
    .select()
    .from(program)
    .where(eq(program.id, template.programId))
    .get()!
  const rows = database
    .select({ p: plannedExercise, exercise })
    .from(plannedExercise)
    .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
    .where(eq(plannedExercise.sessionTemplateId, template.id))
    .orderBy(plannedExercise.orderIndex)
    .all()
  return {
    workoutLogId: id,
    source: {
      kind: "planned",
      sessionTemplateId: template.id,
      programId: prog.id,
    },
    title: template.dayLabel,
    programName: prog.name,
    units: profile?.units ?? "kg",
    startedAt: log.startedAt,
    persistedSets,
    exercises: rows.map(({ p, exercise: ex }) => {
      const prior = history.latest.get(ex.id)
      return {
        exercise: ex,
        prescription: {
          ...p,
          ref: { kind: "planned", plannedExerciseId: p.id },
        },
        priorPerformance: prior
          ? { ...prior.sets[0], date: prior.completedAt }
          : null,
      }
    }),
  }
}

export function startWorkoutOperation(
  database: WorkoutDatabase,
  raw: StartWorkoutInput
): SessionRun {
  const input = startWorkoutInputSchema.parse(raw)
  database.transaction((tx) => {
    const existing = tx
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, input.workoutLogId))
      .get()
    if (existing) {
      const matches =
        input.source.kind === "planned"
          ? existing.sessionTemplateId === input.source.sessionTemplateId &&
            existing.runSnapshot === null
          : existing.onDemandWorkoutRevisionId ===
              input.source.onDemandWorkoutRevisionId &&
            JSON.stringify(existing.runSnapshot) ===
              JSON.stringify(input.onDemandWorkoutRunSnapshot)
      if (
        !matches ||
        existing.userId !== null ||
        existing.startedAt.getTime() !==
          Math.floor(Date.parse(input.startedAt) / 1000) * 1000
      )
        throw new Error("Run identity conflicts with an existing workout.")
      return
    }
    const startedAt = new Date(input.startedAt)
    validateWorkoutTimestamp(startedAt)
    if (input.source.kind === "planned") {
      const template = tx
        .select()
        .from(sessionTemplate)
        .where(
          and(
            eq(sessionTemplate.id, input.source.sessionTemplateId),
            isNull(sessionTemplate.userId)
          )
        )
        .get()
      if (
        template?.programId !== input.source.programId ||
        input.onDemandWorkoutRunSnapshot
      )
        throw new Error("Invalid planned source.")
      tx.insert(workoutLog)
        .values({
          id: input.workoutLogId,
          sessionTemplateId: template.id,
          startedAt,
        })
        .run()
      return
    }
    const revision = tx
      .select()
      .from(onDemandWorkoutRevision)
      .where(
        and(
          eq(
            onDemandWorkoutRevision.id,
            input.source.onDemandWorkoutRevisionId
          ),
          isNull(onDemandWorkoutRevision.userId)
        )
      )
      .get()
    const definition = tx
      .select()
      .from(onDemandWorkout)
      .where(
        and(
          eq(onDemandWorkout.id, input.source.onDemandWorkoutId),
          isNull(onDemandWorkout.userId)
        )
      )
      .get()
    if (
      !revision ||
      revision.onDemandWorkoutId !== definition?.id ||
      (definition.deletedAt && input.intent !== "offline_replay")
    )
      throw new Error("Workout definition is unavailable.")
    const snapshot = snapshotSchema.parse(input.onDemandWorkoutRunSnapshot)
    const rows = tx
      .select()
      .from(onDemandWorkoutExercise)
      .where(eq(onDemandWorkoutExercise.onDemandWorkoutRevisionId, revision.id))
      .orderBy(onDemandWorkoutExercise.orderIndex)
      .all()
    if (
      snapshot.revisionId !== revision.id ||
      snapshot.title !== revision.title ||
      rows.length !== snapshot.exercises.length
    )
      throw new Error("Run snapshot conflicts with the saved revision.")
    rows.forEach((r, i) => {
      const e = snapshot.exercises[i]
      if (
        r.userId !== null ||
        e.onDemandWorkoutExerciseId !== r.id ||
        e.exerciseId !== r.exerciseId ||
        e.sets !== r.sets ||
        e.repRange !== r.repRange ||
        e.rirTarget !== r.rirTarget ||
        e.restSeconds !== r.restSeconds ||
        e.coachNote !== r.coachNote
      )
        throw new Error("Run snapshot prescription conflict.")
      if (e.loadHistoryAt) validateWorkoutTimestamp(new Date(e.loadHistoryAt))
      if (
        (e.loadBasis === "history" && !e.loadHistoryAt) ||
        (e.loadBasis === "bodyweight" && e.loadKg !== 0)
      )
        throw new Error("Invalid load provenance.")
    })
    tx.insert(workoutLog)
      .values({
        id: input.workoutLogId,
        onDemandWorkoutRevisionId: revision.id,
        runSnapshot: snapshot,
        startedAt,
      })
      .run()
  })
  return getWorkoutRunOperation(database, input.workoutLogId)
}
