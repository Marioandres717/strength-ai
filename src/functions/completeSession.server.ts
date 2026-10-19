import { validateWorkoutTimestamp } from "../../lib/workoutValidation"
import { and, asc, desc, eq, gt } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import {
  exercise,
  onDemandWorkoutExercise,
  plannedExercise,
  sessionTemplate,
  setLog,
  workoutLog,
} from "../../lib/schema"
import type * as workoutSchema from "../../lib/schema"
import {
  canApplyProgramRules,
  computeProgression,
  type SetRecord,
} from "../../lib/rules"

type WorkoutDatabase = BetterSQLite3Database<typeof workoutSchema>

export interface ProgressionChange {
  plannedExerciseId: string
  exerciseName: string
  oldLoadKg: number
  newLoadKg: number
  reason: string
}

export interface CompleteSessionInput {
  workoutLogId: string
  sessionTemplateId?: string
  completedAt?: Date
}

export interface CompleteSessionResult {
  workoutLogId: string
  alreadyCompleted: boolean
  progressionChanges: ProgressionChange[]
}

export function completeSessionOperation(
  database: WorkoutDatabase,
  input: CompleteSessionInput
): CompleteSessionResult {
  return database.transaction((tx) => {
    const workout = tx
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, input.workoutLogId))
      .limit(1)
      .all()[0]

    if (!workout) {
      throw new Error(`Workout log ${input.workoutLogId} not found.`)
    }

    if (
      input.sessionTemplateId !== undefined &&
      workout.sessionTemplateId !== input.sessionTemplateId
    ) {
      throw new Error(
        `Workout log ${input.workoutLogId} does not belong to session template ${input.sessionTemplateId}.`
      )
    }

    if (workout.completedAt !== null) {
      return {
        workoutLogId: input.workoutLogId,
        alreadyCompleted: true,
        progressionChanges: [],
      }
    }

    const completedAt = input.completedAt ?? new Date()
    validateWorkoutTimestamp(completedAt, workout.startedAt)
    if (
      !canApplyProgramRules(
        workout.sessionTemplateId ? "planned" : "on_demand_workout"
      )
    ) {
      if (!workout.onDemandWorkoutRevisionId)
        throw new Error("Invalid workout source.")
      const prescriptions = tx
        .select()
        .from(onDemandWorkoutExercise)
        .where(
          eq(
            onDemandWorkoutExercise.onDemandWorkoutRevisionId,
            workout.onDemandWorkoutRevisionId
          )
        )
        .all()
      const sets = tx
        .select()
        .from(setLog)
        .where(eq(setLog.workoutLogId, workout.id))
        .all()
      if (!prescriptions.length) throw new Error("Workout has no exercises.")
      for (const prescription of prescriptions)
        for (let n = 1; n <= prescription.sets; n++) {
          if (
            !sets.some(
              (s) =>
                s.onDemandWorkoutExerciseId === prescription.id &&
                s.setNumber === n
            )
          )
            throw new Error("Workout is incomplete: missing required set.")
        }
      tx.update(workoutLog)
        .set({ completedAt })
        .where(eq(workoutLog.id, workout.id))
        .run()
      return {
        workoutLogId: workout.id,
        alreadyCompleted: false,
        progressionChanges: [],
      }
    }
    if (!workout.sessionTemplateId)
      throw new Error("Invalid planned workout source.")
    const template = tx
      .select()
      .from(sessionTemplate)
      .where(eq(sessionTemplate.id, workout.sessionTemplateId))
      .limit(1)
      .all()[0]

    if (!template) {
      throw new Error(`Session template ${input.sessionTemplateId} not found.`)
    }

    const prescribedExercises = tx
      .select({ planned: plannedExercise, exerciseName: exercise.name })
      .from(plannedExercise)
      .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
      .where(eq(plannedExercise.sessionTemplateId, workout.sessionTemplateId))
      .orderBy(asc(plannedExercise.orderIndex))
      .all()

    const savedSets = tx
      .select()
      .from(setLog)
      .where(eq(setLog.workoutLogId, input.workoutLogId))
      .orderBy(desc(setLog.loggedAt))
      .all()

    const savedSetsByPrescription = new Map<
      string,
      (typeof savedSets)[number]
    >()
    for (const savedSet of savedSets) {
      const key = `${savedSet.plannedExerciseId}:${savedSet.setNumber}`
      if (!savedSetsByPrescription.has(key)) {
        savedSetsByPrescription.set(key, savedSet)
      }
    }

    const setsByExercise = new Map<string, SetRecord[]>()
    for (const { planned, exerciseName } of prescribedExercises) {
      const exerciseSets: SetRecord[] = []

      for (let setNumber = 1; setNumber <= planned.sets; setNumber += 1) {
        const savedSet = savedSetsByPrescription.get(
          `${planned.id}:${setNumber}`
        )

        if (!savedSet) {
          throw new Error(
            `Workout ${input.workoutLogId} is incomplete: missing set ${setNumber} of ${planned.sets} for ${exerciseName}.`
          )
        }

        exerciseSets.push({
          setNumber: savedSet.setNumber,
          weightKg: savedSet.weightKg,
          reps: savedSet.reps,
          rirActual: savedSet.rirActual,
        })
      }

      setsByExercise.set(planned.id, exerciseSets)
    }

    tx.update(workoutLog)
      .set({ completedAt })
      .where(eq(workoutLog.id, input.workoutLogId))
      .run()

    const progressionChanges: ProgressionChange[] = []

    for (const { planned, exerciseName } of prescribedExercises) {
      const decision = computeProgression(
        {
          plannedExerciseId: planned.id,
          sets: planned.sets,
          repRange: planned.repRange,
          loadKg: planned.loadKg,
          rirTarget: planned.rirTarget,
        },
        setsByExercise.get(planned.id) ?? []
      )

      if (decision.kind !== "increase") continue

      const futureTemplates = tx
        .select({ id: sessionTemplate.id })
        .from(sessionTemplate)
        .where(
          and(
            eq(sessionTemplate.programId, template.programId),
            gt(sessionTemplate.weekNumber, template.weekNumber)
          )
        )
        .orderBy(asc(sessionTemplate.weekNumber))
        .all()

      for (const futureTemplate of futureTemplates) {
        const futureExercise = tx
          .select({ id: plannedExercise.id })
          .from(plannedExercise)
          .where(
            and(
              eq(plannedExercise.sessionTemplateId, futureTemplate.id),
              eq(plannedExercise.exerciseId, planned.exerciseId)
            )
          )
          .limit(1)
          .all()[0]

        if (!futureExercise) continue

        tx.update(plannedExercise)
          .set({ loadKg: decision.newLoadKg })
          .where(eq(plannedExercise.id, futureExercise.id))
          .run()
        break
      }

      progressionChanges.push({
        plannedExerciseId: planned.id,
        exerciseName,
        oldLoadKg: planned.loadKg,
        newLoadKg: decision.newLoadKg,
        reason: decision.reason,
      })
    }

    return {
      workoutLogId: input.workoutLogId,
      alreadyCompleted: false,
      progressionChanges,
    }
  })
}
