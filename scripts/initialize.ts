import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { db, sqlite } from "../lib/db"
import { seedExercises } from "../lib/seed"

const migrationsDirectory = resolve(process.cwd(), "drizzle")

// Existing development databases were created with `drizzle-kit push` before
// production migrations were introduced. They already contain the initial
// schema, but do not contain Drizzle's migration ledger. Record only that
// initial migration so future migrations remain eligible to run.
const hasInitialSchema = sqlite
  .prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'exercise'"
  )
  .get()

const hasMigrationLedger = sqlite
  .prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
  )
  .get()

const hasRecordedMigration =
  hasMigrationLedger &&
  sqlite.prepare("SELECT 1 FROM __drizzle_migrations LIMIT 1").get()

if (hasInitialSchema && !hasRecordedMigration) {
  const journal = JSON.parse(
    readFileSync(join(migrationsDirectory, "meta", "_journal.json"), "utf8")
  ) as { entries: { tag: string; when: number }[] }
  const initialMigration = journal.entries[0]

  if (!initialMigration) {
    throw new Error(
      "The initial Drizzle migration is missing from the journal."
    )
  }

  const migrationContents = readFileSync(
    join(migrationsDirectory, `${initialMigration.tag}.sql`),
    "utf8"
  )
  const migrationHash = createHash("sha256")
    .update(migrationContents)
    .digest("hex")

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `)
  sqlite
    .prepare(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
    )
    .run(migrationHash, initialMigration.when)
  console.warn(
    "Recorded the initial migration for an existing development database."
  )
}

migrate(db, { migrationsFolder: migrationsDirectory })
seedExercises()
console.warn("Database migrations and exercise seed are ready.")
