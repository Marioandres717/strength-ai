import { createServerFn } from "@tanstack/react-start"
import { startWorkoutInputSchema } from "../types/on-demand-workout"
import { db } from "../../lib/db"
import { startWorkoutOperation } from "../../lib/onDemandWorkouts.server"
export const startWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => startWorkoutInputSchema.parse(data))
  .handler(({ data }) => startWorkoutOperation(db, data))
