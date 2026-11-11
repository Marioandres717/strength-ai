import type { Meta, StoryObj } from "@storybook/react-vite"
import { OfflineAvailabilityMessage } from "./OfflineWorkoutAvailability"

const meta = {
  title: "On-Demand Workouts/Components/Offline Availability",
  component: OfflineAvailabilityMessage,
  args: { ready: false },
} satisfies Meta<typeof OfflineAvailabilityMessage>
export default meta
type Story = StoryObj<typeof meta>
export const DownloadNeeded: Story = {}
export const AvailableOffline: Story = { args: { ready: true } }
