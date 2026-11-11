import type { Meta, StoryObj } from "@storybook/react-vite"
import { OnDemandWorkoutGeneratePage } from "./OnDemandWorkoutGeneratePage"

const meta = {
  title: "On-Demand Workouts/Pages/Generate",
  parameters: { layout: "fullscreen" },
  component: OnDemandWorkoutGeneratePage,
  args: {},
} satisfies Meta<typeof OnDemandWorkoutGeneratePage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
