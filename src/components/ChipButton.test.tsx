import { describe, it, expect, vi } from "vitest"
import { render, screen } from "../test/utils"
import userEvent from "@testing-library/user-event"
import { ChipButton } from "./ChipButton"

describe("ChipButton", () => {
  it("renders label text", () => {
    render(<ChipButton label="45" selected={false} onSelect={vi.fn()} />)
    expect(screen.getByText("45")).toBeInTheDocument()
  })

  it("renders sublabel when provided", () => {
    render(
      <ChipButton
        label="45"
        sublabel="min"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText("min")).toBeInTheDocument()
  })

  it("does not render sublabel when omitted", () => {
    render(<ChipButton label="45" selected={false} onSelect={vi.fn()} />)
    expect(screen.queryByText("min")).not.toBeInTheDocument()
  })

  it("renders badge text when provided", () => {
    render(
      <ChipButton
        label="60"
        badge="popular"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText("popular")).toBeInTheDocument()
  })

  it("does not render badge when omitted", () => {
    render(<ChipButton label="60" selected={false} onSelect={vi.fn()} />)
    expect(screen.queryByText("popular")).not.toBeInTheDocument()
  })

  it("applies selected styling when selected=true", () => {
    render(<ChipButton label="45" selected={true} onSelect={vi.fn()} />)
    expect(screen.getByRole("button")).toHaveClass("border-accent")
  })

  it("applies unselected styling when selected=false", () => {
    render(<ChipButton label="45" selected={false} onSelect={vi.fn()} />)
    expect(screen.getByRole("button")).not.toHaveClass("border-accent")
  })

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ChipButton label="45" selected={false} onSelect={onSelect} />)
    await user.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
