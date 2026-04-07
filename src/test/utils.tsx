import { type ReactElement } from "react"
import { render, type RenderOptions } from "@testing-library/react"

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

// Re-export everything from testing-library
export * from "@testing-library/react"
export { customRender as render }
