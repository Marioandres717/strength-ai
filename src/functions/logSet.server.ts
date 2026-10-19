import type { PrescriptionRef } from "../types/session"
import { validateWorkoutTimestamp } from "../../lib/workoutValidation"
import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import {
  onDemandWorkoutExercise,
  plannedExercise,
  setLog,
  workoutLog,
} from "../../lib/schema"
import type * as workoutSchema from "../../lib/schema"

type WorkoutDatabase = BetterSQLite3Database<typeof workoutSchema>

export interface LogSetInput {
  workoutLogId: string
  plannedExerciseId?: string
  prescriptionRef?: PrescriptionRef
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
}

export interface LogSetResult {
  setLogId: string
  alreadyExisted: boolean
}

export function logSetOperation(
  database: WorkoutDatabase,
  input: LogSetInput
): LogSetResult {
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

    const ref =
      input.prescriptionRef ??
      (input.plannedExerciseId
        ? {
            kind: "planned" as const,
            plannedExerciseId: input.plannedExerciseId,
          }
        : null)
    if (!ref) throw new Error("Prescription reference required.")
    if (ref.kind === "on_demand_workout") {
      const prescription = tx
        .select()
        .from(onDemandWorkoutExercise)
        .where(eq(onDemandWorkoutExercise.id, ref.onDemandWorkoutExerciseId))
        .get()
      if (
        prescription?.onDemandWorkoutRevisionId !==
          workout.onDemandWorkoutRevisionId ||
        prescription.userId !== workout.userId
      )
        throw new Error("Exercise does not belong to this workout revision.")
      if (
        !Number.isInteger(input.setNumber) ||
        input.setNumber < 1 ||
        input.setNumber > prescription.sets
      )
        throw new Error("Set exceeds prescribed count.")
      validateWorkoutTimestamp(input.loggedAt, workout.startedAt)
      const existing = tx
        .select()
        .from(setLog)
        .where(
          and(
            eq(setLog.workoutLogId, workout.id),
            eq(setLog.onDemandWorkoutExerciseId, prescription.id),
            eq(setLog.setNumber, input.setNumber)
          )
        )
        .get()
      if (existing) {
        if (
          existing.weightKg !== input.weightKg ||
          existing.reps !== input.reps ||
          existing.rirActual !== input.rirActual ||
          existing.loggedAt.getTime() !==
            Math.floor(input.loggedAt.getTime() / 1000) * 1000
        )
          throw new Error("Committed set conflicts with the saved values.")
        return { setLogId: existing.id, alreadyExisted: true }
      }
      if (workout.completedAt) throw new Error("Workout is already completed.")
      const id = randomUUID()
      tx.insert(setLog)
        .values({
          id,
          workoutLogId: workout.id,
          onDemandWorkoutExerciseId: prescription.id,
          setNumber: input.setNumber,
          weightKg: input.weightKg,
          reps: input.reps,
          rirActual: input.rirActual,
          loggedAt: input.loggedAt,
          userId: workout.userId,
        })
        .run()
      return { setLogId: id, alreadyExisted: false }
    }
    if (!workout.sessionTemplateId) throw new Error("Wrong workout source.")
    const plannedExerciseId = ref.plannedExerciseId
    if (workout.completedAt !== null) {
      throw new Error(`Workout log ${input.workoutLogId} is already completed.`)
    }

    const planned = tx
      .select()
      .from(plannedExercise)
      .where(
        and(
          eq(plannedExercise.id, plannedExerciseId),
          eq(plannedExercise.sessionTemplateId, workout.sessionTemplateId)
        )
      )
      .limit(1)
      .all()[0]

    if (!planned) {
      throw new Error(
        `Planned exercise ${plannedExerciseId} does not belong to workout ${input.workoutLogId}.`
      )
    }

    if (input.setNumber > planned.sets) {
      throw new Error(
        `Set ${input.setNumber} exceeds the ${planned.sets} prescribed sets for planned exercise ${planned.id}.`
      )
    }

    const existing = tx
      .select({ id: setLog.id })
      .from(setLog)
      .where(
        and(
          eq(setLog.workoutLogId, input.workoutLogId),
          eq(setLog.plannedExerciseId, plannedExerciseId),
          eq(setLog.setNumber, input.setNumber)
        )
      )
      .limit(1)
      .all()[0]

    if (existing) {
      return { setLogId: existing.id, alreadyExisted: true }
    }

    const setLogId = randomUUID()
    tx.insert(setLog)
      .values({
        id: setLogId,
        workoutLogId: input.workoutLogId,
        plannedExerciseId,
        setNumber: input.setNumber,
        weightKg: input.weightKg,
        reps: input.reps,
        rirActual: input.rirActual,
        loggedAt: input.loggedAt,
        userId: workout.userId,
      })
      .run()

    return { setLogId, alreadyExisted: false }
  })
}
