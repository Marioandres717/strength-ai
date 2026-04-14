import { describe, it, expect } from "vitest"
import { render, screen } from "../../test/utils"
import { WeekProgressBar } from "./WeekProgressBar"

// ─── Fixtures ────────────────────────────────────────────────────────────────

describe("WeekProgressBar", () => {
  describe("label text", () => {
    it("renders 'X of Y sessions this week' with correct counts", () => {
      render(<WeekProgressBar done={2} total={5} />)
      expect(screen.getByText("2 of 5 sessions this week")).toBeInTheDocument()
    })

    it("renders '0 of 0 sessions this week' when total is zero", () => {
      render(<WeekProgressBar done={0} total={0} />)
      expect(screen.getByText("0 of 0 sessions this week")).toBeInTheDocument()
    })

    it("renders '3 of 3 sessions this week' when all done", () => {
      render(<WeekProgressBar done={3} total={3} />)
      expect(screen.getByText("3 of 3 sessions this week")).toBeInTheDocument()
    })
  })

  describe("progress bar width", () => {
    it("sets width to 0% when total is zero (no division by zero)", () => {
      render(<WeekProgressBar done={0} total={0} />)
      const fill = screen.getByTestId("week-progress-fill")
      expect(fill.style.width).toBe("0%")
    })

    it("sets width to 100% when all sessions are done", () => {
      render(<WeekProgressBar done={4} total={4} />)
      const fill = screen.getByTestId("week-progress-fill")
      expect(fill.style.width).toBe("100%")
    })

    it("sets width to 40% for 2 of 5 sessions", () => {
      render(<WeekProgressBar done={2} total={5} />)
      const fill = screen.getByTestId("week-progress-fill")
      expect(fill.style.width).toBe("40%")
    })

    it("sets width to 0% when done is 0 but total is positive", () => {
      render(<WeekProgressBar done={0} total={3} />)
      const fill = screen.getByTestId("week-progress-fill")
      expect(fill.style.width).toBe("0%")
    })
  })
})
