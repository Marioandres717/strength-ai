import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act, waitFor, fireEvent } from "../test/utils"
import userEvent from "@testing-library/user-event"
import type * as TanstackRouter from "@tanstack/react-router"
import { OnboardingPage } from "../components/OnboardingPage"

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

const { mockGeneratePlanFn } = vi.hoisted(() => ({
  mockGeneratePlanFn: vi.fn(),
}))

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanstackRouter>()
  return {
    ...actual,
    useRouter: () => ({ navigate: mockNavigate }),
  }
})

vi.mock("../functions/generatePlan", () => ({
  generatePlanFn: mockGeneratePlanFn,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  const user = userEvent.setup()
  render(<OnboardingPage />)
  return { user }
}

async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Strength"))
  await user.click(screen.getByRole("button", { name: "Continue" }))
}

async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
  await goToStep2(user)
  await user.click(screen.getByText("Full Gym"))
  await user.click(screen.getByRole("button", { name: "Continue" }))
}

async function goToStep4(user: ReturnType<typeof userEvent.setup>) {
  await goToStep3(user)
  await user.click(screen.getByText("Intermediate"))
  await user.click(screen.getByRole("button", { name: "Continue" }))
}

async function goToStep5(user: ReturnType<typeof userEvent.setup>) {
  await goToStep4(user)
  // Select 4 days and 60 min
  await user.click(screen.getByText("4"))
  await user.click(screen.getByText("60"))
  await user.click(screen.getByRole("button", { name: "Continue" }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OnboardingPage wizard", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockGeneratePlanFn.mockClear()
    // Never-resolving promise by default so the loading screen doesn't advance
    mockGeneratePlanFn.mockReturnValue(new Promise<never>(() => undefined))
  })

  afterEach(() => {
    // Ensure fake timers never leak into subsequent tests
    vi.useRealTimers()
  })

  // ── Step 1 ──────────────────────────────────────────────────────────────────

  describe("Step 1 – Goal selection", () => {
    it("renders the step 1 heading", () => {
      setup()
      expect(screen.getByText("What's your goal?")).toBeInTheDocument()
    })

    it("renders all four goal options", () => {
      setup()
      expect(screen.getByText("Strength")).toBeInTheDocument()
      expect(screen.getByText("Hypertrophy")).toBeInTheDocument()
      expect(screen.getByText("Recomp")).toBeInTheDocument()
      expect(screen.getByText("Fat Loss")).toBeInTheDocument()
    })

    it("shows Close (X) button on step 1", () => {
      setup()
      expect(
        screen.getByRole("button", { name: "Close onboarding" })
      ).toBeInTheDocument()
    })

    it("navigates to '/' when Close button is clicked", async () => {
      const { user } = setup()
      await user.click(screen.getByRole("button", { name: "Close onboarding" }))
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" })
    })

    it("Continue button is disabled when no goal selected", () => {
      setup()
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("Continue button is enabled after selecting a goal", async () => {
      const { user } = setup()
      await user.click(screen.getByText("Strength"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    })

    it("selecting a new goal deselects the previous one", async () => {
      const { user } = setup()
      await user.click(screen.getByText("Strength"))
      await user.click(screen.getByText("Hypertrophy"))
      // Strength card should no longer be selected (its button loses border-accent)
      expect(screen.getByRole("button", { name: /Strength/ })).not.toHaveClass(
        "border-accent"
      )
      expect(screen.getByRole("button", { name: /Hypertrophy/ })).toHaveClass(
        "border-accent"
      )
    })

    it("StepIndicator shows 1 bar filled at step 1", () => {
      render(<OnboardingPage />)
      const bars = screen.getAllByTestId("step-bar")
      expect(bars[0]).toHaveClass("bg-accent")
      expect(bars[1]).not.toHaveClass("bg-accent")
    })
  })

  // ── Step 2 ──────────────────────────────────────────────────────────────────

  describe("Step 2 – Equipment selection", () => {
    it("navigates to step 2 after selecting a goal and clicking Continue", async () => {
      const { user } = setup()
      await goToStep2(user)
      expect(
        screen.getByText("What equipment do you have?")
      ).toBeInTheDocument()
    })

    it("renders all four equipment options", async () => {
      const { user } = setup()
      await goToStep2(user)
      expect(screen.getByText("Full Gym")).toBeInTheDocument()
      expect(screen.getByText("Dumbbells Only")).toBeInTheDocument()
      expect(screen.getByText("Home Gym")).toBeInTheDocument()
      expect(screen.getByText("Minimal Equipment")).toBeInTheDocument()
    })

    it("shows Back button (not Close) on step 2", async () => {
      const { user } = setup()
      await goToStep2(user)
      expect(
        screen.getByRole("button", { name: "Go back" })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Close onboarding" })
      ).not.toBeInTheDocument()
    })

    it("Continue button is disabled until equipment is selected", async () => {
      const { user } = setup()
      await goToStep2(user)
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("Continue button is enabled after selecting equipment", async () => {
      const { user } = setup()
      await goToStep2(user)
      await user.click(screen.getByText("Full Gym"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    })

    it("StepIndicator shows 2 bars filled at step 2", async () => {
      render(<OnboardingPage />)
      const user = userEvent.setup()
      await goToStep2(user)
      const bars = screen.getAllByTestId("step-bar")
      expect(bars[0]).toHaveClass("bg-accent")
      expect(bars[1]).toHaveClass("bg-accent")
      expect(bars[2]).not.toHaveClass("bg-accent")
    })

    it("Back button returns to step 1 and preserves the selected goal", async () => {
      const { user } = setup()
      await goToStep2(user)
      await user.click(screen.getByRole("button", { name: "Go back" }))
      // Back on step 1 - goal should still be selected
      expect(screen.getByText("What's your goal?")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Strength/ })).toHaveClass(
        "border-accent"
      )
    })
  })

  // ── Step 3 ──────────────────────────────────────────────────────────────────

  describe("Step 3 – Experience level", () => {
    it("navigates to step 3 after completing steps 1 and 2", async () => {
      const { user } = setup()
      await goToStep3(user)
      expect(screen.getByText("Your experience level")).toBeInTheDocument()
    })

    it("renders Beginner, Intermediate, Advanced with sublabels", async () => {
      const { user } = setup()
      await goToStep3(user)
      expect(screen.getByText("Beginner")).toBeInTheDocument()
      expect(
        screen.getByText("0-1 years of consistent lifting")
      ).toBeInTheDocument()
      expect(screen.getByText("Intermediate")).toBeInTheDocument()
      expect(
        screen.getByText("1-3 years of consistent lifting")
      ).toBeInTheDocument()
      expect(screen.getByText("Advanced")).toBeInTheDocument()
      expect(
        screen.getByText("3+ years of serious lifting")
      ).toBeInTheDocument()
    })

    it("Continue is disabled until experience is selected", async () => {
      const { user } = setup()
      await goToStep3(user)
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("Back returns to step 2 preserving equipment selection", async () => {
      const { user } = setup()
      await goToStep3(user)
      await user.click(screen.getByRole("button", { name: "Go back" }))
      expect(
        screen.getByText("What equipment do you have?")
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Full Gym/ })).toHaveClass(
        "border-accent"
      )
    })
  })

  // ── Step 4 ──────────────────────────────────────────────────────────────────

  describe("Step 4 – Schedule", () => {
    it("navigates to step 4 after completing steps 1-3", async () => {
      const { user } = setup()
      await goToStep4(user)
      expect(screen.getByText("Your schedule")).toBeInTheDocument()
    })

    it("renders ChipButtons for days: 3, 4, 5, 6", async () => {
      const { user } = setup()
      await goToStep4(user)
      expect(screen.getByText("3")).toBeInTheDocument()
      expect(screen.getByText("4")).toBeInTheDocument()
      expect(screen.getByText("5")).toBeInTheDocument()
      expect(screen.getByText("6")).toBeInTheDocument()
    })

    it("renders ChipButtons for session lengths: 45, 60, 90", async () => {
      const { user } = setup()
      await goToStep4(user)
      expect(screen.getByText("45")).toBeInTheDocument()
      expect(screen.getByText("60")).toBeInTheDocument()
      expect(screen.getByText("90")).toBeInTheDocument()
    })

    it("the 60 min chip has a 'popular' badge", async () => {
      const { user } = setup()
      await goToStep4(user)
      expect(screen.getByText("popular")).toBeInTheDocument()
    })

    it("Continue is disabled when neither days nor length is selected", async () => {
      const { user } = setup()
      await goToStep4(user)
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("Continue is disabled when only days is selected", async () => {
      const { user } = setup()
      await goToStep4(user)
      await user.click(screen.getByText("4"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("Continue is disabled when only session length is selected", async () => {
      const { user } = setup()
      await goToStep4(user)
      await user.click(screen.getByText("60"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("Continue is enabled when both days and session length are selected", async () => {
      const { user } = setup()
      await goToStep4(user)
      await user.click(screen.getByText("4"))
      await user.click(screen.getByText("60"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    })

    it("Back returns to step 3 preserving experience selection", async () => {
      const { user } = setup()
      await goToStep4(user)
      await user.click(screen.getByRole("button", { name: "Go back" }))
      expect(screen.getByText("Your experience level")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Intermediate/ })).toHaveClass(
        "border-accent"
      )
    })
  })

  // ── Step 5 ──────────────────────────────────────────────────────────────────

  describe("Step 5 – Custom directives", () => {
    it("navigates to step 5 after completing steps 1-4", async () => {
      const { user } = setup()
      await goToStep5(user)
      expect(screen.getByText("Anything else?")).toBeInTheDocument()
    })

    it("renders a textarea with placeholder text", async () => {
      const { user } = setup()
      await goToStep5(user)
      expect(screen.getByRole("textbox")).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/bad left knee/i)).toBeInTheDocument()
    })

    it("renders both Continue and Skip buttons", async () => {
      const { user } = setup()
      await goToStep5(user)
      expect(
        screen.getByRole("button", { name: "Continue" })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument()
    })

    it("Continue is enabled even with an empty textarea", async () => {
      const { user } = setup()
      await goToStep5(user)
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    })

    it("textarea reflects typed text", async () => {
      const { user } = setup()
      await goToStep5(user)
      const textarea = screen.getByRole("textbox")
      await user.type(textarea, "bad left knee")
      expect(textarea).toHaveValue("bad left knee")
    })

    it("Back returns to step 4 preserving schedule selections", async () => {
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Go back" }))
      expect(screen.getByText("Your schedule")).toBeInTheDocument()
      // The 4-day chip and 60-min chip should still be selected (aria-label set on ChipButton)
      expect(screen.getByRole("button", { name: "4 days" })).toHaveClass(
        "border-accent"
      )
      expect(screen.getByRole("button", { name: "60 min" })).toHaveClass(
        "border-accent"
      )
    })
  })

  // ── Loading transition ───────────────────────────────────────────────────────

  describe("Loading transition (Continue on step 5)", () => {
    it("transitions to loading screen when Continue is clicked", async () => {
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Continue" }))
      expect(screen.getByText("Building your program...")).toBeInTheDocument()
    })

    it("does not show the Continue/Skip buttons on the loading screen", async () => {
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Continue" }))
      expect(
        screen.queryByRole("button", { name: "Continue" })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Skip" })
      ).not.toBeInTheDocument()
    })

    it("passes customDirectives text to the loading screen", async () => {
      const { user } = setup()
      await goToStep5(user)
      const textarea = screen.getByRole("textbox")
      await user.type(textarea, "no leg press")
      await user.click(screen.getByRole("button", { name: "Continue" }))
      // generatePlanFn should eventually be called with customDirectives
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      const callArg = mockGeneratePlanFn.mock.calls[0]?.[0] as {
        data: { customDirectives?: string }
      }
      expect(callArg.data.customDirectives).toBe("no leg press")
    })
  })

  // ── Skip path ────────────────────────────────────────────────────────────────

  describe("Skip on step 5", () => {
    it("transitions to loading screen when Skip is clicked", async () => {
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Skip" }))
      expect(screen.getByText("Building your program...")).toBeInTheDocument()
    })

    it("passes undefined customDirectives when Skip is used", async () => {
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Skip" }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      const callArg = mockGeneratePlanFn.mock.calls[0]?.[0] as {
        data: { customDirectives?: string }
      }
      expect(callArg.data.customDirectives).toBeUndefined()
    })

    it("clears previously typed directives when Skip is used", async () => {
      const { user } = setup()
      await goToStep5(user)
      await user.type(screen.getByRole("textbox"), "some text")
      await user.click(screen.getByRole("button", { name: "Skip" }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      const callArg = mockGeneratePlanFn.mock.calls[0]?.[0] as {
        data: { customDirectives?: string }
      }
      expect(callArg.data.customDirectives).toBeUndefined()
    })
  })

  // ── Error recovery ───────────────────────────────────────────────────────────

  describe("Error recovery", () => {
    it("returns to step 5 when generatePlanFn rejects", async () => {
      mockGeneratePlanFn.mockRejectedValue(new Error("API failure"))
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Continue" }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(screen.getByText("Anything else?")).toBeInTheDocument()
    })

    it("displays the error message in the error box on step 5", async () => {
      mockGeneratePlanFn.mockRejectedValue(new Error("Something went boom"))
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Continue" }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(screen.getByText("Something went boom")).toBeInTheDocument()
    })

    it("shows Continue and Skip buttons again after an error", async () => {
      mockGeneratePlanFn.mockRejectedValue(new Error("Oops"))
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Continue" }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(
        screen.getByRole("button", { name: "Continue" })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument()
    })
  })

  // ── Success navigation ───────────────────────────────────────────────────────

  describe("Success navigation", () => {
    it("calls router.navigate({ to: '/' }) after successful plan generation", async () => {
      mockGeneratePlanFn.mockResolvedValue({
        programId: "prog-xyz",
        profileId: "p1",
      })
      const { user } = setup()
      await goToStep5(user)
      await user.click(screen.getByRole("button", { name: "Continue" }))
      // The 600ms onSuccess delay runs with real timers; waitFor polls until navigate fires
      await waitFor(
        () => expect(mockNavigate).toHaveBeenCalledWith({ to: "/" }),
        { timeout: 2000 }
      )
    })
  })

  // ── Data accumulation ────────────────────────────────────────────────────────

  describe("Data accumulation across all steps", () => {
    it("passes all wizard fields to generatePlanFn after completing all steps", async () => {
      const { user } = setup()

      // Step 1: Hypertrophy
      await user.click(screen.getByText("Hypertrophy"))
      await user.click(screen.getByRole("button", { name: "Continue" }))

      // Step 2: Dumbbells Only
      await user.click(screen.getByText("Dumbbells Only"))
      await user.click(screen.getByRole("button", { name: "Continue" }))

      // Step 3: Advanced
      await user.click(screen.getByText("Advanced"))
      await user.click(screen.getByRole("button", { name: "Continue" }))

      // Step 4: 5 days, 90 min
      await user.click(screen.getByText("5"))
      await user.click(screen.getByText("90"))
      await user.click(screen.getByRole("button", { name: "Continue" }))

      // Step 5: custom text + Continue (fireEvent.change is sync — avoids per-keystroke delay)
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "prefer compound movements" },
      })
      await user.click(screen.getByRole("button", { name: "Continue" }))

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockGeneratePlanFn).toHaveBeenCalledWith({
        data: {
          goal: "hypertrophy",
          equipmentPreset: "dumbbells_only",
          experience: "advanced",
          daysPerWeek: 5,
          sessionLengthMin: 90,
          customDirectives: "prefer compound movements",
        },
      })
    })
  })

  // ── Back navigation guard ────────────────────────────────────────────────────

  describe("Back navigation guard", () => {
    it("Back button is not shown on step 1", () => {
      setup()
      expect(
        screen.queryByRole("button", { name: "Go back" })
      ).not.toBeInTheDocument()
    })

    it("pressing Back multiple times from step 2 stops at step 1", async () => {
      const { user } = setup()
      await goToStep2(user)
      // Go back to step 1
      await user.click(screen.getByRole("button", { name: "Go back" }))
      // Step 1 shows Close button, not Back
      expect(
        screen.queryByRole("button", { name: "Go back" })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Close onboarding" })
      ).toBeInTheDocument()
    })
  })
})
