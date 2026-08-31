import { afterEach, describe, expect, it } from "vitest"
import { getSessionDataOperation } from "./getSessionData"
import { createWorkoutTestDb } from "../test/workoutDb"

const contexts: ReturnType<typeof createWorkoutTestDb>[] = []

function makeContext() {
  const context = createWorkoutTestDb()
  contexts.push(context)
  return context
}

afterEach(() => {
  while (contexts.length > 0) {
    contexts.pop()?.close()
  }
})

describe("getSessionDataOperation", () => {
  it("creates a new in-progress workout when none exists", async () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      sets: 3,
    })

    const result = await getSessionDataOperation(db, session.id)

    expect(result.workoutLogId).toBeTruthy()
    expect(result.persistedSets).toEqual([])
    expect(result.exercises).toHaveLength(1)
    expect(result.sessionTemplate.id).toBe(session.id)
  })

  it("reuses an in-progress workout and returns its persisted sets", async () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
      insertSetLog,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const planned = insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      sets: 3,
    })
    const workout = insertWorkoutLog({
      sessionTemplateId: session.id,
      startedAt: new Date("2024-06-02T10:00:00Z"),
    })
    insertSetLog({
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 1,
      reps: 8,
      loggedAt: new Date("2024-06-02T10:15:00Z"),
    })

    const result = await getSessionDataOperation(db, session.id)

    expect(result.workoutLogId).toBe(workout.id)
    expect(result.persistedSets).toHaveLength(1)
    expect(result.persistedSets[0]?.plannedExerciseId).toBe(planned.id)
    expect(result.persistedSets[0]?.setNumber).toBe(1)
    expect(result.persistedSets[0]?.reps).toBe(8)
    expect(result.persistedSets[0]?.setLogId).toBeTruthy()
  })

  it("returns persisted gaps without restarting the workout", async () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
      insertSetLog,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const planned = insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      sets: 3,
    })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })

    insertSetLog({
      id: "set-1",
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 1,
      loggedAt: new Date("2024-06-01T10:15:00Z"),
    })
    insertSetLog({
      id: "set-3",
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 3,
      loggedAt: new Date("2024-06-01T10:25:00Z"),
    })

    const result = await getSessionDataOperation(db, session.id)

    expect(result.workoutLogId).toBe(workout.id)
    expect(result.persistedSets.map((set) => set.setNumber)).toEqual([1, 3])
  })

  it("deduplicates historical duplicates and keeps the latest logged set", async () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
      insertSetLog,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const planned = insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      sets: 2,
    })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })

    insertSetLog({
      id: "older",
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 1,
      reps: 6,
      loggedAt: new Date("2024-06-01T10:10:00Z"),
    })
    insertSetLog({
      id: "newer",
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 1,
      reps: 8,
      loggedAt: new Date("2024-06-01T10:20:00Z"),
    })

    const result = await getSessionDataOperation(db, session.id)

    expect(result.persistedSets).toHaveLength(1)
    expect(result.persistedSets[0].setLogId).toBe("newer")
    expect(result.persistedSets[0].reps).toBe(8)
  })

  it("returns all saved sets for an incomplete workout that only needs completion retried", async () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
      insertSetLog,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const planned = insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      sets: 2,
    })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })

    insertSetLog({
      id: "set-1",
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 1,
    })
    insertSetLog({
      id: "set-2",
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 2,
      loggedAt: new Date("2024-06-01T10:20:00Z"),
    })

    const result = await getSessionDataOperation(db, session.id)

    expect(result.workoutLogId).toBe(workout.id)
    expect(result.persistedSets.map((set) => set.setNumber)).toEqual([1, 2])
  })
})
