import { createServerFn } from "@tanstack/react-start"
import { desc, isNull } from "drizzle-orm"
import { db } from "../../lib/db"
import { userProfile } from "../../lib/schema"

export const getOnDemandWorkoutDefaultsFn = createServerFn({
  method: "GET",
}).handler(() => {
  const profile = db
    .select()
    .from(userProfile)
    .where(isNull(userProfile.userId))
    .orderBy(desc(userProfile.createdAt))
    .get()
  return {
    experience: profile?.experience ?? "beginner",
    equipment: profile?.equipment ?? ["dumbbell"],
    timeMinutes: profile?.sessionLengthMin ?? 30,
    units: profile?.units ?? "kg",
    focus:
      profile?.goal === "strength"
        ? ("strength" as const)
        : profile?.goal === "hypertrophy"
          ? ("hypertrophy" as const)
          : ("mixed" as const),
  }
})
