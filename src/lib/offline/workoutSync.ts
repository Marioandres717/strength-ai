import { createClientOnlyFn } from "@tanstack/react-start"
import * as client from "./workoutSync.client"
export const startWorkoutSync = createClientOnlyFn(() =>
  client.startWorkoutSync()
)
export const retryWorkoutSync = createClientOnlyFn(() =>
  client.retryWorkoutSync()
)
