import type { Meta, StoryObj } from "@storybook/react-vite"
import { sessionExercise } from "../../stories/fixtures"
import { OnDemandWorkoutPreviewPage } from "./OnDemandWorkoutPreviewPage"
const meta = {
  title: "On-Demand Workouts/Pages/Preview",
  parameters: { layout: "fullscreen" },
  component: OnDemandWorkoutPreviewPage,
  args: {
    data: {
      id: "workout-1",
      revisionId: "revision-1",
      revisionNumber: 1,
      title: "Full Body Strength",
      prompt: "A short full body workout",
      focus: "strength",
      constraints: {
        timeMinutes: 45,
        equipment: ["barbell"],
        focus: "strength",
        energy: null,
        soreness: null,
      },
      reasoning: "Compound movements cover the whole body.",
      editKind: "generated",
      estimatedDurationSeconds: 2700,
      createdAt: "2024-01-01T00:00:00Z",
      units: "kg",
      exercises: [sessionExercise],
      alternatives: {},
      snapshot: {
        version: 1,
        revisionId: "revision-1",
        title: "Full Body Strength",
        units: "kg",
        loadPolicyVersion: 1,
        exercises: [],
      },
    },
  },
} satisfies Meta<typeof OnDemandWorkoutPreviewPage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
