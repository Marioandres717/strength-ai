import type { Meta, StoryObj } from "@storybook/react-vite"
import { session } from "../../stories/fixtures"
import { WeekGrid } from "./WeekGrid"
const completed = {
  ...session,
  workoutLog: {
    id: "log-1",
    sessionTemplateId: session.template.id,
    startedAt: new Date("2024-01-01"),
    completedAt: new Date("2024-01-01"),
    fatigueRating: null,
    onDemandWorkoutRevisionId: null,
    runSnapshot: null,
    notes: null,
    userId: null,
    createdAt: new Date("2024-01-01"),
  },
}
const missed = {
  ...session,
  template: {
    ...session.template,
    id: "session-2",
    dayLabel: "Upper Body",
    orderIndex: 1,
    focus: "hypertrophy" as const,
  },
}
const next = {
  ...session,
  template: {
    ...session.template,
    id: "session-3",
    dayLabel: "Full Body",
    orderIndex: 2,
    focus: "mixed" as const,
  },
}
const meta = {
  title: "Dashboard/Components/Week Grid",
  component: WeekGrid,
  args: { sessions: [completed, missed, next], nextSession: next },
} satisfies Meta<typeof WeekGrid>
export default meta
type Story = StoryObj<typeof meta>
export const MixedWeek: Story = {}
