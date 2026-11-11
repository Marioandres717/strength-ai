import type { Meta, StoryObj } from "@storybook/react-vite"
import { sessionExercise } from "../../stories/fixtures"
import { ExerciseRow } from "./ExerciseRow"
const meta = {
  title: "Workout Session/Components/Exercise Row",
  component: ExerciseRow,
  args: { sessionExercise, status: "upcoming", index: 0 },
} satisfies Meta<typeof ExerciseRow>
export default meta
type Story = StoryObj<typeof meta>
export const Upcoming: Story = {}
export const Completed: Story = { args: { status: "completed" } }
