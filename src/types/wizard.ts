export type Goal = "strength" | "hypertrophy" | "recomp" | "fat_loss"
export type EquipmentPreset =
  | "full_gym"
  | "dumbbells_only"
  | "home_gym"
  | "minimal"
export type Experience = "beginner" | "intermediate" | "advanced"
export type DaysPerWeek = 3 | 4 | 5 | 6
export type SessionLength = 45 | 60 | 90

export interface WizardData {
  goal?: Goal
  equipmentPreset?: EquipmentPreset
  experience?: Experience
  daysPerWeek?: DaysPerWeek
  sessionLengthMin?: SessionLength
  customDirectives?: string
}
