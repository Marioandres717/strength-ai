import { workoutHistory } from "../../lib/workoutHistory.server"
import { and, desc, eq, isNull } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type * as schema from "../../lib/schema"
import {
  exercise,
  plannedExercise,
  program,
  sessionTemplate,
  setLog,
  userProfile,
  workoutLog,
} from "../../lib/schema"
import type {
  GetSessionDataResult,
  PersistedSetLog,
  SessionExerciseRow,
} from "./getSessionData"

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
  const [profile] = await database
    .select({ units: userProfile.units })
    .from(userProfile)
    .orderBy(desc(userProfile.createdAt))
    .limit(1)
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

  const history = workoutHistory(database, tmpl.userId)
  const exercises: SessionExerciseRow[] = exerciseRows.map((row) => {
    const prior = history.latest.get(row.exercise.id)
    const set = prior?.sets[0]
    return {
      ...row,
      priorPerformance:
        prior && set ? { ...set, date: prior.completedAt } : null,
    }
  })

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
      plannedExerciseId: plannedExercise.id,
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
    units: profile?.units ?? "kg",
    sessionTemplate: tmpl,
    program: prog,
    exercises,
    workoutLogId,
    startedAt,
    persistedSets,
  }
}
