import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ChipButton } from "./ChipButton"

const meta = {
  title: "Shared Components/Chip Button",
  component: ChipButton,
  args: {
    label: "45 minutes",
    sublabel: "Balanced",
    badge: "Popular",
    selected: false,
    onSelect: fn(),
  },
} satisfies Meta<typeof ChipButton>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { selected: true } }
