import { afterEach, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "../../test/utils"
import { createWorkoutTestDb } from "../../test/workoutDb"
import { SetDetailView } from "./SetDetailView"

const contexts: ReturnType<typeof createWorkoutTestDb>[] = []
afterEach(() => {
  while (contexts.length) contexts.pop()?.close()
})

it("shows pounds for prior performance and increments by five pounds", () => {
  const context = createWorkoutTestDb()
  contexts.push(context)
  const exerciseRow = context.insertExercise()
  const plannedRow = context.insertPlannedExercise({
    exerciseId: exerciseRow.id,
    loadKg: 100,
  })
  const planned = context.db.query.plannedExercise
    .findFirst({ where: (item, { eq }) => eq(item.id, plannedRow.id) })
    .sync()
  const exercise = context.db.query.exercise
    .findFirst({ where: (item, { eq }) => eq(item.id, exerciseRow.id) })
    .sync()
  if (!planned || !exercise) throw new Error("Fixture missing")
  const onWeightChange = vi.fn()

  render(
    <SetDetailView
      exercise={{
        prescription: {
          ...planned,
          ref: { kind: "planned", plannedExerciseId: planned.id },
        },
        exercise,
        priorPerformance: {
          weightKg: 100,
          reps: 5,
          rirActual: 2,
          date: "2024-01-01",
        },
      }}
      setNumber={1}
      totalSets={3}
      exerciseIndex={0}
      totalExercises={1}
      inputWeight={220.5}
      inputReps={5}
      inputRir={2}
      isSubmitting={false}
      errorMessage={null}
      units="lbs"
      onBack={vi.fn()}
      onWeightChange={onWeightChange}
      onRepsChange={vi.fn()}
      onRirChange={vi.fn()}
      onComplete={vi.fn()}
    />
  )

  expect(screen.getAllByText("220.5")).toHaveLength(2)
  expect(screen.getAllByText("lbs").length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole("button", { name: "Increase Weight" }))
  expect(onWeightChange).toHaveBeenCalledWith(225.5)
})
