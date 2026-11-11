import type { Meta, StoryObj } from "@storybook/react-vite"
import { profile, program, session } from "../stories/fixtures"
import { PlanPage } from "./PlanPage"
const meta = {
  title: "Training Plan/Pages/Plan",
  parameters: { layout: "fullscreen" },
  component: PlanPage,
  args: {
    data: {
      kind: "active",
      profile,
      program,
      currentWeek: 1,
      sessionsByWeek: { 1: [session] },
    },
  },
} satisfies Meta<typeof PlanPage>
export default meta
type Story = StoryObj<typeof meta>
export const ActivePlan: Story = {}
