import type { Meta, StoryObj } from "@storybook/react-vite"
import { WeekProgressBar } from "./WeekProgressBar"

const meta = {
  title: "Dashboard/Components/Week Progress Bar",
  component: WeekProgressBar,
  args: { done: 2, total: 3 },
} satisfies Meta<typeof WeekProgressBar>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
