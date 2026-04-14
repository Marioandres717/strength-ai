import { describe, it, expect } from "vitest"
import { render, screen } from "../../test/utils"
import type { SelectProgram } from "../../../lib/schema"
import { ProgramHeader } from "./ProgramHeader"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_PROGRAM: SelectProgram = {
  id: "prog-1",
  name: "4-Week Strength Foundation",
  weeksTotal: 4,
  sessionsPerWeek: 3,
  status: "active",
  aiRationale: "Progressive overload with linear periodisation.",
  userId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
}

describe("ProgramHeader", () => {
  it("renders program name as h1", () => {
    render(
      <ProgramHeader
        program={BASE_PROGRAM}
        currentWeek={1}
        sessionLengthMin={45}
      />
    )
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "4-Week Strength Foundation",
      })
    ).toBeInTheDocument()
  })

  it("shows 'Week N of M' label with correct numbers", () => {
    render(
      <ProgramHeader
        program={BASE_PROGRAM}
        currentWeek={2}
        sessionLengthMin={45}
      />
    )
    expect(screen.getByText("Week 2 of 4")).toBeInTheDocument()
  })

  it("shows 'X days · Y min sessions' subtitle with correct values", () => {
    render(
      <ProgramHeader
        program={BASE_PROGRAM}
        currentWeek={1}
        sessionLengthMin={60}
      />
    )
    // The nbsp separators make a single text node — match via regex
    expect(screen.getByText(/3 days.*60 min sessions/)).toBeInTheDocument()
  })

  it("reflects updated week number when prop changes", () => {
    const { rerender } = render(
      <ProgramHeader
        program={BASE_PROGRAM}
        currentWeek={1}
        sessionLengthMin={45}
      />
    )
    expect(screen.getByText("Week 1 of 4")).toBeInTheDocument()

    rerender(
      <ProgramHeader
        program={BASE_PROGRAM}
        currentWeek={4}
        sessionLengthMin={45}
      />
    )
    expect(screen.getByText("Week 4 of 4")).toBeInTheDocument()
  })

  it("reflects different sessionsPerWeek from program", () => {
    const fiveDay: SelectProgram = { ...BASE_PROGRAM, sessionsPerWeek: 5 }
    render(
      <ProgramHeader program={fiveDay} currentWeek={1} sessionLengthMin={45} />
    )
    expect(screen.getByText(/5 days/)).toBeInTheDocument()
  })
})
