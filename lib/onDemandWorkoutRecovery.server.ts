import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { z } from "zod"
import { databasePath } from "./env"
import type {
  OnDemandWorkoutGenerationContext,
  GenerateOnDemandWorkoutInput,
} from "../src/types/on-demand-workout"

export interface GenerationReceipt {
  version: 1
  requestId: string
  requestHash: string
  input: GenerateOnDemandWorkoutInput
  context: OnDemandWorkoutGenerationContext
  response: unknown
  receivedAt: string
}

export function recoveryDirectory(path = databasePath) {
  return join(dirname(resolve(path)), "on-demand-workout-recovery")
}
function receiptPath(directory: string, id: string) {
  return join(directory, `${z.uuid().parse(id)}.json`)
}

export function preflightRecovery(directory = recoveryDirectory()) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const probe = join(directory, `.probe-${crypto.randomUUID()}`)
  const fd = openSync(probe, "wx", 0o600)
  try {
    writeFileSync(fd, "ready")
    fsyncSync(fd)
  } finally {
    closeSync(fd)
    unlinkSync(probe)
  }
}

export function writeGenerationReceipt(
  receipt: GenerationReceipt,
  directory = recoveryDirectory()
) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const path = receiptPath(directory, receipt.requestId)
  const temporary = `${path}.${crypto.randomUUID()}.tmp`
  const fd = openSync(temporary, "wx", 0o600)
  try {
    writeFileSync(fd, JSON.stringify(receipt))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temporary, path)
  // Flush directory metadata where supported (POSIX). Windows does not expose directory fsync.
  if (process.platform !== "win32") {
    const directoryFd = openSync(directory, "r")
    try {
      fsyncSync(directoryFd)
    } finally {
      closeSync(directoryFd)
    }
  }
}

export function readGenerationReceipt(
  id: string,
  directory = recoveryDirectory()
): GenerationReceipt | null {
  const path = receiptPath(directory, id)
  if (!existsSync(path)) return null
  const receipt = JSON.parse(readFileSync(path, "utf8")) as GenerationReceipt
  if (receipt.version !== 1 || receipt.requestId !== id)
    throw new Error("Invalid recovery receipt.")
  return receipt
}
export function listGenerationReceipts(
  directory = recoveryDirectory()
): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter(
      (f) =>
        z.uuid().safeParse(f.replace(/\.json$/, "")).success &&
        f.endsWith(".json")
    )
    .map((f) => f.slice(0, -5))
}
