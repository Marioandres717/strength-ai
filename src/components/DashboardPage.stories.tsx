import type { Meta, StoryObj } from "@storybook/react-vite"
import { profile, program, session } from "../stories/fixtures"
import { DashboardPage } from "./DashboardPage"
const meta = {
  title: "Dashboard/Pages/Dashboard",
  parameters: { layout: "fullscreen" },
  component: DashboardPage,
  args: {
    data: {
      kind: "active",
      profile,
      program,
      currentWeek: 1,
      sessionsThisWeek: [session],
      nextSession: session,
    },
  },
} satisfies Meta<typeof DashboardPage>
export default meta
type Story = StoryObj<typeof meta>
export const ActiveProgram: Story = {}
export const NoProgram: Story = {
  args: { data: { kind: "no_program", profile } },
}
