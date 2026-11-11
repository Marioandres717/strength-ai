import type { Meta, StoryObj } from "@storybook/react-vite"
import { FeedbackPage } from "./FeedbackPage"

const meta = {
  title: "Feedback/Pages/Feedback",
  parameters: { layout: "fullscreen" },
  component: FeedbackPage,
  args: {
    workoutLogId: "workout-1",
    sessionName: "Upper Body",
    progressionChanges: [],
    returnTo: "/",
  },
} satisfies Meta<typeof FeedbackPage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
