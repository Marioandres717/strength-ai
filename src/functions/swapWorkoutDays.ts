import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { z } from "zod"
import { db } from "../../lib/db"
import type * as schema from "../../lib/schema"
import { program, sessionTemplate, setLog, workoutLog } from "../../lib/schema"

const inputSchema = z.object({
  firstSessionId: z.string().min(1),
  secondSessionId: z.string().min(1),
})

export function swapWorkoutDaysOperation(
  database: BetterSQLite3Database<typeof schema>,
  firstSessionId: string,
  secondSessionId: string
) {
  if (firstSessionId === secondSessionId) {
    throw new Error("Choose two different workouts to swap.")
  }

  database.transaction((tx) => {
    const [activeProgram] = tx
      .select()
      .from(program)
      .where(eq(program.status, "active"))
      .orderBy(desc(program.createdAt))
      .limit(1)
      .all()
    if (!activeProgram) throw new Error("No active program found.")

    const currentWeek = Math.max(
      1,
      Math.min(
        Math.floor(
          (Date.now() - activeProgram.createdAt.getTime()) / 604800000
        ) + 1,
        activeProgram.weeksTotal
      )
    )
    const sessions = tx
      .select()
      .from(sessionTemplate)
      .where(inArray(sessionTemplate.id, [firstSessionId, secondSessionId]))
      .all()
    if (
      sessions.length !== 2 ||
      sessions.some(
        (session) =>
          session.programId !== activeProgram.id ||
          session.weekNumber !== currentWeek
      )
    ) {
      throw new Error(
        "Choose two workouts from the current week of your active plan."
      )
    }

    const logs = tx
      .select({ id: workoutLog.id, completedAt: workoutLog.completedAt })
      .from(workoutLog)
      .where(
        inArray(workoutLog.sessionTemplateId, [firstSessionId, secondSessionId])
      )
      .all()
    if (logs.some((log) => log.completedAt !== null)) {
      throw new Error("Completed workouts cannot be swapped.")
    }
    if (logs.length > 0) {
      const sets = tx
        .select({ id: setLog.id })
        .from(setLog)
        .where(
          inArray(
            setLog.workoutLogId,
            logs.map((log) => log.id)
          )
        )
        .limit(1)
        .all()
      if (sets.length > 0)
        throw new Error("Workouts with logged sets cannot be swapped.")
    }

    tx.update(sessionTemplate)
      .set({ orderIndex: sessions[1].orderIndex })
      .where(
        and(
          eq(sessionTemplate.id, sessions[0].id),
          eq(sessionTemplate.programId, activeProgram.id)
        )
      )
      .run()
    tx.update(sessionTemplate)
      .set({ orderIndex: sessions[0].orderIndex })
      .where(
        and(
          eq(sessionTemplate.id, sessions[1].id),
          eq(sessionTemplate.programId, activeProgram.id)
        )
      )
      .run()
  })
}

export const swapWorkoutDaysFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) =>
    swapWorkoutDaysOperation(db, data.firstSessionId, data.secondSessionId)
  )
