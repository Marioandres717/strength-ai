import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, join, resolve } from "node:path"
import Database from "better-sqlite3"
import { z } from "zod"
import { databasePath } from "../lib/env"

const BackupEnvironmentSchema = z.object({
  BACKUP_DIR: z.string().trim().min(1).default("backups"),
  BACKUP_RETENTION: z.coerce.number().int().min(1).default(30),
})

const backupEnvironment = BackupEnvironmentSchema.parse({
  BACKUP_DIR: process.env.BACKUP_DIR,
  BACKUP_RETENTION: process.env.BACKUP_RETENTION,
})

const backupDirectory = resolve(backupEnvironment.BACKUP_DIR)
mkdirSync(backupDirectory, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
const backupName = `strength-${timestamp}.db`
const backupPath = join(backupDirectory, backupName)
const source = new Database(databasePath, { readonly: true })

try {
  await source.backup(backupPath)
} finally {
  source.close()
}

const verifiedBackup = new Database(backupPath, { readonly: true })
try {
  const integrity = verifiedBackup.pragma("integrity_check", {
    simple: true,
  })
  if (integrity !== "ok") {
    throw new Error(`SQLite integrity check failed: ${String(integrity)}`)
  }
} finally {
  verifiedBackup.close()
}

for (const sidecar of [`${backupPath}-wal`, `${backupPath}-shm`]) {
  if (existsSync(sidecar)) rmSync(sidecar)
}

const checksum = createHash("sha256")
  .update(readFileSync(backupPath))
  .digest("hex")
writeFileSync(`${backupPath}.sha256`, `${checksum}  ${backupName}\n`, "utf8")

const backups = readdirSync(backupDirectory)
  .filter((file) => /^strength-.*\.db$/.test(file))
  .sort()
  .reverse()

for (const expiredBackup of backups.slice(backupEnvironment.BACKUP_RETENTION)) {
  const expiredPath = join(backupDirectory, expiredBackup)
  rmSync(expiredPath)
  const expiredManifest = `${expiredPath}.sha256`
  if (existsSync(expiredManifest)) rmSync(expiredManifest)
}

console.warn(`Verified backup written: ${basename(backupPath)}`)
