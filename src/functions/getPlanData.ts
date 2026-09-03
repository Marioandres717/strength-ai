import { createServerFn } from "@tanstack/react-start"
import { asc, desc, eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { db } from "../../lib/db"
import type * as schema from "../../lib/schema"
import {
  exercise,
  plannedExercise,
  program,
  sessionTemplate,
  userProfile,
} from "../../lib/schema"
import type {
  SelectExercise,
  SelectPlannedExercise,
  SelectProgram,
  SelectSessionTemplate,
  SelectUserProfile,
} from "../../lib/schema"

export interface PlanSession {
  template: SelectSessionTemplate
  exercises: { exercise: SelectExercise; planned: SelectPlannedExercise }[]
}

export type PlanDataState =
  | { kind: "no_profile" }
  | { kind: "no_program"; profile: SelectUserProfile }
  | {
      kind: "active"
      profile: SelectUserProfile
      program: SelectProgram
      currentWeek: number
      sessionsByWeek: Record<number, PlanSession[]>
    }

function getCurrentWeek(activeProgram: SelectProgram) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const programStartMs =
    activeProgram.createdAt instanceof Date
      ? activeProgram.createdAt.getTime()
      : activeProgram.createdAt * 1000
  const rawWeek = Math.floor((Date.now() - programStartMs) / msPerWeek) + 1

  return Math.max(1, Math.min(rawWeek, activeProgram.weeksTotal))
}

export async function getPlanDataOperation(
  database: BetterSQLite3Database<typeof schema>
): Promise<PlanDataState> {
  const profiles = await database
    .select()
    .from(userProfile)
    .orderBy(desc(userProfile.createdAt))
    .limit(1)
  if (profiles.length === 0) return { kind: "no_profile" }
  const profile = profiles[0]

  const programs = await database
    .select()
    .from(program)
    .where(eq(program.status, "active"))
    .orderBy(desc(program.createdAt))
    .limit(1)
  if (programs.length === 0) return { kind: "no_program", profile }
  const activeProgram = programs[0]

  const templates = await database
    .select()
    .from(sessionTemplate)
    .where(eq(sessionTemplate.programId, activeProgram.id))
    .orderBy(asc(sessionTemplate.weekNumber), asc(sessionTemplate.createdAt))

  const sessions = await Promise.all(
    templates.map(async (template): Promise<PlanSession> => {
      const rows = await database
        .select({ planned: plannedExercise, exercise })
        .from(plannedExercise)
        .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
        .where(eq(plannedExercise.sessionTemplateId, template.id))
        .orderBy(asc(plannedExercise.orderIndex))

      return { template, exercises: rows }
    })
  )

  const sessionsByWeek: Record<number, PlanSession[]> = {}
  for (const session of sessions) {
    const week = session.template.weekNumber
    sessionsByWeek[week] ??= []
    sessionsByWeek[week].push(session)
  }

  return {
    kind: "active",
    profile,
    program: activeProgram,
    currentWeek: getCurrentWeek(activeProgram),
    sessionsByWeek,
  }
}

export const getPlanDataFn = createServerFn({ method: "GET" }).handler(() =>
  getPlanDataOperation(db)
)
