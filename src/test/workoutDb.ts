import path from "node:path"
import Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "../../lib/schema"
import type {
  InsertExercise,
  InsertPlannedExercise,
  InsertProgram,
  InsertSessionTemplate,
  InsertSetLog,
  InsertWorkoutLog,
} from "../../lib/schema"

export interface WorkoutTestDb {
  db: BetterSQLite3Database<typeof schema>
  sqlite: Database.Database
  close: () => void
  insertExercise: (overrides?: Partial<InsertExercise>) => InsertExercise
  insertProgram: (overrides?: Partial<InsertProgram>) => InsertProgram
  insertSessionTemplate: (
    overrides?: Partial<InsertSessionTemplate>
  ) => InsertSessionTemplate
  insertPlannedExercise: (
    overrides?: Partial<InsertPlannedExercise>
  ) => InsertPlannedExercise
  insertWorkoutLog: (overrides?: Partial<InsertWorkoutLog>) => InsertWorkoutLog
  insertSetLog: (overrides?: Partial<InsertSetLog>) => InsertSetLog
}

export function createWorkoutTestDb(): WorkoutTestDb {
  const sqlite = new Database(":memory:")
  sqlite.pragma("foreign_keys = ON")

  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") })

  let nextId = 1
  const makeId = (prefix: string) => `${prefix}-${nextId++}`

  const insertExercise = (overrides?: Partial<InsertExercise>) => {
    const row: InsertExercise = {
      id: makeId("ex"),
      name: "Back Squat",
      movement: "squat",
      primaryMuscles: ["quads"],
      equipment: ["barbell"],
      ...overrides,
    }

    db.insert(schema.exercise).values(row).run()
    return row
  }

  const insertProgram = (overrides?: Partial<InsertProgram>) => {
    const row: InsertProgram = {
      id: makeId("program"),
      name: "Base Strength",
      weeksTotal: 4,
      sessionsPerWeek: 3,
      status: "active",
      aiRationale: "Test rationale",
      userId: "user-1",
      ...overrides,
    }

    db.insert(schema.program).values(row).run()
    return row
  }

  const insertSessionTemplate = (
    overrides?: Partial<InsertSessionTemplate>
  ) => {
    const row: InsertSessionTemplate = {
      id: makeId("session"),
      programId: overrides?.programId ?? insertProgram().id,
      weekNumber: 1,
      dayLabel: "Lower A",
      focus: "strength",
      userId: "user-1",
      ...overrides,
    }

    db.insert(schema.sessionTemplate).values(row).run()
    return row
  }

  const insertPlannedExercise = (
    overrides?: Partial<InsertPlannedExercise>
  ) => {
    const row: InsertPlannedExercise = {
      id: makeId("planned"),
      sessionTemplateId:
        overrides?.sessionTemplateId ?? insertSessionTemplate().id,
      exerciseId: overrides?.exerciseId ?? insertExercise().id,
      orderIndex: 0,
      sets: 3,
      repRange: "5-7",
      loadKg: 100,
      rirTarget: 2,
      restSeconds: 120,
      coachNote: null,
      userId: "user-1",
      ...overrides,
    }

    db.insert(schema.plannedExercise).values(row).run()
    return row
  }

  const insertWorkoutLog = (overrides?: Partial<InsertWorkoutLog>) => {
    const row: InsertWorkoutLog = {
      id: makeId("workout"),
      sessionTemplateId:
        overrides?.sessionTemplateId ?? insertSessionTemplate().id,
      startedAt: new Date("2024-06-01T10:00:00Z"),
      completedAt: null,
      fatigueRating: null,
      notes: null,
      userId: "user-1",
      ...overrides,
    }

    db.insert(schema.workoutLog).values(row).run()
    return row
  }

  const insertSetLog = (overrides?: Partial<InsertSetLog>) => {
    const row: InsertSetLog = {
      id: makeId("setlog"),
      workoutLogId: overrides?.workoutLogId ?? insertWorkoutLog().id,
      plannedExerciseId:
        overrides?.plannedExerciseId ?? insertPlannedExercise().id,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
      rirActual: 2,
      loggedAt: new Date("2024-06-01T10:15:00Z"),
      userId: "user-1",
      ...overrides,
    }

    db.insert(schema.setLog).values(row).run()
    return row
  }

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
    insertExercise,
    insertProgram,
    insertSessionTemplate,
    insertPlannedExercise,
    insertWorkoutLog,
    insertSetLog,
  }
}
