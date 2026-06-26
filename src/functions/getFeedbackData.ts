import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../lib/db"
import {
  exercise,
  plannedExercise,
  sessionTemplate,
  setLog,
  workoutLog,
} from "../../lib/schema"
import { computeProgression } from "../../lib/rules"
import type { ProgressionChange } from "./completeSession"

export interface GetFeedbackDataResult {
  workoutLogId: string
  sessionName: string
  progressionChanges: ProgressionChange[]
}

const inputSchema = z.object({
  workoutLogId: z.string().min(1),
})

export const getFeedbackDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<GetFeedbackDataResult> => {
    const { workoutLogId } = data

    // Fetch workout log
    const logs = await db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, workoutLogId))
      .limit(1)

    if (logs.length === 0) {
      throw new Error(`Workout log not found: ${workoutLogId}`)
    }
    const log = logs[0]

    // Fetch session template for the name
    const templates = await db
      .select()
      .from(sessionTemplate)
      .where(eq(sessionTemplate.id, log.sessionTemplateId))
      .limit(1)

    const sessionName = templates[0]?.dayLabel ?? "Workout"

    // Fetch all set_log rows joined to planned_exercise and exercise
    const allSets = await db
      .select({
        setLog: setLog,
        planned: plannedExercise,
        exercise: exercise,
      })
      .from(setLog)
      .innerJoin(
        plannedExercise,
        eq(setLog.plannedExerciseId, plannedExercise.id)
      )
      .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
      .where(eq(setLog.workoutLogId, workoutLogId))

    // Group sets by plannedExerciseId and compute progression
    const setsByExercise = new Map<
      string,
      {
        planned: (typeof allSets)[0]["planned"]
        exercise: (typeof allSets)[0]["exercise"]
        sets: (typeof allSets)[0]["setLog"][]
      }
    >()

    for (const row of allSets) {
      const key = row.planned.id
      if (!setsByExercise.has(key)) {
        setsByExercise.set(key, {
          planned: row.planned,
          exercise: row.exercise,
          sets: [],
        })
      }
      setsByExercise.get(key)!.sets.push(row.setLog)
    }

    const progressionChanges: ProgressionChange[] = []

    for (const [, { planned, exercise: ex, sets }] of setsByExercise) {
      const decision = computeProgression(
        {
          plannedExerciseId: planned.id,
          sets: planned.sets,
          repRange: planned.repRange,
          loadKg: planned.loadKg,
          rirTarget: planned.rirTarget,
        },
        sets.map((s) => ({
          setNumber: s.setNumber,
          weightKg: s.weightKg,
          reps: s.reps,
          rirActual: s.rirActual,
        }))
      )

      if (decision.kind === "increase") {
        progressionChanges.push({
          plannedExerciseId: planned.id,
          exerciseName: ex.name,
          oldLoadKg: planned.loadKg,
          newLoadKg: decision.newLoadKg,
          reason: decision.reason,
        })
      }
    }

    return {
      workoutLogId,
      sessionName,
      progressionChanges,
    }
  })
