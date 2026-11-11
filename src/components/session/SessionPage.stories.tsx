import type { Meta, StoryObj } from "@storybook/react-vite"
import { run, sessionExercise } from "../../stories/fixtures"
import { SessionPage } from "./SessionPage"
const persistedSet = {
  setLogId: "set-1",
  prescriptionRef: sessionExercise.prescription.ref,
  setNumber: 1,
  weightKg: 80,
  reps: 6,
  rirActual: 2,
  loggedAt: new Date(),
}
const meta = {
  title: "Workout Session/Pages/Session",
  parameters: { layout: "fullscreen" },
  component: SessionPage,
  args: {
    loaderData: run,
    persistence: {
      prepare: (run) => Promise.resolve(run),
      commit: () => Promise.resolve("set-1"),
      complete: () => Promise.resolve({ workoutLogId: "workout-1" }),
      updateRest: () => Promise.resolve(),
    },
  },
} satisfies Meta<typeof SessionPage>
export default meta
type Story = StoryObj<typeof meta>
export const Executing: Story = {}
export const Resting: Story = {
  args: {
    loaderData: {
      ...run,
      persistedSets: [persistedSet],
      restDeadline: Date.now() + 120000,
      restSeconds: 120,
    },
  },
}
export const Complete: Story = {
  args: {
    loaderData: {
      ...run,
      persistedSets: [
        persistedSet,
        { ...persistedSet, setLogId: "set-2", setNumber: 2 },
        { ...persistedSet, setLogId: "set-3", setNumber: 3 },
      ],
    },
    persistence: {
      ...meta.args.persistence,
      complete: () => new Promise(() => undefined),
    },
  },
}
