import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { logSetOperation } from "./logSet.server"

export type { LogSetResult } from "./logSet.server"

const inputSchema = z.object({
  workoutLogId: z.string().min(1),
  plannedExerciseId: z.string().min(1),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0),
  reps: z.number().int().min(1).max(100),
  rirActual: z.number().int().min(0).max(10),
  loggedAt: z.string().datetime({ offset: true }),
})

export const logSetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) =>
    logSetOperation(db, {
      ...data,
      loggedAt: new Date(data.loggedAt),
    })
  )
