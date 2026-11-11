import type { Meta, StoryObj } from "@storybook/react-vite"
import { OnDemandWorkoutLibraryPage } from "./OnDemandWorkoutLibraryPage"
const meta = {
  title: "On-Demand Workouts/Pages/Library",
  parameters: { layout: "fullscreen" },
  component: OnDemandWorkoutLibraryPage,
  args: {
    data: {
      items: [
        {
          id: "workout-1",
          revisionId: "revision-1",
          title: "Full Body Strength",
          promptExcerpt: "A short full body workout",
          focus: "strength",
          estimatedDurationSeconds: 2700,
          createdAt: "2024-01-01T00:00:00Z",
          timesCompleted: 2,
        },
      ],
      nextCursor: null,
      tombstoneIds: [],
    },
  },
} satisfies Meta<typeof OnDemandWorkoutLibraryPage>
export default meta
type Story = StoryObj<typeof meta>
export const SavedWorkout: Story = {}
export const Empty: Story = {
  args: { data: { items: [], nextCursor: null, tombstoneIds: [] } },
}
