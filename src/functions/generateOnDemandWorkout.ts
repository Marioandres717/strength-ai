import { createServerFn } from "@tanstack/react-start"
import { generateOnDemandWorkoutInputSchema } from "../types/on-demand-workout"
import { db } from "../../lib/db"
import { generateOnDemandWorkoutOperation } from "../../lib/onDemandWorkoutGeneration.server"
export const generateOnDemandWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    generateOnDemandWorkoutInputSchema.parse(data)
  )
  .handler(({ data }) => generateOnDemandWorkoutOperation(db, data))
