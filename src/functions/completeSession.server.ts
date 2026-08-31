import { and, asc, desc, eq, gt } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import {
  exercise,
  plannedExercise,
  sessionTemplate,
  setLog,
  workoutLog,
} from "../../lib/schema"
import type * as workoutSchema from "../../lib/schema"
import { computeProgression, type SetRecord } from "../../lib/rules"

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
  sessionTemplateId: string
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

    if (workout.sessionTemplateId !== input.sessionTemplateId) {
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

    const template = tx
      .select()
      .from(sessionTemplate)
      .where(eq(sessionTemplate.id, input.sessionTemplateId))
      .limit(1)
      .all()[0]

    if (!template) {
      throw new Error(`Session template ${input.sessionTemplateId} not found.`)
    }

    const prescribedExercises = tx
      .select({ planned: plannedExercise, exerciseName: exercise.name })
      .from(plannedExercise)
      .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
      .where(eq(plannedExercise.sessionTemplateId, input.sessionTemplateId))
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
      .set({ completedAt: new Date() })
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
