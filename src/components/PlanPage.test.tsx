import { describe, expect, it } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen } from "../test/utils"
import type { PlanDataState } from "../functions/getPlanData"
import { PlanPage } from "./PlanPage"

const data: Extract<PlanDataState, { kind: "active" }> = {
  kind: "active",
  currentWeek: 2,
  profile: {
    id: "profile-1",
    goal: "strength",
    experience: "beginner",
    equipment: ["barbell"],
    sessionsPerWeek: 3,
    sessionLengthMin: 60,
    customDirectives: null,
    units: "kg",
    userId: "user-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  program: {
    id: "program-1",
    name: "Strength Foundation",
    weeksTotal: 4,
    sessionsPerWeek: 3,
    status: "active",
    aiRationale: "A direct progression plan.",
    userId: "user-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  sessionsByWeek: {
    1: [],
    2: [
      {
        template: {
          id: "session-2",
          programId: "program-1",
          weekNumber: 2,
          dayLabel: "Lower B",
          focus: "hypertrophy",
          userId: "user-1",
          createdAt: new Date("2024-01-08T00:00:00Z"),
        },
        exercises: [
          {
            exercise: {
              id: "exercise-1",
              name: "Back Squat",
              movement: "squat",
              primaryMuscles: ["quads"],
              equipment: ["barbell"],
            },
            planned: {
              id: "planned-1",
              sessionTemplateId: "session-2",
              exerciseId: "exercise-1",
              orderIndex: 0,
              sets: 4,
              repRange: "6–8",
              loadKg: 80,
              rirTarget: 2,
              restSeconds: 150,
              coachNote: "Keep your chest tall through every rep.",
              userId: "user-1",
              createdAt: new Date("2024-01-08T00:00:00Z"),
            },
          },
        ],
      },
    ],
    3: [],
    4: [],
  },
}

describe("PlanPage", () => {
  it("selects the current week initially and switches weeks", async () => {
    const user = userEvent.setup()
    render(<PlanPage data={data} />)

    expect(screen.getByRole("tab", { name: "Week 2" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByText("Lower B")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Week 1" }))

    expect(screen.getByRole("heading", { name: "Week 1" })).toBeInTheDocument()
    expect(
      screen.getByText("No sessions are scheduled for this week.")
    ).toBeInTheDocument()
  })

  it("expands a session to show its prescription and coach note", async () => {
    const user = userEvent.setup()
    render(<PlanPage data={data} />)

    expect(
      screen.queryByText("4 × 6–8 · 80 kg · 2 RIR")
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "View session" }))

    expect(screen.getByText("4 × 6–8 · 80 kg · 2 RIR")).toBeInTheDocument()
    expect(screen.getByText("Rest 2:30")).toBeInTheDocument()
    const note = screen.getByText("Keep your chest tall through every rep.")
    expect(note).toBeInTheDocument()
    const coachNote = screen.getByTestId("coach-note-planned-1")
    if (!(coachNote instanceof HTMLDetailsElement)) {
      throw new Error("Coach note should render in a details element")
    }
    expect(coachNote.open).toBe(false)

    await user.click(screen.getByText("Coach note"))
    expect(coachNote.open).toBe(true)

    await user.click(screen.getByRole("button", { name: "Hide session" }))
    expect(screen.queryByText("Back Squat")).not.toBeInTheDocument()
  })
})
