import { describe, it, expect } from "vitest"
import { render, screen } from "../../test/utils"
import type { SessionWithExercises } from "../../functions/getDashboardData"
import type {
  SelectSessionTemplate,
  SelectExercise,
  SelectPlannedExercise,
} from "../../../lib/schema"
import { NextSessionCard } from "./NextSessionCard"

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTemplate(
  overrides?: Partial<SelectSessionTemplate>
): SelectSessionTemplate {
  return {
    id: "tmpl-1",
    programId: "prog-1",
    weekNumber: 1,
    dayLabel: "Upper A",
    focus: "strength",
    userId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  }
}

function makeExercise(id: string, name: string): SelectExercise {
  return {
    id,
    name,
    movement: "push",
    primaryMuscles: ["chest"],
    equipment: ["barbell"],
  }
}

function makePlanned(
  id: string,
  templateId: string,
  orderIndex: number
): SelectPlannedExercise {
  return {
    id,
    sessionTemplateId: templateId,
    exerciseId: id,
    orderIndex,
    sets: 4,
    repRange: "4-6",
    loadKg: 80,
    rirTarget: 2,
    restSeconds: 180,
    coachNote: null,
    userId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  }
}

function makeSession(
  exerciseNames: string[],
  overrides?: Partial<SelectSessionTemplate>
): SessionWithExercises {
  const template = makeTemplate(overrides)
  return {
    template,
    exercises: exerciseNames.map((name, i) => ({
      exercise: makeExercise(`ex-${i}`, name),
      planned: makePlanned(`ex-${i}`, template.id, i),
    })),
    workoutLog: null,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NextSessionCard", () => {
  describe("session metadata", () => {
    it("renders the session day label", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat", "Bench Press"], {
            dayLabel: "Upper A",
          })}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("Upper A")).toBeInTheDocument()
    })

    it("renders estimated duration", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat"], { dayLabel: "Lower A" })}
          sessionLengthMin={60}
        />
      )
      expect(screen.getByText("~60 min")).toBeInTheDocument()
    })
  })

  describe("focus badge", () => {
    it("renders 'Strength' badge for strength focus", () => {
      render(
        <NextSessionCard
          session={makeSession([], { focus: "strength" })}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("Strength")).toBeInTheDocument()
    })

    it("renders 'Hypertrophy' badge for hypertrophy focus", () => {
      render(
        <NextSessionCard
          session={makeSession([], { focus: "hypertrophy" })}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("Hypertrophy")).toBeInTheDocument()
    })

    it("renders 'Mixed' badge for mixed focus", () => {
      render(
        <NextSessionCard
          session={makeSession([], { focus: "mixed" })}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("Mixed")).toBeInTheDocument()
    })
  })

  describe("exercise chips", () => {
    it("renders up to 3 exercise chips by name", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat", "Bench Press", "Row"])}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("Squat")).toBeInTheDocument()
      expect(screen.getByText("Bench Press")).toBeInTheDocument()
      expect(screen.getByText("Row")).toBeInTheDocument()
    })

    it("does not show '+N more' when exercises are exactly 3", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat", "Bench Press", "Row"])}
          sessionLengthMin={45}
        />
      )
      expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
    })

    it("shows '+1 more' chip when there are 4 exercises", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat", "Bench Press", "Row", "Curl"])}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("+1 more")).toBeInTheDocument()
      // 4th exercise name should not appear as a chip
      expect(screen.queryByText("Curl")).not.toBeInTheDocument()
    })

    it("shows '+3 more' chip when there are 6 exercises", () => {
      render(
        <NextSessionCard
          session={makeSession(["A", "B", "C", "D", "E", "F"])}
          sessionLengthMin={45}
        />
      )
      expect(screen.getByText("+3 more")).toBeInTheDocument()
    })

    it("renders set×repRange label on each visible chip", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat"])}
          sessionLengthMin={45}
        />
      )
      // makePlanned generates sets=4, repRange="4-6"
      expect(screen.getByText("4×4-6")).toBeInTheDocument()
    })
  })

  describe("Start Session link", () => {
    it("renders 'Start Session →' link pointing to the session route with template id", () => {
      render(
        <NextSessionCard
          session={makeSession(["Squat"], { id: "tmpl-abc" })}
          sessionLengthMin={45}
        />
      )
      const link = screen.getByRole("link", { name: /start session/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/session/tmpl-abc")
    })
  })
})
