import { afterEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import {
  sessionTemplate,
  setLog,
  workoutLog,
  userProfile,
} from "../../lib/schema"
import { createWorkoutTestDb } from "../test/workoutDb"
import { getPlanDataOperation } from "./getPlanData"
import { swapWorkoutDaysOperation } from "./swapWorkoutDays"

const contexts: ReturnType<typeof createWorkoutTestDb>[] = []
afterEach(() => {
  while (contexts.length) contexts.pop()?.close()
})

function setup() {
  const context = createWorkoutTestDb()
  contexts.push(context)
  context.db
    .insert(userProfile)
    .values({
      id: "profile",
      goal: "strength",
      experience: "beginner",
      equipment: ["barbell"],
      sessionsPerWeek: 2,
      sessionLengthMin: 60,
      units: "kg",
    })
    .run()
  const program = context.insertProgram()
  const first = context.insertSessionTemplate({
    programId: program.id,
    dayLabel: "Lower",
    orderIndex: 0,
  })
  const second = context.insertSessionTemplate({
    programId: program.id,
    dayLabel: "Upper",
    orderIndex: 1,
  })
  return { context, program, first, second }
}

describe("swapWorkoutDaysOperation", () => {
  it("persists repeated swaps and changes plan order", async () => {
    const { context, first, second } = setup()
    swapWorkoutDaysOperation(context.db, first.id, second.id)
    let plan = await getPlanDataOperation(context.db)
    expect(plan.kind).toBe("active")
    if (plan.kind === "active")
      expect(
        plan.sessionsByWeek[1]?.map((session) => session.template.id)
      ).toEqual([second.id, first.id])
    expect(
      context.db
        .select()
        .from(sessionTemplate)
        .where(eq(sessionTemplate.id, first.id))
        .get()?.orderIndex
    ).toBe(1)
    expect(
      context.db
        .select()
        .from(sessionTemplate)
        .where(eq(sessionTemplate.id, second.id))
        .get()?.orderIndex
    ).toBe(0)
    swapWorkoutDaysOperation(context.db, first.id, second.id)
    expect(
      context.db
        .select()
        .from(sessionTemplate)
        .where(eq(sessionTemplate.id, first.id))
        .get()?.orderIndex
    ).toBe(0)
    plan = await getPlanDataOperation(context.db)
    expect(plan.kind).toBe("active")
    if (plan.kind === "active")
      expect(
        plan.sessionsByWeek[1]?.map((session) => session.template.id)
      ).toEqual([first.id, second.id])
  })

  it("rejects logged, completed, cross-week, and inactive workouts", () => {
    const { context, first, second } = setup()
    const exercise = context.insertExercise()
    const planned = context.insertPlannedExercise({
      sessionTemplateId: first.id,
      exerciseId: exercise.id,
    })
    const log = context.insertWorkoutLog({ sessionTemplateId: first.id })
    context.insertSetLog({
      workoutLogId: log.id,
      plannedExerciseId: planned.id,
    })
    expect(() =>
      swapWorkoutDaysOperation(context.db, first.id, second.id)
    ).toThrow("logged sets")
    context.db.delete(setLog).where(eq(setLog.workoutLogId, log.id)).run()
    context.db.delete(workoutLog).where(eq(workoutLog.id, log.id)).run()
    const completed = context.insertSessionTemplate({
      programId: second.programId,
      orderIndex: 0,
    })
    context.insertWorkoutLog({
      sessionTemplateId: completed.id,
      completedAt: new Date(),
    })
    expect(() =>
      swapWorkoutDaysOperation(context.db, completed.id, second.id)
    ).toThrow("Completed")
    const otherWeek = context.insertSessionTemplate({
      programId: second.programId,
      weekNumber: 2,
    })
    expect(() =>
      swapWorkoutDaysOperation(context.db, second.id, otherWeek.id)
    ).toThrow("current week")
    const archived = context.insertProgram({ status: "archived" })
    const otherProgram = context.insertSessionTemplate({
      programId: archived.id,
    })
    expect(() =>
      swapWorkoutDaysOperation(context.db, second.id, otherProgram.id)
    ).toThrow("active plan")
  })
})
