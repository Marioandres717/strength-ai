export type WeightUnit = "kg" | "lbs"

const KG_PER_LB = 0.45359237

export function fromKg(weightKg: number, unit: WeightUnit): number {
  return unit === "lbs" ? weightKg / KG_PER_LB : weightKg
}

export function toKg(weight: number, unit: WeightUnit): number {
  return unit === "lbs" ? weight * KG_PER_LB : weight
}

export function displayWeight(weightKg: number, unit: WeightUnit): number {
  const value = fromKg(weightKg, unit)
  return Math.round(value * 10) / 10
}

export function formatWeight(weightKg: number, unit: WeightUnit): string {
  return `${displayWeight(weightKg, unit)} ${unit}`
}
