import { afterEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { workoutLog } from "../../lib/schema"
import { createWorkoutTestDb } from "../test/workoutDb"
import { saveFeedbackInputSchema, saveFeedbackOperation } from "./saveFeedback"

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

describe("saveFeedbackInputSchema", () => {
  it("accepts only integer fatigue values from 1 to 5", () => {
    expect(() =>
      saveFeedbackInputSchema.parse({
        workoutLogId: "workout-1",
        fatigueRating: 0,
        notes: null,
      })
    ).toThrow()

    expect(() =>
      saveFeedbackInputSchema.parse({
        workoutLogId: "workout-1",
        fatigueRating: 6,
        notes: null,
      })
    ).toThrow()

    expect(() =>
      saveFeedbackInputSchema.parse({
        workoutLogId: "workout-1",
        fatigueRating: 3.5,
        notes: null,
      })
    ).toThrow()

    expect(
      saveFeedbackInputSchema.parse({
        workoutLogId: "workout-1",
        fatigueRating: 3,
        notes: "  steady session  ",
      })
    ).toMatchObject({
      fatigueRating: 3,
      notes: "steady session",
    })
  })

  it("normalizes blank notes to null and enforces the 2000 character cap", () => {
    expect(
      saveFeedbackInputSchema.parse({
        workoutLogId: "workout-1",
        fatigueRating: 3,
        notes: "   ",
      }).notes
    ).toBeNull()

    expect(() =>
      saveFeedbackInputSchema.parse({
        workoutLogId: "workout-1",
        fatigueRating: 3,
        notes: "a".repeat(2001),
      })
    ).toThrow()
  })
})

describe("saveFeedbackOperation", () => {
  it("saves feedback for a completed workout", async () => {
    const { db, insertWorkoutLog } = makeContext()
    const workout = insertWorkoutLog({
      completedAt: new Date("2024-06-01T11:00:00Z"),
    })

    await saveFeedbackOperation(
      db,
      saveFeedbackInputSchema.parse({
        workoutLogId: workout.id,
        fatigueRating: 4,
        notes: "  last set slowed down  ",
      })
    )

    const [saved] = await db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, workout.id))

    expect(saved.fatigueRating).toBe(4)
    expect(saved.notes).toBe("last set slowed down")
  })

  it("stores blank notes as null", async () => {
    const { db, insertWorkoutLog } = makeContext()
    const workout = insertWorkoutLog({
      completedAt: new Date("2024-06-01T11:00:00Z"),
    })

    await saveFeedbackOperation(
      db,
      saveFeedbackInputSchema.parse({
        workoutLogId: workout.id,
        fatigueRating: 2,
        notes: "   ",
      })
    )

    const [saved] = await db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, workout.id))

    expect(saved.notes).toBeNull()
  })

  it("rejects missing workouts", async () => {
    const { db } = makeContext()

    await expect(
      saveFeedbackOperation(
        db,
        saveFeedbackInputSchema.parse({
          workoutLogId: "missing",
          fatigueRating: 3,
          notes: null,
        })
      )
    ).rejects.toThrow(/not found/i)
  })

  it("rejects incomplete workouts", async () => {
    const { db, insertWorkoutLog } = makeContext()
    const workout = insertWorkoutLog({ completedAt: null })

    await expect(
      saveFeedbackOperation(
        db,
        saveFeedbackInputSchema.parse({
          workoutLogId: workout.id,
          fatigueRating: 3,
          notes: null,
        })
      )
    ).rejects.toThrow(/after completion/i)
  })
})
