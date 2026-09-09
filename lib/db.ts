import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { databasePath } from "./env"
import * as schema from "./schema"

mkdirSync(dirname(resolve(databasePath)), { recursive: true })

const sqlite = new Database(databasePath)
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")

export const db = drizzle({ client: sqlite, schema })
export { sqlite }
