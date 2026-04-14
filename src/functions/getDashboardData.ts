import { createServerFn } from "@tanstack/react-start"
import { desc, eq, and } from "drizzle-orm"
import { db } from "../../lib/db"
import {
  userProfile,
  program,
  sessionTemplate,
  plannedExercise,
  exercise,
  workoutLog,
} from "../../lib/schema"
import type {
  SelectUserProfile,
  SelectProgram,
  SelectSessionTemplate,
  SelectPlannedExercise,
  SelectExercise,
  SelectWorkoutLog,
} from "../../lib/schema"

export interface SessionWithExercises {
  template: SelectSessionTemplate
  exercises: { exercise: SelectExercise; planned: SelectPlannedExercise }[]
  workoutLog: SelectWorkoutLog | null
}

export type DashboardState =
  | { kind: "no_profile" }
  | { kind: "no_program"; profile: SelectUserProfile }
  | {
      kind: "active"
      profile: SelectUserProfile
      program: SelectProgram
      currentWeek: number
      sessionsThisWeek: SessionWithExercises[]
      nextSession: SessionWithExercises | null
    }

export const getDashboardDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardState> => {
    // 1. Fetch most-recent profile (single-user app, userId = null)
    const profiles = await db
      .select()
      .from(userProfile)
      .orderBy(desc(userProfile.createdAt))
      .limit(1)
    if (profiles.length === 0) return { kind: "no_profile" }
    const profile = profiles[0]

    // 2. Fetch active program
    const programs = await db
      .select()
      .from(program)
      .where(eq(program.status, "active"))
      .limit(1)
    if (programs.length === 0) return { kind: "no_program", profile }
    const activeProgram = programs[0]

    // 3. Compute current week (1-indexed, clamped to weeksTotal)
    // Drizzle with mode:"timestamp" on SQLite integer columns returns a Date object
    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    const programStartMs =
      activeProgram.createdAt instanceof Date
        ? activeProgram.createdAt.getTime()
        : (activeProgram.createdAt as number) * 1000
    const rawWeek = Math.floor((Date.now() - programStartMs) / msPerWeek) + 1
    const currentWeek = Math.max(1, Math.min(rawWeek, activeProgram.weeksTotal))

    // 4. Fetch session templates for current week, ordered by insertion (AI-defined order)
    const templates = await db
      .select()
      .from(sessionTemplate)
      .where(
        and(
          eq(sessionTemplate.programId, activeProgram.id),
          eq(sessionTemplate.weekNumber, currentWeek)
        )
      )
      .orderBy(sessionTemplate.createdAt)

    // 5. For each template, load exercises + latest workout log in parallel
    const sessionsThisWeek: SessionWithExercises[] = await Promise.all(
      templates.map(async (tmpl) => {
        const exerciseRows = await db
          .select({ planned: plannedExercise, exercise: exercise })
          .from(plannedExercise)
          .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
          .where(eq(plannedExercise.sessionTemplateId, tmpl.id))
          .orderBy(plannedExercise.orderIndex)

        const logs = await db
          .select()
          .from(workoutLog)
          .where(eq(workoutLog.sessionTemplateId, tmpl.id))
          .orderBy(desc(workoutLog.startedAt))
          .limit(1)

        return {
          template: tmpl,
          exercises: exerciseRows.map((r) => ({
            exercise: r.exercise,
            planned: r.planned,
          })),
          workoutLog: logs[0] ?? null,
        }
      })
    )

    // 6. Next session = first session without a completed workout log
    const nextSession =
      sessionsThisWeek.find((s) => s.workoutLog?.completedAt == null) ?? null

    return {
      kind: "active",
      profile,
      program: activeProgram,
      currentWeek,
      sessionsThisWeek,
      nextSession,
    }
  }
)
