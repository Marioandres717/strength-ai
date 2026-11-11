import type { Meta, StoryObj } from "@storybook/react-vite"
import { session } from "../../stories/fixtures"
import { NextSessionCard } from "./NextSessionCard"
const meta = {
  title: "Dashboard/Components/Next Session Card",
  component: NextSessionCard,
  args: { session, sessionLengthMin: 60 },
} satisfies Meta<typeof NextSessionCard>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
