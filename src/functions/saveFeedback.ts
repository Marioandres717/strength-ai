import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../lib/db"
import { workoutLog } from "../../lib/schema"

const inputSchema = z.object({
  workoutLogId: z.string().min(1),
  fatigueRating: z.number().int().min(1).max(10),
  notes: z.string().nullable(),
})

export const saveFeedbackFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await db
      .update(workoutLog)
      .set({
        fatigueRating: data.fatigueRating,
        notes: data.notes ?? null,
      })
      .where(eq(workoutLog.id, data.workoutLogId))

    return { ok: true }
  })
