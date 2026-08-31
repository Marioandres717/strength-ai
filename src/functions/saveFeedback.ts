import { createServerFn } from "@tanstack/react-start"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../lib/db"
import type * as schema from "../../lib/schema"
import { workoutLog } from "../../lib/schema"

const normalizedNotesSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().max(2000).nullable()
  )
  .transform((value) => {
    if (value == null || value.length === 0) {
      return null
    }

    return value
  })

export const saveFeedbackInputSchema = z.object({
  workoutLogId: z.string().min(1),
  fatigueRating: z.number().int().min(1).max(5),
  notes: normalizedNotesSchema,
})

export type SaveFeedbackInput = z.infer<typeof saveFeedbackInputSchema>

export async function saveFeedbackOperation(
  database: BetterSQLite3Database<typeof schema>,
  data: SaveFeedbackInput
): Promise<{ ok: boolean }> {
  const logs = await database
    .select({
      id: workoutLog.id,
      completedAt: workoutLog.completedAt,
    })
    .from(workoutLog)
    .where(eq(workoutLog.id, data.workoutLogId))
    .limit(1)

  if (logs.length === 0) {
    throw new Error(`Workout log not found: ${data.workoutLogId}`)
  }

  if (logs[0].completedAt == null) {
    throw new Error("Workout feedback is only available after completion.")
  }

  await database
    .update(workoutLog)
    .set({
      fatigueRating: data.fatigueRating,
      notes: data.notes,
    })
    .where(eq(workoutLog.id, data.workoutLogId))

  return { ok: true }
}

export const saveFeedbackFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveFeedbackInputSchema.parse(data))
  .handler(({ data }) => saveFeedbackOperation(db, data))
