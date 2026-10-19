import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type * as schema from "./schema"
import {
  exercise,
  onDemandWorkoutExercise,
  plannedExercise,
  setLog,
  workoutLog,
} from "./schema"
import type { LoadHistory } from "./loadSuggestions"

export function workoutHistory(
  database: BetterSQLite3Database<typeof schema>,
  owner: string | null = null
) {
  const scope =
    owner === null ? isNull(workoutLog.userId) : eq(workoutLog.userId, owner)
  const fields = {
    exerciseId: exercise.id,
    primaryMuscles: exercise.primaryMuscles,
    workoutLogId: workoutLog.id,
    completedAt: workoutLog.completedAt,
    fatigue: workoutLog.fatigueRating,
    notes: workoutLog.notes,
    weightKg: setLog.weightKg,
    reps: setLog.reps,
    rirActual: setLog.rirActual,
    setNumber: setLog.setNumber,
    prescriptionId: setLog.plannedExerciseId,
    loggedAt: setLog.loggedAt,
  }
  const planned = database
    .select(fields)
    .from(setLog)
    .innerJoin(workoutLog, eq(setLog.workoutLogId, workoutLog.id))
    .innerJoin(
      plannedExercise,
      eq(setLog.plannedExerciseId, plannedExercise.id)
    )
    .innerJoin(exercise, eq(plannedExercise.exerciseId, exercise.id))
    .where(and(scope, isNotNull(workoutLog.completedAt)))
    .orderBy(desc(workoutLog.completedAt), desc(setLog.loggedAt))
    .all()
  const onDemand = database
    .select({ ...fields, prescriptionId: setLog.onDemandWorkoutExerciseId })
    .from(setLog)
    .innerJoin(workoutLog, eq(setLog.workoutLogId, workoutLog.id))
    .innerJoin(
      onDemandWorkoutExercise,
      eq(setLog.onDemandWorkoutExerciseId, onDemandWorkoutExercise.id)
    )
    .innerJoin(exercise, eq(onDemandWorkoutExercise.exerciseId, exercise.id))
    .where(and(scope, isNotNull(workoutLog.completedAt)))
    .orderBy(desc(workoutLog.completedAt), desc(setLog.loggedAt))
    .all()
  const rows = [
    ...planned.map((r) => ({ ...r, source: "planned" as const })),
    ...onDemand.map((r) => ({ ...r, source: "on_demand_workout" as const })),
  ].sort(
    (a, b) =>
      b.completedAt!.getTime() - a.completedAt!.getTime() ||
      b.loggedAt.getTime() - a.loggedAt.getTime()
  )
  const latest = new Map<string, LoadHistory>()
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.workoutLogId}:${row.prescriptionId}:${row.setNumber}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!latest.has(row.exerciseId))
      latest.set(row.exerciseId, {
        workoutLogId: row.workoutLogId,
        completedAt: row.completedAt!.toISOString(),
        sets: [],
      })
    const entry = latest.get(row.exerciseId)!
    if (entry.workoutLogId === row.workoutLogId)
      entry.sets.push({
        weightKg: row.weightKg,
        reps: row.reps,
        rirActual: row.rirActual,
      })
  }
  const recent = new Map<
    string,
    {
      date: string
      source: string
      muscles: string[]
      exerciseIds: string[]
      workingSets: number
      fatigue: number | null
      note: string
      representativeSet: {
        weightKg: number
        reps: number
        rirActual: number | null
      }
    }
  >()
  for (const r of rows.filter(
    (r) => r.completedAt!.getTime() >= Date.now() - 7 * 86400000
  )) {
    let summary = recent.get(r.workoutLogId)
    if (!summary) {
      summary = {
        date: r.completedAt!.toISOString(),
        source: r.source,
        muscles: [],
        exerciseIds: [],
        workingSets: 0,
        fatigue: r.fatigue,
        note: (r.notes ?? "").slice(0, 120),
        representativeSet: {
          weightKg: r.weightKg,
          reps: r.reps,
          rirActual: r.rirActual,
        },
      }
      recent.set(r.workoutLogId, summary)
    }
    summary.muscles = [...new Set([...summary.muscles, ...r.primaryMuscles])]
    summary.exerciseIds = [...new Set([...summary.exerciseIds, r.exerciseId])]
    summary.workingSets++
  }
  return { latest, recent: [...recent.values()].slice(0, 14) }
}
