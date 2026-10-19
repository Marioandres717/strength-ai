import { parseRepRangeUpper } from "./rules"

export const DURATION_POLICY_VERSION = 1
export function estimateOnDemandWorkoutDuration(
  exercises: { sets: number; repRange: string; restSeconds: number }[]
): number {
  if (!exercises.length) throw new Error("A workout must contain an exercise.")
  return (
    300 +
    exercises.reduce(
      (sum, ex, index) =>
        sum +
        ex.sets * parseRepRangeUpper(ex.repRange) * 4 +
        (ex.sets - (index === exercises.length - 1 ? 1 : 0)) * ex.restSeconds,
      0
    ) +
    60 * (exercises.length - 1)
  )
}
