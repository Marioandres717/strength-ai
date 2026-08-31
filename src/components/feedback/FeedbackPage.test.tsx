import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import type * as TanStackRouter from "@tanstack/react-router"
import { fireEvent, render, screen, waitFor } from "../../test/utils"
import { FeedbackPage } from "./FeedbackPage"

const { mockNavigate, mockSaveFeedbackFn } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSaveFeedbackFn: vi.fn(),
}))

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../../functions/saveFeedback", () => ({
  saveFeedbackFn: mockSaveFeedbackFn,
}))

function renderPage() {
  return render(
    <FeedbackPage
      workoutLogId="workout-1"
      sessionName="Lower A"
      progressionChanges={[
        {
          plannedExerciseId: "planned-1",
          exerciseName: "Back Squat",
          oldLoadKg: 100,
          newLoadKg: 102.5,
          reason: "Hit the top of the prescribed range.",
        },
      ]}
    />
  )
}

describe("FeedbackPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockSaveFeedbackFn.mockReset()
    mockSaveFeedbackFn.mockResolvedValue({ ok: true })
  })

  it("defaults fatigue to 3 out of 5 and keeps the progression summary visible", () => {
    renderPage()

    expect(screen.getByText("3 / 5")).toBeInTheDocument()
    expect(screen.getByText("Load Progressions")).toBeInTheDocument()
    expect(screen.getByText("Back Squat")).toBeInTheDocument()
    expect(screen.queryByText("Adaptive Coach Active")).not.toBeInTheDocument()
    expect(screen.queryByText("Muscle Soreness")).not.toBeInTheDocument()
  })

  it("submits the default fatigue and notes text", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(
      screen.getByRole("textbox", { name: "Training Notes" }),
      "Felt stable"
    )
    await user.click(screen.getByRole("button", { name: "Save & Finish" }))

    expect(mockSaveFeedbackFn).toHaveBeenCalledWith({
      data: {
        workoutLogId: "workout-1",
        fatigueRating: 3,
        notes: "Felt stable",
      },
    })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/" }))
  })

  it("submits updated fatigue values on the 1 to 5 scale", async () => {
    const user = userEvent.setup()
    renderPage()

    const slider = screen.getByRole("slider")

    slider.focus()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    await user.click(screen.getByRole("button", { name: "Save & Finish" }))

    const lastCall = mockSaveFeedbackFn.mock.calls.at(-1)
    expect(lastCall).toBeDefined()
    expect(lastCall?.[0]).toMatchObject({
      data: {
        fatigueRating: 5,
      },
    })
  })

  it("limits notes input to 2000 characters", () => {
    renderPage()

    const textbox = screen.getByRole("textbox", { name: "Training Notes" })
    fireEvent.change(textbox, {
      target: { value: "a".repeat(2500) },
    })

    expect(textbox).toHaveValue("a".repeat(2000))
  })

  it("shows a disabled saving state while persisting", async () => {
    const user = userEvent.setup()
    mockSaveFeedbackFn.mockReturnValue(new Promise(() => undefined))
    renderPage()

    await user.click(screen.getByRole("button", { name: "Save & Finish" }))

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled()
  })

  it("shows a visible alert and allows retry after a failed save", async () => {
    const user = userEvent.setup()
    mockSaveFeedbackFn
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: true })
    renderPage()

    await user.click(screen.getByRole("button", { name: "Save & Finish" }))

    expect(await screen.findByText("Save failed")).toBeInTheDocument()
    expect(
      screen.getByText("Failed to save feedback. Retry to finish the workout.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save & Finish" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Save & Finish" }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/" }))
  })
})
