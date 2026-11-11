import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { WorkoutSyncMessage } from "./WorkoutSyncStatus"

const meta = {
  title: "Shared Components/Workout Sync Status",
  component: WorkoutSyncMessage,
  args: { status: "All workouts synced.", updateWaiting: false, onRetry: fn() },
} satisfies Meta<typeof WorkoutSyncMessage>
export default meta
type Story = StoryObj<typeof meta>
export const Synced: Story = {}
export const Pending: Story = {
  args: { status: "Saved on this device; sync pending." },
}
export const Conflict: Story = {
  args: {
    status:
      "Sync needs attention. Check this device's clock and retry; your workout is retained.",
  },
}
export const StorageUnavailable: Story = {
  args: { status: "Device storage is unavailable. Sets cannot be saved." },
}
export const UpdateReady: Story = { args: { updateWaiting: true } }
