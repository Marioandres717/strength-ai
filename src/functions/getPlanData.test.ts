import { afterEach, describe, expect, it, vi } from "vitest"
import { userProfile } from "../../lib/schema"
import { getPlanDataOperation } from "./getPlanData"
import { createWorkoutTestDb } from "../test/workoutDb"

const contexts: ReturnType<typeof createWorkoutTestDb>[] = []

function makeContext() {
  const context = createWorkoutTestDb()
  contexts.push(context)
  return context
}

function insertProfile(context: ReturnType<typeof createWorkoutTestDb>) {
  context.db
    .insert(userProfile)
    .values({
      id: "profile-1",
      goal: "strength",
      experience: "beginner",
      equipment: ["barbell"],
      sessionsPerWeek: 3,
      sessionLengthMin: 60,
      units: "kg",
      userId: "user-1",
    })
    .run()
}

afterEach(() => {
  vi.useRealTimers()
  while (contexts.length > 0) contexts.pop()?.close()
})

describe("getPlanDataOperation", () => {
  it("returns no_profile when no profile exists", async () => {
    const { db } = makeContext()

    await expect(getPlanDataOperation(db)).resolves.toEqual({
      kind: "no_profile",
    })
  })

  it("returns no_program when the profile has no active program", async () => {
    const context = makeContext()
    insertProfile(context)
    context.insertProgram({ status: "archived" })

    const result = await getPlanDataOperation(context.db)

    expect(result.kind).toBe("no_program")
  })

  it("groups sessions by ordered week and orders exercises by prescription", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-10T00:00:00Z"))
    const context = makeContext()
    insertProfile(context)
    const activeProgram = context.insertProgram({
      createdAt: new Date("2024-01-01T00:00:00Z"),
    })
    const laterWeekOne = context.insertSessionTemplate({
      programId: activeProgram.id,
      weekNumber: 1,
      dayLabel: "Upper B",
      createdAt: new Date("2024-01-02T00:00:00Z"),
    })
    const earlierWeekOne = context.insertSessionTemplate({
      programId: activeProgram.id,
      weekNumber: 1,
      dayLabel: "Upper A",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    })
    const weekTwo = context.insertSessionTemplate({
      programId: activeProgram.id,
      weekNumber: 2,
      dayLabel: "Lower A",
    })
    const firstExercise = context.insertExercise({ name: "Back Squat" })
    const secondExercise = context.insertExercise({ name: "Romanian Deadlift" })
    context.insertPlannedExercise({
      sessionTemplateId: earlierWeekOne.id,
      exerciseId: secondExercise.id,
      orderIndex: 1,
    })
    context.insertPlannedExercise({
      sessionTemplateId: earlierWeekOne.id,
      exerciseId: firstExercise.id,
      orderIndex: 0,
    })

    const result = await getPlanDataOperation(context.db)

    expect(result.kind).toBe("active")
    if (result.kind !== "active") return
    expect(result.currentWeek).toBe(2)
    expect(
      result.sessionsByWeek[1]?.map((session) => session.template.dayLabel)
    ).toEqual(["Upper A", "Upper B"])
    expect(result.sessionsByWeek[1]?.[1]?.template.id).toBe(laterWeekOne.id)
    expect(result.sessionsByWeek[2]?.[0]?.template.id).toBe(weekTwo.id)
    expect(
      result.sessionsByWeek[1]?.[0]?.exercises.map(
        ({ exercise }) => exercise.name
      )
    ).toEqual(["Back Squat", "Romanian Deadlift"])
  })
})
