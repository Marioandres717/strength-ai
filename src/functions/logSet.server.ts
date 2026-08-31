import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { plannedExercise, setLog, workoutLog } from "../../lib/schema"
import type * as workoutSchema from "../../lib/schema"

type WorkoutDatabase = BetterSQLite3Database<typeof workoutSchema>

export interface LogSetInput {
  workoutLogId: string
  plannedExerciseId: string
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

    if (workout.completedAt !== null) {
      throw new Error(`Workout log ${input.workoutLogId} is already completed.`)
    }

    const planned = tx
      .select()
      .from(plannedExercise)
      .where(
        and(
          eq(plannedExercise.id, input.plannedExerciseId),
          eq(plannedExercise.sessionTemplateId, workout.sessionTemplateId)
        )
      )
      .limit(1)
      .all()[0]

    if (!planned) {
      throw new Error(
        `Planned exercise ${input.plannedExerciseId} does not belong to workout ${input.workoutLogId}.`
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
          eq(setLog.plannedExerciseId, input.plannedExerciseId),
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
        plannedExerciseId: input.plannedExerciseId,
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
