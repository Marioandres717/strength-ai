import { afterEach, describe, expect, it } from "vitest"
import { userProfile } from "../../lib/schema"
import { createWorkoutTestDb } from "../test/workoutDb"
import { getProfileStatusOperation } from "./getProfileStatus"

const contexts: ReturnType<typeof createWorkoutTestDb>[] = []

function makeContext() {
  const context = createWorkoutTestDb()
  contexts.push(context)
  return context
}

afterEach(() => {
  while (contexts.length > 0) contexts.pop()?.close()
})

describe("getProfileStatusOperation", () => {
  it("returns false when no profile exists", async () => {
    const { db } = makeContext()

    await expect(getProfileStatusOperation(db)).resolves.toEqual({
      hasProfile: false,
    })
  })

  it("returns true when a profile exists", async () => {
    const context = makeContext()
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

    await expect(getProfileStatusOperation(context.db)).resolves.toEqual({
      hasProfile: true,
    })
  })
})
