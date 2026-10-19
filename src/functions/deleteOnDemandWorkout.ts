import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { deleteOnDemandWorkoutOperation } from "../../lib/onDemandWorkouts.server"
export const deleteOnDemandWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ onDemandWorkoutId: z.uuid() }).parse(data)
  )
  .handler(({ data }) =>
    deleteOnDemandWorkoutOperation(db, data.onDemandWorkoutId)
  )
