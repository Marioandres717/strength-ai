import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { sessionExercise } from "../../stories/fixtures"
import { ExecutionView } from "./ExecutionView"
const meta = {
  title: "Workout Session/Components/Execution View",
  component: ExecutionView,
  args: {
    units: "kg",
    exercises: [
      sessionExercise,
      {
        ...sessionExercise,
        exercise: {
          ...sessionExercise.exercise,
          id: "press",
          name: "Bench Press",
          movement: "push",
        },
        prescription: {
          ...sessionExercise.prescription,
          ref: { kind: "planned", plannedExerciseId: "press" },
        },
      },
      {
        ...sessionExercise,
        exercise: {
          ...sessionExercise.exercise,
          id: "row",
          name: "Barbell Row",
          movement: "pull",
        },
        prescription: {
          ...sessionExercise.prescription,
          ref: { kind: "planned", plannedExerciseId: "row" },
        },
      },
    ],
    currentExerciseIndex: 1,
    currentSetNumber: 2,
    restSecondsRemaining: 60,
    restSecondsTotal: 120,
    loggedSets: [],
    onLogSet: fn(),
    onAdjustTimer: fn(),
    onSkipRest: fn(),
  },
} satisfies Meta<typeof ExecutionView>
export default meta
type Story = StoryObj<typeof meta>
export const MidSession: Story = {}
export const FirstSet: Story = {
  args: {
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    restSecondsRemaining: 0,
  },
}
export const FinalExercise: Story = {
  args: {
    currentExerciseIndex: 2,
    currentSetNumber: 3,
    restSecondsRemaining: 0,
  },
}
