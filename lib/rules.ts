// ---------------------------------------------------------------------------
// Progression rule engine — pure functions, no DB access
// ---------------------------------------------------------------------------

export interface SetRecord {
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number | null
}

export interface ExercisePrescription {
  plannedExerciseId: string
  sets: number
  /** e.g. "4-6" or "8–12" (hyphen or en-dash both supported) */
  repRange: string
  loadKg: number
  rirTarget: number
}

export type ProgressionDecision =
  | { kind: "increase"; newLoadKg: number; reason: string }
  | { kind: "maintain"; reason: string }

/**
 * Parse the upper bound from a rep range string.
 * Handles hyphen "-" and en-dash "–" separators.
 * If only one number is provided (e.g. "5"), that is both lower and upper.
 */
export function parseRepRangeUpper(repRange: string): number {
  const parts = repRange.split(/[-–]/)
  if (parts.length === 1) {
    const n = parseInt(parts[0].trim(), 10)
    if (isNaN(n)) throw new Error(`Invalid rep range: "${repRange}"`)
    return n
  }
  const upper = parseInt(parts[1].trim(), 10)
  if (isNaN(upper)) throw new Error(`Invalid rep range: "${repRange}"`)
  return upper
}

/**
 * Parse the lower bound from a rep range string.
 */
export function parseRepRangeLower(repRange: string): number {
  const parts = repRange.split(/[-–]/)
  const lower = parseInt(parts[0].trim(), 10)
  if (isNaN(lower)) throw new Error(`Invalid rep range: "${repRange}"`)
  return lower
}

/**
 * Determine whether load should increase for one exercise based on
 * the sets logged this session.
 *
 * Rules:
 * - If no sets recorded → maintain
 * - Every set must have hit reps >= upper bound of repRange
 * - Every set must have rirActual >= rirTarget (null rirActual → fail)
 * - If both conditions met → increase by 2.5 kg
 * - Otherwise → maintain
 */
export function computeProgression(
  prescription: ExercisePrescription,
  sets: SetRecord[]
): ProgressionDecision {
  if (sets.length === 0) {
    return { kind: "maintain", reason: "No sets recorded for this exercise." }
  }

  const upperBound = parseRepRangeUpper(prescription.repRange)

  for (const s of sets) {
    if (s.reps < upperBound) {
      return {
        kind: "maintain",
        reason: `Set ${s.setNumber}: ${s.reps} reps did not reach the target upper bound of ${upperBound}.`,
      }
    }
    if (s.rirActual === null) {
      return {
        kind: "maintain",
        reason: `Set ${s.setNumber}: RIR not recorded — cannot assess readiness to progress.`,
      }
    }
    if (s.rirActual < prescription.rirTarget) {
      return {
        kind: "maintain",
        reason: `Set ${s.setNumber}: RIR ${s.rirActual} was below target ${prescription.rirTarget}.`,
      }
    }
  }

  const newLoad = Math.round((prescription.loadKg + 2.5) * 100) / 100
  return {
    kind: "increase",
    newLoadKg: newLoad,
    reason: `All ${sets.length} sets hit ${upperBound}+ reps with RIR ≥ ${prescription.rirTarget}. Load increased from ${prescription.loadKg} kg to ${newLoad} kg.`,
  }
}
