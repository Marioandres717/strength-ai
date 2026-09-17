import { afterEach, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { userProfile } from "../../lib/schema"
import { createWorkoutTestDb } from "../test/workoutDb"
import { getPlanDataOperation } from "./getPlanData"
import { saveUnitsOperation } from "./saveUnits"

const contexts: ReturnType<typeof createWorkoutTestDb>[] = []
afterEach(() => {
  while (contexts.length) contexts.pop()?.close()
})

it("persists the unit preference for later page loads", async () => {
  const context = createWorkoutTestDb()
  contexts.push(context)
  context.db
    .insert(userProfile)
    .values({
      id: "profile",
      goal: "strength",
      experience: "beginner",
      equipment: ["barbell"],
      sessionsPerWeek: 3,
      sessionLengthMin: 60,
    })
    .run()
  context.insertProgram()

  await saveUnitsOperation(context.db, "profile", "lbs")
  expect(
    context.db
      .select()
      .from(userProfile)
      .where(eq(userProfile.id, "profile"))
      .get()?.units
  ).toBe("lbs")
  const plan = await getPlanDataOperation(context.db)
  expect(plan.kind === "active" && plan.profile.units).toBe("lbs")
})
