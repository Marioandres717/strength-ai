import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { getOnDemandWorkoutOperation } from "../../lib/onDemandWorkouts.server"
export const getOnDemandWorkoutFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ onDemandWorkoutId: z.uuid() }).parse(data)
  )
  .handler(({ data }) =>
    getOnDemandWorkoutOperation(db, data.onDemandWorkoutId)
  )
