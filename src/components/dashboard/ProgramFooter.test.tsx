import { describe, it, expect } from "vitest"
import { render, screen } from "../../test/utils"
import userEvent from "@testing-library/user-event"
import type { SelectProgram } from "../../../lib/schema"
import { ProgramFooter } from "./ProgramFooter"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_PROGRAM: SelectProgram = {
  id: "prog-1",
  name: "4-Week Strength Foundation",
  weeksTotal: 4,
  sessionsPerWeek: 3,
  status: "active",
  aiRationale:
    "Linear progression chosen because the athlete is early intermediate — weekly PRs are still reliable at this stage.",
  userId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
}

describe("ProgramFooter", () => {
  describe("View full plan link", () => {
    it("renders 'View full plan →' link pointing to /plan", () => {
      render(<ProgramFooter program={BASE_PROGRAM} />)
      const link = screen.getByRole("link", { name: /view full plan/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/plan")
    })
  })

  describe("AI Rationale details/summary", () => {
    it("renders the 'AI Rationale' summary text", () => {
      render(<ProgramFooter program={BASE_PROGRAM} />)
      expect(screen.getByText(/AI Rationale/i)).toBeInTheDocument()
    })

    it("renders the ai rationale text inside the details block", () => {
      render(<ProgramFooter program={BASE_PROGRAM} />)
      expect(screen.getByText(BASE_PROGRAM.aiRationale)).toBeInTheDocument()
    })

    it("details section is closed by default", () => {
      render(<ProgramFooter program={BASE_PROGRAM} />)
      const details = screen.getByTestId("ai-rationale-details")
      // HTMLDetailsElement.open is false when the details element is not open
      expect("open" in details && (details as HTMLDetailsElement).open).toBe(
        false
      )
    })

    it("details section opens when summary is clicked", async () => {
      const user = userEvent.setup()
      render(<ProgramFooter program={BASE_PROGRAM} />)
      const details = screen.getByTestId("ai-rationale-details")

      await user.click(screen.getByText(/AI Rationale/i))
      expect((details as HTMLDetailsElement).open).toBe(true)
    })

    it("details section closes after being opened and clicked again", async () => {
      const user = userEvent.setup()
      render(<ProgramFooter program={BASE_PROGRAM} />)
      const details = screen.getByTestId("ai-rationale-details")

      await user.click(screen.getByText(/AI Rationale/i))
      expect((details as HTMLDetailsElement).open).toBe(true)

      await user.click(screen.getByText(/AI Rationale/i))
      expect((details as HTMLDetailsElement).open).toBe(false)
    })
  })
})
