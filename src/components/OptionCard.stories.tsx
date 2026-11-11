import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { OptionCard } from "./OptionCard"

const meta = {
  title: "Onboarding/Components/Option Card",
  component: OptionCard,
  args: {
    icon: "??",
    label: "Strength",
    sublabel: "Build strength",
    selected: false,
    onSelect: fn(),
  },
} satisfies Meta<typeof OptionCard>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { selected: true } }
