// @vitest-environment node
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import * as schema from "../lib/schema"
import { migrateWorkoutDatabase } from "./migrate"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "strength-migrate-"))
  directories.push(directory)
  const initial = join(directory, "initial")
  mkdirSync(join(initial, "meta"), { recursive: true })
  const journal = JSON.parse(
    readFileSync(resolve("drizzle/meta/_journal.json"), "utf8")
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries.slice(0, 2))
    copyFileSync(
      resolve(`drizzle/${entry.tag}.sql`),
      join(initial, `${entry.tag}.sql`)
    )
  writeFileSync(
    join(initial, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 2) })
  )
  const path = join(directory, "upgrade.db"),
    sqlite = new Database(path),
    db = drizzle({ client: sqlite, schema })
  migrateWorkoutDatabase(db, sqlite, initial)
  sqlite.exec(`INSERT INTO exercise VALUES ('ex','Squat','squat','["quads"]','["barbell"]');
    INSERT INTO user_profile (id,goal,experience,equipment,sessions_per_week,session_length_min,units) VALUES ('profile','strength','beginner','["barbell"]',3,60,'kg');
    INSERT INTO program (id,name,weeks_total,sessions_per_week,ai_rationale) VALUES ('prog','Original',4,3,'Original rationale');
    INSERT INTO session_template (id,program_id,week_number,day_label,focus) VALUES ('session','prog',1,'Lower','strength');
    INSERT INTO planned_exercise (id,session_template_id,exercise_id,order_index,sets,rep_range,load_kg,rir_target,rest_seconds,coach_note) VALUES ('planned','session','ex',0,1,'8-12',42.5,2,60,'Original cue');
    INSERT INTO workout_log (id,session_template_id,started_at,completed_at,fatigue_rating,notes) VALUES ('run','session',1700000000,1700000100,3,'Original note');
    INSERT INTO set_log (id,workout_log_id,planned_exercise_id,set_number,weight_kg,reps,rir_actual,logged_at) VALUES ('s1','run','planned',1,42.5,12,2,1700000050),('s2','run','planned',1,45,12,3,1700000060);`)
  return { directory, path, sqlite, db }
}

describe("production migration runner", () => {
  it("preserves every original value including duplicate sets and survives a second file-backed startup", () => {
    const { sqlite, db, path } = fixture()
    const tables = [
      "exercise",
      "user_profile",
      "program",
      "session_template",
      "planned_exercise",
      "workout_log",
      "set_log",
    ]
    const before = tables.map(
      (table) =>
        sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Record<
          string,
          unknown
        >[]
    )
    migrateWorkoutDatabase(db, sqlite)
    tables.forEach((table, i) => {
      const rows = sqlite
        .prepare(`SELECT * FROM ${table} ORDER BY id`)
        .all() as Record<string, unknown>[]
      expect(rows).toHaveLength(before[i].length)
      rows.forEach((row, j) => expect(row).toMatchObject(before[i][j]))
    })
    expect(sqlite.pragma("foreign_key_check")).toEqual([])
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok")
    sqlite.close()
    const reopened = new Database(path)
    try {
      migrateWorkoutDatabase(drizzle({ client: reopened, schema }), reopened)
      expect(
        reopened
          .prepare("SELECT count(*) AS count FROM __drizzle_migrations")
          .get()
      ).toEqual({ count: 3 })
      expect(reopened.pragma("foreign_keys", { simple: true })).toBe(1)
    } finally {
      reopened.close()
    }
  })
  it("rolls back schema and ledger together on assertion failure and restores FK enforcement", () => {
    const { sqlite, db, path } = fixture()
    sqlite.pragma("foreign_keys = OFF")
    sqlite.exec(
      "UPDATE set_log SET planned_exercise_id = 'missing' WHERE id = 's2'"
    )
    expect(() => migrateWorkoutDatabase(db, sqlite)).toThrow()
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1)
    sqlite.close()
    const reopened = new Database(path)
    try {
      expect(
        reopened
          .prepare("SELECT count(*) AS count FROM __drizzle_migrations")
          .get()
      ).toEqual({ count: 2 })
      expect(
        reopened
          .prepare(
            "SELECT name FROM sqlite_master WHERE name='on_demand_workout'"
          )
          .get()
      ).toBeUndefined()
      expect(
        reopened.prepare("SELECT count(*) AS count FROM set_log").get()
      ).toEqual({ count: 2 })
      reopened.exec(
        "UPDATE set_log SET planned_exercise_id = 'planned' WHERE id = 's2'"
      )
      migrateWorkoutDatabase(drizzle({ client: reopened, schema }), reopened)
      expect(reopened.pragma("foreign_key_check")).toEqual([])
    } finally {
      reopened.close()
    }
  })
})
