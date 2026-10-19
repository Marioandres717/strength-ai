import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { getOnDemandWorkoutGenerationOperation } from "../../lib/onDemandWorkoutGeneration.server"
export const getOnDemandWorkoutGenerationFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ requestId: z.uuid() }).parse(data)
  )
  .handler(({ data }) =>
    getOnDemandWorkoutGenerationOperation(db, data.requestId)
  )
