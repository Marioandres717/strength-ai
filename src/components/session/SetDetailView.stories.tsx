import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { sessionExercise } from "../../stories/fixtures"
import { SetDetailView } from "./SetDetailView"
const meta = {
  title: "Workout Session/Components/Set Detail View",
  component: SetDetailView,
  args: {
    exercise: sessionExercise,
    setNumber: 1,
    totalSets: 3,
    exerciseIndex: 0,
    totalExercises: 1,
    inputWeight: 80,
    units: "kg",
    inputReps: 6,
    inputRir: 2,
    isSubmitting: false,
    errorMessage: null,
    onBack: fn(),
    onWeightChange: fn(),
    onRepsChange: fn(),
    onRirChange: fn(),
    onComplete: fn(),
  },
} satisfies Meta<typeof SetDetailView>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Pounds: Story = { args: { units: "lbs", inputWeight: 175 } }
