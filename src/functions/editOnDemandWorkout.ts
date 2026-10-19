import { createServerFn } from "@tanstack/react-start"
import { editOnDemandWorkoutInputSchema } from "../types/on-demand-workout"
import { db } from "../../lib/db"
import { editOnDemandWorkoutOperation } from "../../lib/onDemandWorkouts.server"
export const editOnDemandWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => editOnDemandWorkoutInputSchema.parse(data))
  .handler(({ data }) => editOnDemandWorkoutOperation(db, data))
