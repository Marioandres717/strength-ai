import type { Meta, StoryObj } from "@storybook/react-vite"
import { StepIndicator } from "./StepIndicator"

const meta = {
  title: "Onboarding/Components/Step Indicator",
  component: StepIndicator,
  args: { current: 2 },
} satisfies Meta<typeof StepIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
