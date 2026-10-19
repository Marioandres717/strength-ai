import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { listOnDemandWorkoutGenerationsOperation } from "../../lib/onDemandWorkoutGeneration.server"
export const listOnDemandWorkoutGenerationsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(20).optional() }).parse(data)
  )
  .handler(({ data }) =>
    listOnDemandWorkoutGenerationsOperation(db, data.limit)
  )
