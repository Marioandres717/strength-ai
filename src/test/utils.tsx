import { type ReactElement } from "react"
import { render, type RenderOptions } from "@testing-library/react"
import type { WizardData } from "../types/wizard"

/**
 * Custom render function for testing
 * Can be extended with providers (Zustand, context) later
 */
export function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { ...options })
}

/** Builds a complete valid WizardData object for use in tests */
export function makeWizardData(overrides?: Partial<WizardData>): WizardData {
  return {
    goal: "strength",
    equipmentPreset: "full_gym",
    experience: "beginner",
    daysPerWeek: 3,
    sessionLengthMin: 45,
    ...overrides,
  }
}

// Re-export everything from testing-library
export * from "@testing-library/react"
export { customRender as render }
