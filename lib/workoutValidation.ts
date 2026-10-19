/** Device timestamps are allowed five minutes of future skew. */
export function validateWorkoutTimestamp(value: Date, earliest?: Date): void {
  const timestamp = value.getTime()
  if (
    !Number.isFinite(timestamp) ||
    timestamp > Date.now() + 300_000 ||
    timestamp < Date.UTC(2020, 0, 1) ||
    (earliest && timestamp < earliest.getTime())
  ) {
    throw new Error(
      "Workout clock conflict. Check this device's time and retry sync."
    )
  }
}
