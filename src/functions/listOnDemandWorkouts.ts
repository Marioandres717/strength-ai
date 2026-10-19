import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { listOnDemandWorkoutsOperation } from "../../lib/onDemandWorkouts.server"
export const listOnDemandWorkoutsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z
          .object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() })
          .optional(),
      })
      .parse(data)
  )
  .handler(({ data }) => listOnDemandWorkoutsOperation(db, data))
