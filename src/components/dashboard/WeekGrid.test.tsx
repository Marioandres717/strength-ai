import { describe, it, expect } from "vitest"
import { render, screen } from "../../test/utils"
import type { SessionWithExercises } from "../../functions/getDashboardData"
import type {
  SelectSessionTemplate,
  SelectWorkoutLog,
} from "../../../lib/schema"
import { WeekGrid } from "./WeekGrid"

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTemplate(
  id: string,
  dayLabel: string,
  overrides?: Partial<SelectSessionTemplate>
): SelectSessionTemplate {
  return {
    id,
    programId: "prog-1",
    weekNumber: 1,
    dayLabel,
    focus: "strength",
    userId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  }
}

function makeCompletedLog(templateId: string): SelectWorkoutLog {
  return {
    id: `log-${templateId}`,
    sessionTemplateId: templateId,
    startedAt: new Date("2024-01-08T09:00:00Z"),
    completedAt: new Date("2024-01-08T10:00:00Z"),
    fatigueRating: null,
    notes: null,
    userId: null,
    createdAt: new Date("2024-01-08T09:00:00Z"),
  }
}

function makeIncompleteLog(templateId: string): SelectWorkoutLog {
  return {
    id: `log-${templateId}`,
    sessionTemplateId: templateId,
    startedAt: new Date("2024-01-08T09:00:00Z"),
    completedAt: null,
    fatigueRating: null,
    notes: null,
    userId: null,
    createdAt: new Date("2024-01-08T09:00:00Z"),
  }
}

function makeSession(
  id: string,
  dayLabel: string,
  workoutLog: SelectWorkoutLog | null = null,
  templateOverrides?: Partial<SelectSessionTemplate>
): SessionWithExercises {
  return {
    template: makeTemplate(id, dayLabel, templateOverrides),
    exercises: [],
    workoutLog,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("WeekGrid", () => {
  describe("focus labels", () => {
    it("renders focus label for each session", () => {
      const sessions = [
        makeSession("s1", "Upper A", null, { focus: "strength" }),
        makeSession("s2", "Lower B", null, { focus: "hypertrophy" }),
        makeSession("s3", "Push C", null, { focus: "mixed" }),
      ]
      render(<WeekGrid sessions={sessions} nextSession={null} />)

      expect(screen.getByText("Strength")).toBeInTheDocument()
      expect(screen.getByText("Hypertrophy")).toBeInTheDocument()
      expect(screen.getByText("Mixed")).toBeInTheDocument()
    })
  })

  describe("session status labels", () => {
    it("shows 'Done' for a session with a completed workout log", () => {
      const completed = makeSession("s1", "Upper A", makeCompletedLog("s1"))
      render(<WeekGrid sessions={[completed]} nextSession={null} />)
      expect(screen.getByText("Done")).toBeInTheDocument()
    })

    it("shows 'Next' for the session that matches nextSession", () => {
      const session = makeSession("s1", "Upper A")
      render(<WeekGrid sessions={[session]} nextSession={session} />)
      expect(screen.getByText("Next")).toBeInTheDocument()
    })

    it("shows 'Missed' for a past uncompleted session before the next one", () => {
      const skipped = makeSession("s1", "Upper A", makeIncompleteLog("s1"))
      const next = makeSession("s2", "Lower B")
      render(<WeekGrid sessions={[skipped, next]} nextSession={next} />)
      // s1 is before s2 (the next session) and has no completedAt → "Missed"
      expect(screen.getByText("Missed")).toBeInTheDocument()
    })

    it("shows '—' for future sessions after the next session", () => {
      const next = makeSession("s1", "Upper A")
      const future = makeSession("s2", "Lower B")
      render(<WeekGrid sessions={[next, future]} nextSession={next} />)
      expect(screen.getByText("—")).toBeInTheDocument()
    })

    it("shows '—' for all sessions when nextSession is null and none are completed", () => {
      const s1 = makeSession("s1", "Upper A")
      const s2 = makeSession("s2", "Lower B")
      render(<WeekGrid sessions={[s1, s2]} nextSession={null} />)
      const dashes = screen.getAllByText("—")
      expect(dashes).toHaveLength(2)
    })
  })

  describe("'next' cell styling", () => {
    it("applies border-accent class to the cell with 'next' status", () => {
      const next = makeSession("s1", "Upper A")
      const future = makeSession("s2", "Lower B")
      render(<WeekGrid sessions={[next, future]} nextSession={next} />)

      // data-status="next" is set on the next cell
      const nextCell = screen.getByTestId("week-grid-cell-next")
      expect(nextCell.className).toMatch(/border-accent/)
    })

    it("does not apply border-accent to a non-next cell", () => {
      const next = makeSession("s1", "Upper A")
      const future = makeSession("s2", "Lower B")
      render(<WeekGrid sessions={[next, future]} nextSession={next} />)

      const upcomingCell = screen.getByTestId("week-grid-cell-upcoming")
      expect(upcomingCell.className).not.toMatch(/border-accent/)
    })
  })

  describe("completed + next combination", () => {
    it("shows 'Done', 'Next', and '—' for a mixed week", () => {
      const done = makeSession("s1", "Upper A", makeCompletedLog("s1"))
      const next = makeSession("s2", "Lower B")
      const upcoming = makeSession("s3", "Push C")
      render(<WeekGrid sessions={[done, next, upcoming]} nextSession={next} />)
      expect(screen.getByText("Done")).toBeInTheDocument()
      expect(screen.getByText("Next")).toBeInTheDocument()
      expect(screen.getByText("—")).toBeInTheDocument()
    })
  })
})
