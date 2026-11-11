import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { PlanGenerationScreen } from "./PlanGenerationScreen"
const meta = {
  title: "Training Plan/Pages/Plan Generation",
  parameters: { layout: "fullscreen" },
  component: PlanGenerationScreen,
  args: {
    data: {
      goal: "strength",
      equipmentPreset: "full_gym",
      experience: "beginner",
      daysPerWeek: 3,
      sessionLengthMin: 60,
    },
    onSuccess: fn(),
    onError: fn(),
  },
} satisfies Meta<typeof PlanGenerationScreen>
export default meta
type Story = StoryObj<typeof meta>
export const Generating: Story = {}
