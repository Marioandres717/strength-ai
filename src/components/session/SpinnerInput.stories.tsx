import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { SpinnerInput } from "./SpinnerInput"

const meta = {
  title: "Workout Session/Components/Spinner Input",
  component: SpinnerInput,
  args: {
    label: "Weight",
    value: 80,
    step: 2.5,
    min: 0,
    max: 500,
    unit: "kg",
    onChange: fn(),
  },
} satisfies Meta<typeof SpinnerInput>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const AtMinimum: Story = { args: { value: 0 } }
export const Pounds: Story = { args: { value: 175, unit: "lbs", step: 5 } }
