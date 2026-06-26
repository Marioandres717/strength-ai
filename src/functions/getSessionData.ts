import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../lib/db"
import {
  exercise,
  plannedExercise,
  program,
  sessionTemplate,
  setLog,
  workoutLog,
} from "../../lib/schema"
import type {
  SelectExercise,
  SelectPlannedExercise,
  SelectProgram,
  SelectSessionTemplate,
} from "../../lib/schema"
export interface PriorPerformance {
  weightKg: number
  reps: number
  rirActual: number | null
  date: string
}

export interface SessionExerciseRow {
  planned: SelectPlannedExercise
  exercise: SelectExercise
  priorPerformance: PriorPerformance | null
}

export interface GetSessionDataResult {
  sessionTemplate: SelectSessionTemplate
  program: SelectProgram
  exercises: SessionExerciseRow[]
  workoutLogId: string
  startedAt: Date
}

const inputSchema = z.object({
  sessionTemplateId: z.string().min(1),
})

export const getSessionDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<GetSessionDataResult> => {
    const { sessionTemplateId } = data

    // 1. Fetch session template
    const templates = await db
      .select()
      .from(sessionTemplate)
      .where(eq(sessionTemplate.id, sessionTemplateId))
      .limit(1)

    if (templates.length === 0) {
      throw new Error(`Session template not found: ${sessionTemplateId}`)
    }
    const tmpl = templates[0]

    // 2. Fetch program
    const programs = await db
      .select()
      .from(program)
      .where(eq(program.id, tmpl.programId))
      .limit(1)

    if (programs.length === 0) {
      throw new Error(`Program not found: ${tmpl.programId}`)
    }
    const prog = programs[0]

    // 3. Fetch planned exercises joined to exercise library
    const exerciseRows = await db
      .select({ planned: plannedExercise, exercise: exercise })
      .from(plannedExercise)
      .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
      .where(eq(plannedExercise.sessionTemplateId, sessionTemplateId))
      .orderBy(plannedExercise.orderIndex)

    // 4. For each exercise, fetch prior performance (last completed session's last set)
    const exercises: SessionExerciseRow[] = await Promise.all(
      exerciseRows.map(async (row) => {
        // Find the most recent set_log for this planned exercise in any completed workout
        const priorSets = await db
          .select({
            weightKg: setLog.weightKg,
            reps: setLog.reps,
            rirActual: setLog.rirActual,
            completedAt: workoutLog.completedAt,
          })
          .from(setLog)
          .innerJoin(workoutLog, eq(setLog.workoutLogId, workoutLog.id))
          .where(
            and(
              eq(setLog.plannedExerciseId, row.planned.id)
              // Only completed sessions
              // We filter completedAt != null in JS below since isNotNull isn't needed
            )
          )
          .orderBy(desc(workoutLog.completedAt), desc(setLog.setNumber))
          .limit(10) // fetch a few to find the right completed session's last set

        // Filter to only completed sessions and take the first (most recent) set
        const completedSet = priorSets.find((s) => s.completedAt != null)

        const priorPerformance: PriorPerformance | null = completedSet
          ? {
              weightKg: completedSet.weightKg,
              reps: completedSet.reps,
              rirActual: completedSet.rirActual,
              date:
                completedSet.completedAt instanceof Date
                  ? completedSet.completedAt.toISOString()
                  : completedSet.completedAt != null
                    ? new Date(
                        (completedSet.completedAt as unknown as number) * 1000
                      ).toISOString()
                    : new Date().toISOString(),
            }
          : null

        return {
          planned: row.planned,
          exercise: row.exercise,
          priorPerformance,
        }
      })
    )

    // 5. Reuse in-progress workout_log or create a new one
    const inProgressLogs = await db
      .select()
      .from(workoutLog)
      .where(
        and(
          eq(workoutLog.sessionTemplateId, sessionTemplateId),
          isNull(workoutLog.completedAt)
        )
      )
      .orderBy(desc(workoutLog.startedAt))
      .limit(1)

    let workoutLogId: string
    let startedAt: Date

    if (inProgressLogs.length > 0) {
      const existing = inProgressLogs[0]
      workoutLogId = existing.id
      startedAt =
        existing.startedAt instanceof Date
          ? existing.startedAt
          : new Date((existing.startedAt as number) * 1000)
    } else {
      workoutLogId = crypto.randomUUID()
      startedAt = new Date()
      await db.insert(workoutLog).values({
        id: workoutLogId,
        sessionTemplateId,
        startedAt,
      })
    }

    return {
      sessionTemplate: tmpl,
      program: prog,
      exercises,
      workoutLogId,
      startedAt,
    }
  })
