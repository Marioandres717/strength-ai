import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../lib/db"
import { setLog, workoutLog } from "../../lib/schema"

const inputSchema = z.object({
  workoutLogId: z.string().min(1),
  plannedExerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(20),
  weightKg: z.number().min(0),
  reps: z.number().int().min(1).max(100),
  rirActual: z.number().int().min(0).max(10),
  loggedAt: z.string(), // ISO string
})

export interface LogSetResult {
  setLogId: string
}

export const logSetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<LogSetResult> => {
    // Verify workout log exists and is still in progress
    const logs = await db
      .select()
      .from(workoutLog)
      .where(
        and(
          eq(workoutLog.id, data.workoutLogId),
          isNull(workoutLog.completedAt)
        )
      )
      .limit(1)

    if (logs.length === 0) {
      throw new Error(
        `Workout log ${data.workoutLogId} not found or already completed.`
      )
    }

    const setLogId = crypto.randomUUID()
    await db.insert(setLog).values({
      id: setLogId,
      workoutLogId: data.workoutLogId,
      plannedExerciseId: data.plannedExerciseId,
      setNumber: data.setNumber,
      weightKg: data.weightKg,
      reps: data.reps,
      rirActual: data.rirActual,
      loggedAt: new Date(data.loggedAt),
    })

    return { setLogId }
  })
