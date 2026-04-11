import { describe, it, expect } from "vitest"
import { render } from "../test/utils"
import { StepIndicator } from "./StepIndicator"

function getBars(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-testid="step-bar"]'))
}

describe("StepIndicator", () => {
  it("renders exactly 5 bar segments", () => {
    const { container } = render(<StepIndicator current={1} />)
    expect(getBars(container)).toHaveLength(5)
  })

  it("fills 1 bar at step 1", () => {
    const { container } = render(<StepIndicator current={1} />)
    const bars = getBars(container)
    expect(bars[0]).toHaveClass("bg-accent")
    expect(bars[1]).not.toHaveClass("bg-accent")
    expect(bars[2]).not.toHaveClass("bg-accent")
  })

  it("fills 2 bars at step 2", () => {
    const { container } = render(<StepIndicator current={2} />)
    const bars = getBars(container)
    expect(bars[0]).toHaveClass("bg-accent")
    expect(bars[1]).toHaveClass("bg-accent")
    expect(bars[2]).not.toHaveClass("bg-accent")
  })

  it("fills 3 bars at step 3", () => {
    const { container } = render(<StepIndicator current={3} />)
    const bars = getBars(container)
    expect(bars[2]).toHaveClass("bg-accent")
    expect(bars[3]).not.toHaveClass("bg-accent")
  })

  it("fills 4 bars at step 4", () => {
    const { container } = render(<StepIndicator current={4} />)
    const bars = getBars(container)
    expect(bars[3]).toHaveClass("bg-accent")
    expect(bars[4]).not.toHaveClass("bg-accent")
  })

  it("fills all 5 bars at step 5", () => {
    const { container } = render(<StepIndicator current={5} />)
    const bars = getBars(container)
    bars.forEach((bar) => expect(bar).toHaveClass("bg-accent"))
  })
})
