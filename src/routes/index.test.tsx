import { describe, it, expect, vi } from "vitest"
import { render, screen } from "../test/utils"
import type * as TanstackRouter from "@tanstack/react-router"
import type {
  DashboardState,
  SessionWithExercises,
} from "../functions/getDashboardData"
import type {
  SelectProgram,
  SelectUserProfile,
  SelectSessionTemplate,
  SelectWorkoutLog,
} from "../../lib/schema"
import { DashboardPage } from "../components/DashboardPage"

// ─── Router mock ─────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanstackRouter>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_PROFILE: SelectUserProfile = {
  id: "prof-1",
  goal: "strength",
  experience: "intermediate",
  equipment: ["barbell", "rack"],
  sessionsPerWeek: 3,
  sessionLengthMin: 60,
  customDirectives: null,
  units: "kg",
  userId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
}

const BASE_PROGRAM: SelectProgram = {
  id: "prog-1",
  name: "4-Week Strength Foundation",
  weeksTotal: 4,
  sessionsPerWeek: 3,
  status: "active",
  aiRationale: "Linear progression suits an intermediate lifter well.",
  userId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
}

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

function makeSession(
  id: string,
  dayLabel: string,
  workoutLog: SelectWorkoutLog | null = null
): SessionWithExercises {
  return {
    template: makeTemplate(id, dayLabel),
    exercises: [
      {
        exercise: {
          id: "ex-1",
          name: "Barbell Squat",
          movement: "squat",
          primaryMuscles: ["quads"],
          equipment: ["barbell"],
        },
        planned: {
          id: "pe-1",
          sessionTemplateId: id,
          exerciseId: "ex-1",
          orderIndex: 0,
          sets: 5,
          repRange: "3-5",
          loadKg: 100,
          rirTarget: 2,
          restSeconds: 240,
          coachNote: null,
          userId: null,
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      },
    ],
    workoutLog,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DashboardPage", () => {
  describe("no_program state", () => {
    it("renders 'No active program' heading and link to /onboarding", () => {
      const data: DashboardState = { kind: "no_program", profile: BASE_PROFILE }
      render(<DashboardPage data={data} />)

      expect(screen.getByText(/no active program/i)).toBeInTheDocument()
      const link = screen.getByRole("link", { name: /generate your plan/i })
      expect(link).toHaveAttribute("href", "/onboarding")
    })

    it("does not render program name in no_program state", () => {
      const data: DashboardState = { kind: "no_program", profile: BASE_PROFILE }
      render(<DashboardPage data={data} />)
      expect(
        screen.queryByRole("heading", { level: 1 })
      ).not.toBeInTheDocument()
    })
  })

  describe("active state — normal week in progress", () => {
    const nextSession = makeSession("s1", "Upper A")
    const futureSession = makeSession("s2", "Lower B")

    const activeData: DashboardState = {
      kind: "active",
      profile: BASE_PROFILE,
      program: BASE_PROGRAM,
      currentWeek: 2,
      sessionsThisWeek: [nextSession, futureSession],
      nextSession,
    }

    it("renders program name as h1", () => {
      render(<DashboardPage data={activeData} />)
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "4-Week Strength Foundation",
        })
      ).toBeInTheDocument()
    })

    it("renders week label", () => {
      render(<DashboardPage data={activeData} />)
      expect(screen.getByText("Week 2 of 4")).toBeInTheDocument()
    })

    it("renders 'Next Session' card for an incomplete week", () => {
      render(<DashboardPage data={activeData} />)
      expect(screen.getByText("Next Session")).toBeInTheDocument()
    })

    it("renders 'This Week' section heading", () => {
      render(<DashboardPage data={activeData} />)
      expect(screen.getByText("This Week")).toBeInTheDocument()
    })

    it("renders progress bar with correct session count", () => {
      render(<DashboardPage data={activeData} />)
      expect(screen.getByText("0 of 2 sessions this week")).toBeInTheDocument()
    })

    it("renders AI Rationale in program footer", () => {
      render(<DashboardPage data={activeData} />)
      expect(screen.getByText(BASE_PROGRAM.aiRationale)).toBeInTheDocument()
    })
  })

  describe("active state — WeekCompleteState", () => {
    it("shows 'All sessions done!' when all sessions are completed", () => {
      const doneSession1 = makeSession("s1", "Upper A", makeCompletedLog("s1"))
      const doneSession2 = makeSession("s2", "Lower B", makeCompletedLog("s2"))
      const weekCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM,
        currentWeek: 1,
        sessionsThisWeek: [doneSession1, doneSession2],
        nextSession: null,
      }
      render(<DashboardPage data={weekCompleteData} />)
      expect(screen.getByText("All sessions done!")).toBeInTheDocument()
    })

    it("shows 'Week N complete' heading in WeekCompleteState", () => {
      const doneSession = makeSession("s1", "Upper A", makeCompletedLog("s1"))
      const weekCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM,
        currentWeek: 3,
        sessionsThisWeek: [doneSession],
        nextSession: null,
      }
      render(<DashboardPage data={weekCompleteData} />)
      expect(screen.getByText("Week 3 complete")).toBeInTheDocument()
    })

    it("shows next-week message when not the final week", () => {
      const doneSession = makeSession("s1", "Upper A", makeCompletedLog("s1"))
      const weekCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM, // weeksTotal = 4, currentWeek = 2
        currentWeek: 2,
        sessionsThisWeek: [doneSession],
        nextSession: null,
      }
      render(<DashboardPage data={weekCompleteData} />)
      expect(screen.getByText(/week 3 starts next week/i)).toBeInTheDocument()
    })

    it("does not show 'Start Session' when week is complete", () => {
      const doneSession = makeSession("s1", "Upper A", makeCompletedLog("s1"))
      const weekCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM,
        currentWeek: 1,
        sessionsThisWeek: [doneSession],
        nextSession: null,
      }
      render(<DashboardPage data={weekCompleteData} />)
      expect(
        screen.queryByRole("link", { name: /start session/i })
      ).not.toBeInTheDocument()
    })
  })

  describe("active state — ProgramCompleteState", () => {
    it("shows 'You finished the program!' when currentWeek exceeds weeksTotal", () => {
      const programCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM, // weeksTotal = 4
        currentWeek: 5, // > weeksTotal → programComplete
        sessionsThisWeek: [],
        nextSession: null,
      }
      render(<DashboardPage data={programCompleteData} />)
      expect(screen.getByText("You finished the program!")).toBeInTheDocument()
    })

    it("renders 'Start a new program' link to /onboarding in ProgramCompleteState", () => {
      const programCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM,
        currentWeek: 5,
        sessionsThisWeek: [],
        nextSession: null,
      }
      render(<DashboardPage data={programCompleteData} />)
      const link = screen.getByRole("link", { name: /start a new program/i })
      expect(link).toHaveAttribute("href", "/onboarding")
    })

    it("does not render 'Next Session' card in ProgramCompleteState", () => {
      const programCompleteData: DashboardState = {
        kind: "active",
        profile: BASE_PROFILE,
        program: BASE_PROGRAM,
        currentWeek: 5,
        sessionsThisWeek: [],
        nextSession: null,
      }
      render(<DashboardPage data={programCompleteData} />)
      expect(screen.queryByText("Next Session")).not.toBeInTheDocument()
    })
  })
})
