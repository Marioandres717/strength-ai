import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, gt } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../lib/db"
import {
  plannedExercise,
  sessionTemplate,
  setLog,
  workoutLog,
} from "../../lib/schema"
import { computeProgression, type SetRecord } from "../../lib/rules"

export interface ProgressionChange {
  plannedExerciseId: string
  exerciseName: string
  oldLoadKg: number
  newLoadKg: number
  reason: string
}

export interface CompleteSessionResult {
  workoutLogId: string
  progressionChanges: ProgressionChange[]
}

const inputSchema = z.object({
  workoutLogId: z.string().min(1),
  sessionTemplateId: z.string().min(1),
})

export const completeSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }): CompleteSessionResult => {
    const { workoutLogId, sessionTemplateId } = data
    const progressionChanges: ProgressionChange[] = []

    db.transaction((tx) => {
      // 1. Mark the workout as completed
      tx.update(workoutLog)
        .set({ completedAt: new Date() })
        .where(eq(workoutLog.id, workoutLogId))
        .run()

      // 2. Fetch all set_log rows for this workout
      const allSets = tx
        .select({
          setLog: setLog,
          planned: plannedExercise,
        })
        .from(setLog)
        .innerJoin(
          plannedExercise,
          eq(setLog.plannedExerciseId, plannedExercise.id)
        )
        .where(eq(setLog.workoutLogId, workoutLogId))
        .all()

      // 3. Fetch the session template to know the weekNumber and programId
      const tmplRows = tx
        .select()
        .from(sessionTemplate)
        .where(eq(sessionTemplate.id, sessionTemplateId))
        .limit(1)
        .all()

      if (tmplRows.length === 0) return
      const tmpl = tmplRows[0]

      // 4. Group sets by plannedExerciseId
      const setsByExercise = new Map<
        string,
        { planned: (typeof allSets)[0]["planned"]; sets: SetRecord[] }
      >()
      for (const row of allSets) {
        const key = row.planned.id
        if (!setsByExercise.has(key)) {
          setsByExercise.set(key, { planned: row.planned, sets: [] })
        }
        setsByExercise.get(key)!.sets.push({
          setNumber: row.setLog.setNumber,
          weightKg: row.setLog.weightKg,
          reps: row.setLog.reps,
          rirActual: row.setLog.rirActual,
        })
      }

      // 5. Run progression for each exercise
      for (const [, { planned, sets }] of setsByExercise) {
        const decision = computeProgression(
          {
            plannedExerciseId: planned.id,
            sets: planned.sets,
            repRange: planned.repRange,
            loadKg: planned.loadKg,
            rirTarget: planned.rirTarget,
          },
          sets
        )

        if (decision.kind !== "increase") continue

        // Find the next session template for the same program after this week
        // that contains the same exercise
        const nextSessionTemplates = tx
          .select({
            id: sessionTemplate.id,
            weekNumber: sessionTemplate.weekNumber,
          })
          .from(sessionTemplate)
          .where(
            and(
              eq(sessionTemplate.programId, tmpl.programId),
              gt(sessionTemplate.weekNumber, tmpl.weekNumber)
            )
          )
          .orderBy(asc(sessionTemplate.weekNumber))
          .all()

        // Find the first next session that contains this exercise
        let updated = false
        for (const nextTmpl of nextSessionTemplates) {
          const nextExercises = tx
            .select()
            .from(plannedExercise)
            .where(
              and(
                eq(plannedExercise.sessionTemplateId, nextTmpl.id),
                eq(plannedExercise.exerciseId, planned.exerciseId)
              )
            )
            .limit(1)
            .all()

          if (nextExercises.length === 0) continue

          tx.update(plannedExercise)
            .set({ loadKg: decision.newLoadKg })
            .where(eq(plannedExercise.id, nextExercises[0].id))
            .run()

          updated = true
          break
        }

        // Record the progression change for the response
        // (even if no future session found — the change info is still useful)
        progressionChanges.push({
          plannedExerciseId: planned.id,
          exerciseName: planned.exerciseId, // will be joined by client if needed
          oldLoadKg: planned.loadKg,
          newLoadKg: decision.newLoadKg,
          reason: decision.reason,
        })

        void updated // used for debugging
      }
    })

    return { workoutLogId, progressionChanges }
  })
