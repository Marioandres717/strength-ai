import type { Meta, StoryObj } from "@storybook/react-vite"
import { SessionHeader } from "./SessionHeader"

const meta = {
  title: "Workout Session/Components/Session Header",
  component: SessionHeader,
  args: {
    title: "Upper Body",
    currentExerciseIndex: 1,
    totalExercises: 4,
    elapsedSeconds: 720,
    totalVolumeKg: 1200,
    units: "kg",
  },
} satisfies Meta<typeof SessionHeader>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
