import type { Meta, StoryObj } from "@storybook/react-vite"
import { WorkoutUnavailable } from "./WorkoutUnavailable"

const meta = {
  title: "Shared Components/Workout Unavailable",
  component: WorkoutUnavailable,
  args: {},
} satisfies Meta<typeof WorkoutUnavailable>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
