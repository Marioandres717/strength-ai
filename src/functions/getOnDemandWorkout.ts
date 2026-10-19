import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "../../lib/db"
import { onDemandWorkout } from "../../lib/schema"
import { getOnDemandWorkoutOperation } from "../../lib/onDemandWorkouts.server"
export const getOnDemandWorkoutFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ onDemandWorkoutId: z.uuid() }).parse(data)
  )
  .handler(({ data }) => {
    const definition = db
      .select({ id: onDemandWorkout.id })
      .from(onDemandWorkout)
      .where(
        and(
          eq(onDemandWorkout.id, data.onDemandWorkoutId),
          isNull(onDemandWorkout.userId),
          isNull(onDemandWorkout.deletedAt)
        )
      )
      .get()
    return definition ? getOnDemandWorkoutOperation(db, definition.id) : null
  })
