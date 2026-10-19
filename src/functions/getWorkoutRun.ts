import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { getWorkoutRunOperation } from "../../lib/onDemandWorkouts.server"
export const getWorkoutRunFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ workoutLogId: z.string().min(1) }).parse(data)
  )
  .handler(({ data }) => getWorkoutRunOperation(db, data.workoutLogId))
