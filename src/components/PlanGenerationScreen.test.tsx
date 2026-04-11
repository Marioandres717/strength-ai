import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act } from "../test/utils"
import { makeWizardData } from "../test/utils"
import { PlanGenerationScreen } from "./PlanGenerationScreen"

const { mockGeneratePlanFn } = vi.hoisted(() => ({
  mockGeneratePlanFn: vi.fn(),
}))

vi.mock("../functions/generatePlan", () => ({
  generatePlanFn: mockGeneratePlanFn,
}))

const STEP_LABELS = [
  "Analyzing variables",
  "Structuring progression",
  "Generating schedule",
] as const

// Find the indicator circle by its index (0, 1, or 2)
function getIndicator(stepLabel: (typeof STEP_LABELS)[number]): HTMLElement {
  return screen.getByTestId(`loading-step-${STEP_LABELS.indexOf(stepLabel)}`)
}

describe("PlanGenerationScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGeneratePlanFn.mockClear()
    mockGeneratePlanFn.mockReturnValue(new Promise<never>(() => undefined)) // never resolves by default
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  // ── Rendering ────────────────────────────────────────────────────────────────

  describe("initial render", () => {
    it("shows 'Building your program...' heading", () => {
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      expect(screen.getByText("Building your program...")).toBeInTheDocument()
    })

    it("renders all three loading step labels", () => {
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      expect(screen.getByText("Analyzing variables")).toBeInTheDocument()
      expect(screen.getByText("Structuring progression")).toBeInTheDocument()
      expect(screen.getByText("Generating schedule")).toBeInTheDocument()
    })

    it("first step is active (pulsing) at t=0", () => {
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      const indicator = getIndicator("Analyzing variables")
      expect(indicator).toHaveClass("animate-pulse")
      expect(indicator).not.toHaveClass("bg-accent")
    })

    it("second and third steps are inactive at t=0", () => {
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      const step2 = getIndicator("Structuring progression")
      const step3 = getIndicator("Generating schedule")
      expect(step2).not.toHaveClass("animate-pulse")
      expect(step2).not.toHaveClass("bg-accent")
      expect(step3).not.toHaveClass("animate-pulse")
      expect(step3).not.toHaveClass("bg-accent")
    })
  })

  // ── Timer-driven animation ────────────────────────────────────────────────────

  describe("animation timers", () => {
    it("marks first step complete after 1500ms", () => {
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(getIndicator("Analyzing variables")).toHaveClass("bg-accent")
    })

    it("marks first two steps complete after 3000ms", () => {
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(getIndicator("Analyzing variables")).toHaveClass("bg-accent")
      expect(getIndicator("Structuring progression")).toHaveClass("bg-accent")
      expect(getIndicator("Generating schedule")).not.toHaveClass("bg-accent")
    })
  })

  // ── On success ────────────────────────────────────────────────────────────────

  describe("on successful generation", () => {
    it("marks all three steps complete when promise resolves", async () => {
      mockGeneratePlanFn.mockResolvedValue({
        programId: "prog-1",
        profileId: "p1",
      })
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      // Flush the promise microtask WITHOUT advancing fake timers.
      // Animation timers (1500ms, 3000ms) must not fire here because they would
      // overwrite the [0,1,2] state set by the AI callback with [0] / [0,1].
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(getIndicator("Analyzing variables")).toHaveClass("bg-accent")
      expect(getIndicator("Structuring progression")).toHaveClass("bg-accent")
      expect(getIndicator("Generating schedule")).toHaveClass("bg-accent")
    })

    it("calls onSuccess with the programId after 600ms delay", async () => {
      mockGeneratePlanFn.mockResolvedValue({
        programId: "prog-abc",
        profileId: "p1",
      })
      const onSuccess = vi.fn()
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={onSuccess}
          onError={vi.fn()}
        />
      )
      await act(async () => {
        await vi.runAllTimersAsync()
      })
      expect(onSuccess).toHaveBeenCalledWith("prog-abc")
    })

    it("does not call onSuccess before the 600ms delay elapses", async () => {
      mockGeneratePlanFn.mockResolvedValue({
        programId: "prog-abc",
        profileId: "p1",
      })
      const onSuccess = vi.fn()
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={onSuccess}
          onError={vi.fn()}
        />
      )
      // Flush promise microtasks without advancing the 600ms timer
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })

  // ── On error ─────────────────────────────────────────────────────────────────

  describe("on failed generation", () => {
    it("calls onError with the error message when generatePlanFn rejects with an Error", async () => {
      mockGeneratePlanFn.mockRejectedValue(new Error("network failure"))
      const onError = vi.fn()
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={onError}
        />
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(onError).toHaveBeenCalledWith("network failure")
    })

    it("calls onError with fallback message when rejection is not an Error instance", async () => {
      mockGeneratePlanFn.mockRejectedValue("unexpected string")
      const onError = vi.fn()
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={onError}
        />
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(onError).toHaveBeenCalledWith("An unexpected error occurred.")
    })

    it("does not call onSuccess when generation fails", async () => {
      mockGeneratePlanFn.mockRejectedValue(new Error("failure"))
      const onSuccess = vi.fn()
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={onSuccess}
          onError={vi.fn()}
        />
      )
      await act(async () => {
        await vi.runAllTimersAsync()
      })
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })

  // ── Called-once guard ─────────────────────────────────────────────────────────

  describe("called-once guard", () => {
    it("calls generatePlanFn exactly once even when data prop changes", async () => {
      const { rerender } = render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      // Trigger a re-render with new data — the `called` ref should block a second call
      rerender(
        <PlanGenerationScreen
          data={makeWizardData({ goal: "hypertrophy" })}
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(mockGeneratePlanFn).toHaveBeenCalledOnce()
    })
  })
})
