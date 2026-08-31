import { and, eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"
import { plannedExercise, setLog, workoutLog } from "../../lib/schema"
import { completeSessionOperation } from "./completeSession.server"
import { logSetOperation, type LogSetInput } from "./logSet.server"
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

function makeLogSetInput(
  workoutLogId: string,
  plannedExerciseId: string,
  overrides: Partial<LogSetInput> = {}
): LogSetInput {
  return {
    workoutLogId,
    plannedExerciseId,
    setNumber: 1,
    weightKg: 100,
    reps: 7,
    rirActual: 2,
    loggedAt: new Date("2024-06-01T10:15:00Z"),
    ...overrides,
  }
}

describe("logSetOperation", () => {
  it("returns the existing row when the same prescribed set is retried", () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const planned = insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      sets: 2,
    })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })
    const input = makeLogSetInput(workout.id, planned.id)

    const first = logSetOperation(db, input)
    const retry = logSetOperation(db, {
      ...input,
      reps: 5,
      loggedAt: new Date("2024-06-01T10:20:00Z"),
    })
    const rows = db
      .select()
      .from(setLog)
      .where(eq(setLog.workoutLogId, workout.id))
      .all()

    expect(first.alreadyExisted).toBe(false)
    expect(retry).toEqual({
      setLogId: first.setLogId,
      alreadyExisted: true,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].reps).toBe(7)
  })

  it("rejects an exercise from another session", () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
    } = makeContext()
    const program = insertProgram()
    const workoutSession = insertSessionTemplate({ programId: program.id })
    const otherSession = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const foreignPlanned = insertPlannedExercise({
      sessionTemplateId: otherSession.id,
      exerciseId: exercise.id,
    })
    const workout = insertWorkoutLog({
      sessionTemplateId: workoutSession.id,
    })

    expect(() =>
      logSetOperation(db, makeLogSetInput(workout.id, foreignPlanned.id))
    ).toThrow(/does not belong/)
    expect(db.select().from(setLog).all()).toHaveLength(0)
  })

  it("rejects a set number above the prescription", () => {
    const {
      db,
      insertExercise,
      insertProgram,
      insertSessionTemplate,
      insertPlannedExercise,
      insertWorkoutLog,
    } = makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const exercise = insertExercise()
    const planned = insertPlannedExercise({
      sessionTemplateId: session.id,
      exerciseId: exercise.id,
      sets: 2,
    })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })

    expect(() =>
      logSetOperation(
        db,
        makeLogSetInput(workout.id, planned.id, { setNumber: 3 })
      )
    ).toThrow(/exceeds the 2 prescribed sets/)
    expect(db.select().from(setLog).all()).toHaveLength(0)
  })
})

describe("completeSessionOperation", () => {
  it("rejects completion until every prescribed set is saved", () => {
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
      sets: 2,
    })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })
    insertSetLog({
      workoutLogId: workout.id,
      plannedExerciseId: planned.id,
      setNumber: 1,
    })

    expect(() =>
      completeSessionOperation(db, {
        workoutLogId: workout.id,
        sessionTemplateId: session.id,
      })
    ).toThrow(/missing set 2 of 2/)

    const persistedWorkout = db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, workout.id))
      .all()[0]
    expect(persistedWorkout.completedAt).toBeNull()
  })

  it("rejects a session template that does not own the workout", () => {
    const { db, insertProgram, insertSessionTemplate, insertWorkoutLog } =
      makeContext()
    const program = insertProgram()
    const session = insertSessionTemplate({ programId: program.id })
    const otherSession = insertSessionTemplate({ programId: program.id })
    const workout = insertWorkoutLog({ sessionTemplateId: session.id })

    expect(() =>
      completeSessionOperation(db, {
        workoutLogId: workout.id,
        sessionTemplateId: otherSession.id,
      })
    ).toThrow(/does not belong/)

    const persistedWorkout = db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, workout.id))
      .all()[0]
    expect(persistedWorkout.completedAt).toBeNull()
  })

  it("returns success on retry without applying progression twice", () => {
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
    const currentSession = insertSessionTemplate({
      programId: program.id,
      weekNumber: 1,
    })
    const futureSession = insertSessionTemplate({
      programId: program.id,
      weekNumber: 2,
    })
    const exercise = insertExercise({ name: "Competition Back Squat" })
    const currentPlanned = insertPlannedExercise({
      sessionTemplateId: currentSession.id,
      exerciseId: exercise.id,
      sets: 2,
      repRange: "5-7",
      loadKg: 100,
      rirTarget: 2,
    })
    const futurePlanned = insertPlannedExercise({
      sessionTemplateId: futureSession.id,
      exerciseId: exercise.id,
      sets: 2,
      loadKg: 100,
    })
    const workout = insertWorkoutLog({
      sessionTemplateId: currentSession.id,
    })
    insertSetLog({
      workoutLogId: workout.id,
      plannedExerciseId: currentPlanned.id,
      setNumber: 1,
      reps: 7,
      rirActual: 2,
    })
    insertSetLog({
      workoutLogId: workout.id,
      plannedExerciseId: currentPlanned.id,
      setNumber: 2,
      reps: 7,
      rirActual: 2,
      loggedAt: new Date("2024-06-01T10:20:00Z"),
    })

    const first = completeSessionOperation(db, {
      workoutLogId: workout.id,
      sessionTemplateId: currentSession.id,
    })
    const retry = completeSessionOperation(db, {
      workoutLogId: workout.id,
      sessionTemplateId: currentSession.id,
    })

    expect(first.alreadyCompleted).toBe(false)
    expect(first.progressionChanges).toHaveLength(1)
    expect(first.progressionChanges[0]).toMatchObject({
      plannedExerciseId: currentPlanned.id,
      exerciseName: "Competition Back Squat",
      oldLoadKg: 100,
      newLoadKg: 102.5,
    })
    expect(retry).toEqual({
      workoutLogId: workout.id,
      alreadyCompleted: true,
      progressionChanges: [],
    })

    const futureRows = db
      .select({ loadKg: plannedExercise.loadKg })
      .from(plannedExercise)
      .where(
        and(
          eq(plannedExercise.id, futurePlanned.id),
          eq(plannedExercise.sessionTemplateId, futureSession.id)
        )
      )
      .all()
    expect(futureRows[0].loadKg).toBe(102.5)
  })
})
