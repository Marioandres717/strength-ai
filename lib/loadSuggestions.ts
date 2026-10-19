import { fromKg, toKg } from "../src/lib/weightUnits"
import type { WeightUnit } from "../src/lib/weightUnits"
import type { LoadBasis } from "../src/types/session"
import { parseRepRangeLower } from "./rules"

export interface LoadHistory {
  workoutLogId: string
  completedAt: string
  sets: { weightKg: number; reps: number; rirActual: number | null }[]
}
export function suggestLoad(input: {
  baselineKg: number
  repRange: string
  rirTarget: number
  units: WeightUnit
  history?: LoadHistory | null
  modelLoadKg?: number
  now?: number
}): { loadKg: number; loadBasis: LoadBasis; loadHistoryAt: string | null } {
  const history = input.history?.sets.length ? input.history : null
  let load = input.baselineKg
  if (history) {
    const weights = history.sets.map((s) => s.weightKg).sort((a, b) => a - b)
    const mid = Math.floor(weights.length / 2)
    load =
      weights.length % 2 ? weights[mid] : (weights[mid - 1] + weights[mid]) / 2
    const stale =
      (input.now ?? Date.now()) - Date.parse(history.completedAt) >
      30 * 86400000
    const underTarget = history.sets.some(
      (s) =>
        s.reps < parseRepRangeLower(input.repRange) ||
        (s.rirActual ?? 0) < input.rirTarget
    )
    if (stale || underTarget) load *= 0.9
  }
  if (input.modelLoadKg !== undefined) load = Math.min(load, input.modelLoadKg)
  const increment = input.units === "lbs" ? 5 : 2.5
  const loadKg = toKg(
    Math.floor(
      (fromKg(Math.max(0, Math.min(500, load)), input.units) + 1e-9) / increment
    ) * increment,
    input.units
  )
  return {
    loadKg,
    loadBasis:
      load === 0 ? "bodyweight" : history ? "history" : "conservative_estimate",
    loadHistoryAt: history?.completedAt ?? null,
  }
}
