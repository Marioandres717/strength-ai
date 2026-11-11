import type { Meta, StoryObj } from "@storybook/react-vite"
import { Alert, AlertDescription, AlertTitle } from "./alert"
const meta = {
  title: "UI Primitives/Alert",
  component: Alert,
  args: {
    children: (
      <>
        <AlertTitle>Workout ready</AlertTitle>
        <AlertDescription>
          Your next session is ready to start.
        </AlertDescription>
      </>
    ),
  },
} satisfies Meta<typeof Alert>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: (
      <>
        <AlertTitle>Unable to sync</AlertTitle>
        <AlertDescription>Retry when you are connected.</AlertDescription>
      </>
    ),
  },
}
