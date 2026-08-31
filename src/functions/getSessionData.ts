import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, isNull } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { z } from "zod"
import { db } from "../../lib/db"
import type * as schema from "../../lib/schema"
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

export interface PersistedSetLog {
  setLogId: string
  plannedExerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
}

export interface GetSessionDataResult {
  sessionTemplate: SelectSessionTemplate
  program: SelectProgram
  exercises: SessionExerciseRow[]
  workoutLogId: string
  startedAt: Date
  persistedSets: PersistedSetLog[]
}

const inputSchema = z.object({
  sessionTemplateId: z.string().min(1),
})

function toIsoDate(value: Date | number | null) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString()
  }

  return new Date().toISOString()
}

function dedupePersistedSets(entries: PersistedSetLog[]) {
  const deduped = new Map<string, PersistedSetLog>()

  for (const entry of entries) {
    const key = `${entry.plannedExerciseId}:${entry.setNumber}`
    const existing = deduped.get(key)

    if (!existing || entry.loggedAt.getTime() >= existing.loggedAt.getTime()) {
      deduped.set(key, entry)
    }
  }

  return [...deduped.values()]
}

export async function getSessionDataOperation(
  database: BetterSQLite3Database<typeof schema>,
  sessionTemplateId: string
): Promise<GetSessionDataResult> {
  const templates = await database
    .select()
    .from(sessionTemplate)
    .where(eq(sessionTemplate.id, sessionTemplateId))
    .limit(1)

  if (templates.length === 0) {
    throw new Error(`Session template not found: ${sessionTemplateId}`)
  }

  const tmpl = templates[0]

  const programs = await database
    .select()
    .from(program)
    .where(eq(program.id, tmpl.programId))
    .limit(1)

  if (programs.length === 0) {
    throw new Error(`Program not found: ${tmpl.programId}`)
  }

  const prog = programs[0]

  const exerciseRows = await database
    .select({ planned: plannedExercise, exercise: exercise })
    .from(plannedExercise)
    .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
    .where(eq(plannedExercise.sessionTemplateId, sessionTemplateId))
    .orderBy(plannedExercise.orderIndex)

  const exercises: SessionExerciseRow[] = await Promise.all(
    exerciseRows.map(async (row) => {
      const priorSets = await database
        .select({
          weightKg: setLog.weightKg,
          reps: setLog.reps,
          rirActual: setLog.rirActual,
          completedAt: workoutLog.completedAt,
        })
        .from(setLog)
        .innerJoin(workoutLog, eq(setLog.workoutLogId, workoutLog.id))
        .where(eq(setLog.plannedExerciseId, row.planned.id))
        .orderBy(desc(workoutLog.completedAt), desc(setLog.setNumber))
        .limit(10)

      const completedSet = priorSets.find((set) => set.completedAt != null)

      return {
        planned: row.planned,
        exercise: row.exercise,
        priorPerformance: completedSet
          ? {
              weightKg: completedSet.weightKg,
              reps: completedSet.reps,
              rirActual: completedSet.rirActual,
              date: toIsoDate(completedSet.completedAt),
            }
          : null,
      }
    })
  )

  const inProgressLogs = await database
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
        : new Date(existing.startedAt * 1000)
  } else {
    workoutLogId = crypto.randomUUID()
    startedAt = new Date()

    await database.insert(workoutLog).values({
      id: workoutLogId,
      sessionTemplateId,
      startedAt,
    })
  }

  const persistedSetRows = await database
    .select({
      setLogId: setLog.id,
      plannedExerciseId: setLog.plannedExerciseId,
      setNumber: setLog.setNumber,
      weightKg: setLog.weightKg,
      reps: setLog.reps,
      rirActual: setLog.rirActual,
      loggedAt: setLog.loggedAt,
      orderIndex: plannedExercise.orderIndex,
    })
    .from(setLog)
    .innerJoin(
      plannedExercise,
      eq(setLog.plannedExerciseId, plannedExercise.id)
    )
    .where(eq(setLog.workoutLogId, workoutLogId))
    .orderBy(
      plannedExercise.orderIndex,
      setLog.setNumber,
      desc(setLog.loggedAt)
    )

  const persistedSets = dedupePersistedSets(
    persistedSetRows.map((row) => ({
      setLogId: row.setLogId,
      plannedExerciseId: row.plannedExerciseId,
      setNumber: row.setNumber,
      weightKg: row.weightKg,
      reps: row.reps,
      rirActual: row.rirActual ?? 0,
      loggedAt:
        row.loggedAt instanceof Date ? row.loggedAt : new Date(row.loggedAt),
    }))
  ).sort((left, right) => {
    const leftExercise = exerciseRows.find(
      (row) => row.planned.id === left.plannedExerciseId
    )
    const rightExercise = exerciseRows.find(
      (row) => row.planned.id === right.plannedExerciseId
    )

    if (!leftExercise || !rightExercise) {
      return left.setNumber - right.setNumber
    }

    if (leftExercise.planned.orderIndex !== rightExercise.planned.orderIndex) {
      return leftExercise.planned.orderIndex - rightExercise.planned.orderIndex
    }

    return left.setNumber - right.setNumber
  })

  return {
    sessionTemplate: tmpl,
    program: prog,
    exercises,
    workoutLogId,
    startedAt,
    persistedSets,
  }
}

export const getSessionDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) => getSessionDataOperation(db, data.sessionTemplateId))
