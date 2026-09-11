import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import Database from "better-sqlite3"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/better-sqlite3"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "../../lib/schema"
import {
  exercise,
  plannedExercise,
  program,
  sessionTemplate,
  setLog,
  userProfile,
  workoutLog,
} from "../../lib/schema"

export const E2E_IDS = {
  profile: "e2e-profile",
  program: "e2e-program",
  currentSession: "e2e-session-current",
  futureSession: "e2e-session-future",
  currentPlannedExercise: "e2e-planned-bench-current",
  futurePlannedExercise: "e2e-planned-bench-future",
  resumableWorkout: "e2e-workout-resumable",
  completedWorkout: "e2e-workout-completed",
  resumableSet: "e2e-set-resumable-1",
  completedSetOne: "e2e-set-completed-1",
  completedSetTwo: "e2e-set-completed-2",
  visualWorkout: "e2e-workout-visual",
} as const

export const E2E_VISUAL_TIMESTAMP = "2026-01-05T12:00:00.000Z"

export type E2EScenario =
  | "no-profile"
  | "active-program"
  | "resumable-workout"
  | "completed-workout"
  | "visual-workout"

export interface E2EDatabase {
  db: BetterSQLite3Database<typeof schema>
  sqlite: Database.Database
}

const resultsRoot = resolve(process.cwd(), "test-results")
const e2eDatabasePath = resolve(resultsRoot, "e2e", "strength.db")

function assertSafeDatabaseReset(databasePath: string): void {
  if (process.env.STRENGTH_AI_E2E !== "1") {
    throw new Error("Refusing to reset SQLite without STRENGTH_AI_E2E=1.")
  }

  const relativePath = relative(resultsRoot, databasePath)
  const isInsideResults =
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)

  if (!isInsideResults) {
    throw new Error(
      `Refusing to reset an E2E database outside test-results: ${databasePath}`
    )
  }
}

export function openE2EDatabase(): E2EDatabase {
  assertSafeDatabaseReset(e2eDatabasePath)
  mkdirSync(dirname(e2eDatabasePath), { recursive: true })
  const sqlite = new Database(e2eDatabasePath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  return { db: drizzle({ client: sqlite, schema }), sqlite }
}

function resetMutableData(database: E2EDatabase["db"]): void {
  database.transaction((tx) => {
    tx.delete(setLog).run()
    tx.delete(workoutLog).run()
    tx.delete(plannedExercise).run()
    tx.delete(sessionTemplate).run()
    tx.delete(program).run()
    tx.delete(userProfile).run()
  })
}

function seedActiveProgram(database: E2EDatabase["db"]): void {
  const benchPress = database
    .select({ id: exercise.id })
    .from(exercise)
    .where(eq(exercise.name, "Barbell Bench Press"))
    .limit(1)
    .all()[0]

  if (!benchPress) {
    throw new Error(
      "The E2E database has not been migrated and seeded with exercises."
    )
  }

  const createdAt = new Date(Date.now() - 60_000)

  database
    .insert(userProfile)
    .values({
      id: E2E_IDS.profile,
      goal: "strength",
      experience: "intermediate",
      equipment: ["barbell", "bench", "rack"],
      sessionsPerWeek: 1,
      sessionLengthMin: 45,
      customDirectives: "Keep sessions focused and efficient.",
      units: "kg",
      userId: null,
      createdAt,
    })
    .run()

  database
    .insert(program)
    .values({
      id: E2E_IDS.program,
      name: "Focused Strength Block",
      weeksTotal: 4,
      sessionsPerWeek: 1,
      status: "active",
      aiRationale:
        "A focused bench progression with repeat exposures and deliberate recovery.",
      userId: null,
      createdAt,
    })
    .run()

  database
    .insert(sessionTemplate)
    .values([
      {
        id: E2E_IDS.currentSession,
        programId: E2E_IDS.program,
        weekNumber: 1,
        dayLabel: "Upper Strength",
        focus: "strength",
        userId: null,
        createdAt,
      },
      {
        id: E2E_IDS.futureSession,
        programId: E2E_IDS.program,
        weekNumber: 2,
        dayLabel: "Upper Strength",
        focus: "strength",
        userId: null,
        createdAt: new Date(createdAt.getTime() + 1_000),
      },
    ])
    .run()

  database
    .insert(plannedExercise)
    .values([
      {
        id: E2E_IDS.currentPlannedExercise,
        sessionTemplateId: E2E_IDS.currentSession,
        exerciseId: benchPress.id,
        orderIndex: 0,
        sets: 2,
        repRange: "4-6",
        loadKg: 100,
        rirTarget: 2,
        restSeconds: 90,
        coachNote: "Drive both feet down and keep the bar path controlled.",
        userId: null,
        createdAt,
      },
      {
        id: E2E_IDS.futurePlannedExercise,
        sessionTemplateId: E2E_IDS.futureSession,
        exerciseId: benchPress.id,
        orderIndex: 0,
        sets: 2,
        repRange: "4-6",
        loadKg: 100,
        rirTarget: 2,
        restSeconds: 90,
        coachNote: "Repeat the same setup before adding load.",
        userId: null,
        createdAt,
      },
    ])
    .run()
}

function seedResumableWorkout(database: E2EDatabase["db"]): void {
  const startedAt = new Date(Date.now() - 120_000)

  database
    .insert(workoutLog)
    .values({
      id: E2E_IDS.resumableWorkout,
      sessionTemplateId: E2E_IDS.currentSession,
      startedAt,
      completedAt: null,
      userId: null,
    })
    .run()

  database
    .insert(setLog)
    .values({
      id: E2E_IDS.resumableSet,
      workoutLogId: E2E_IDS.resumableWorkout,
      plannedExerciseId: E2E_IDS.currentPlannedExercise,
      setNumber: 1,
      weightKg: 100,
      reps: 6,
      rirActual: 2,
      loggedAt: new Date(startedAt.getTime() + 30_000),
      userId: null,
    })
    .run()
}

function seedVisualWorkout(database: E2EDatabase["db"]): void {
  database
    .insert(workoutLog)
    .values({
      id: E2E_IDS.visualWorkout,
      sessionTemplateId: E2E_IDS.currentSession,
      startedAt: new Date(E2E_VISUAL_TIMESTAMP),
      completedAt: null,
      userId: null,
    })
    .run()
}

function seedCompletedWorkout(database: E2EDatabase["db"]): void {
  const startedAt = new Date(Date.now() - 10 * 60_000)
  const completedAt = new Date(Date.now() - 60_000)

  database
    .insert(workoutLog)
    .values({
      id: E2E_IDS.completedWorkout,
      sessionTemplateId: E2E_IDS.currentSession,
      startedAt,
      completedAt,
      userId: null,
    })
    .run()

  database
    .insert(setLog)
    .values([
      {
        id: E2E_IDS.completedSetOne,
        workoutLogId: E2E_IDS.completedWorkout,
        plannedExerciseId: E2E_IDS.currentPlannedExercise,
        setNumber: 1,
        weightKg: 100,
        reps: 6,
        rirActual: 2,
        loggedAt: new Date(startedAt.getTime() + 60_000),
        userId: null,
      },
      {
        id: E2E_IDS.completedSetTwo,
        workoutLogId: E2E_IDS.completedWorkout,
        plannedExerciseId: E2E_IDS.currentPlannedExercise,
        setNumber: 2,
        weightKg: 100,
        reps: 6,
        rirActual: 2,
        loggedAt: new Date(startedAt.getTime() + 180_000),
        userId: null,
      },
    ])
    .run()
}

export function seedScenario(
  database: E2EDatabase["db"],
  scenario: E2EScenario
): void {
  assertSafeDatabaseReset(e2eDatabasePath)
  resetMutableData(database)

  if (scenario === "no-profile") return

  seedActiveProgram(database)

  if (scenario === "resumable-workout") {
    seedResumableWorkout(database)
  }

  if (scenario === "completed-workout") {
    seedCompletedWorkout(database)
  }

  if (scenario === "visual-workout") {
    seedVisualWorkout(database)
  }
}

export function findWorkoutSets(
  database: E2EDatabase["db"],
  workoutLogId: string
) {
  return database
    .select()
    .from(setLog)
    .where(eq(setLog.workoutLogId, workoutLogId))
    .all()
}

export function findCurrentWorkout(database: E2EDatabase["db"]) {
  return database
    .select()
    .from(workoutLog)
    .where(eq(workoutLog.sessionTemplateId, E2E_IDS.currentSession))
    .all()
}

export function findFuturePrescription(database: E2EDatabase["db"]) {
  return database
    .select()
    .from(plannedExercise)
    .where(
      and(
        eq(plannedExercise.id, E2E_IDS.futurePlannedExercise),
        eq(plannedExercise.sessionTemplateId, E2E_IDS.futureSession)
      )
    )
    .limit(1)
    .all()[0]
}

export function preserveFailedDatabase(testOutputPath: string): string | null {
  if (!existsSync(e2eDatabasePath)) return null

  copyFileSync(e2eDatabasePath, testOutputPath)
  return testOutputPath
}
