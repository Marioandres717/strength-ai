import { describe, it, expect, vi } from "vitest"
import { render, screen } from "../test/utils"
import userEvent from "@testing-library/user-event"
import { OptionCard } from "./OptionCard"

describe("OptionCard", () => {
  it("renders icon and label", () => {
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText("🏋️")).toBeInTheDocument()
    expect(screen.getByText("Strength")).toBeInTheDocument()
  })

  it("renders sublabel when provided", () => {
    render(
      <OptionCard
        icon="📊"
        label="Beginner"
        sublabel="0-1 years of consistent lifting"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(
      screen.getByText("0-1 years of consistent lifting")
    ).toBeInTheDocument()
  })

  it("does not render sublabel when omitted", () => {
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.queryByTestId("option-card-sublabel")).not.toBeInTheDocument()
  })

  it("applies selected styling when selected=true", () => {
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={true}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole("button")).toHaveClass("border-accent")
  })

  it("applies unselected styling when selected=false", () => {
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole("button")).not.toHaveClass("border-accent")
  })

  it("shows filled selection dot when selected=true", () => {
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={true}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByTestId("option-card-dot")).toBeInTheDocument()
  })

  it("does not show filled selection dot when selected=false", () => {
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.queryByTestId("option-card-dot")).not.toBeInTheDocument()
  })

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <OptionCard
        icon="🏋️"
        label="Strength"
        selected={false}
        onSelect={onSelect}
      />
    )
    await user.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
