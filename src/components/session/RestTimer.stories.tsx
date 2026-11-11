import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { RestTimer } from "./RestTimer"

const meta = {
  title: "Workout Session/Components/Rest Timer",
  component: RestTimer,
  args: {
    secondsRemaining: 60,
    secondsTotal: 120,
    onAdjust: fn(),
    onSkip: fn(),
  },
} satisfies Meta<typeof RestTimer>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const NearlyFinished: Story = { args: { secondsRemaining: 10 } }
