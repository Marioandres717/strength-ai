import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { retryOnDemandWorkoutSaveOperation } from "../../lib/onDemandWorkoutGeneration.server"
export const retryOnDemandWorkoutSaveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ requestId: z.uuid() }).parse(data)
  )
  .handler(({ data }) => retryOnDemandWorkoutSaveOperation(db, data.requestId))
