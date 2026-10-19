import { startWorkoutFn } from "../../functions/startWorkout"
import { logSetFn } from "../../functions/logSet"
import { completeSessionFn } from "../../functions/completeSession"
import { saveFeedbackFn } from "../../functions/saveFeedback"
import { deleteOnDemandWorkoutFn } from "../../functions/deleteOnDemandWorkout"
import {
  idbRequest,
  repositoryAll,
  repositoryTransaction,
} from "./workoutRepository.client"
import type { LocalRun, LocalSet, OutboxEntry } from "../workoutPersistence"

const workerId = crypto.randomUUID()
let running = false
let rerunRequested = false
let retryRequested = false
const priority = { start: 0, set: 1, complete: 2, feedback: 3, delete: 4 }
const channel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("strength-ai-sync")
    : null
function changed() {
  window.dispatchEvent(new Event("strength-sync-status"))
  channel?.postMessage("changed")
}
channel?.addEventListener("message", () =>
  window.dispatchEvent(new Event("strength-sync-status"))
)
function group(entry: OutboxEntry) {
  const data = entry.command.data
  return "workoutLogId" in data ? data.workoutLogId : data.onDemandWorkoutId
}

async function lease(): Promise<boolean> {
  return repositoryTransaction(["context"], async (tx) => {
    const store = tx.objectStore("context")
    const current = (await idbRequest(store.get("syncLease"))) as
      | { workerId: string; expires: number }
      | undefined
    if (
      current &&
      current.workerId !== workerId &&
      current.expires > Date.now()
    )
      return false
    store.put({ workerId, expires: Date.now() + 30_000 }, "syncLease")
    return true
  })
}

export async function syncWorkouts() {
  if (!navigator.onLine) return
  if (running) {
    rerunRequested = true
    return
  }
  running = true
  try {
    if (!(await lease())) return
    const entries = (await repositoryAll<OutboxEntry>("outbox")).sort(
      (a, b) =>
        group(a).localeCompare(group(b)) ||
        priority[a.command.kind] - priority[b.command.kind] ||
        a.createdAt - b.createdAt ||
        a.key.localeCompare(b.key)
    )
    const stopped = new Set<string>()
    for (const entry of entries.slice(0, 100)) {
      const run = group(entry)
      if (stopped.has(run)) continue
      if (entry.conflict || entry.retryAt > Date.now()) {
        stopped.add(run)
        continue
      }
      if (!(await lease())) break
      try {
        const c = entry.command
        let setLogId: string | undefined
        if (c.kind === "start") await startWorkoutFn({ data: c.data })
        if (c.kind === "set")
          setLogId = (await logSetFn({ data: c.data })).setLogId
        if (c.kind === "complete") await completeSessionFn({ data: c.data })
        if (c.kind === "feedback") await saveFeedbackFn({ data: c.data })
        if (c.kind === "delete") await deleteOnDemandWorkoutFn({ data: c.data })
        await repositoryTransaction(
          ["outbox", "runs", "sets", "feedback"],
          async (tx) => {
            if (c.kind === "start" || c.kind === "complete") {
              const row = (await idbRequest(
                tx.objectStore("runs").get(c.data.workoutLogId)
              )) as LocalRun | undefined
              if (row)
                tx.objectStore("runs").put(
                  {
                    ...row,
                    acknowledged: true,
                    completionAcknowledged:
                      c.kind === "complete" ? true : row.completionAcknowledged,
                  },
                  c.data.workoutLogId
                )
            }
            if (c.kind === "set") {
              const row = (await idbRequest(
                tx.objectStore("sets").get(entry.key)
              )) as LocalSet | undefined
              if (row)
                tx.objectStore("sets").put(
                  { ...row, setLogId: setLogId!, acknowledged: true },
                  entry.key
                )
            }
            if (c.kind === "feedback") {
              // A more recent feedback edit may have been committed during this RPC.
              const current = (await idbRequest(
                tx.objectStore("outbox").get(entry.key)
              )) as OutboxEntry | undefined
              if (
                current &&
                JSON.stringify(current.command) !== JSON.stringify(c)
              )
                return
              tx.objectStore("feedback").put(
                { ...c.data, acknowledged: true },
                c.data.workoutLogId
              )
            }
            tx.objectStore("outbox").delete(entry.key)
          }
        )
        changed()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed"
        const conflict =
          /conflict|does not belong|invalid|exceeds|unavailable|clock|already completed|incomplete|not found|ZodError/i.test(
            message
          )
        const updated = {
          ...entry,
          attempts: entry.attempts + 1,
          retryAt:
            Date.now() +
            Math.min(60_000, 1000 * 2 ** Math.min(entry.attempts, 6)) +
            Math.random() * 1000,
          conflict: conflict ? message.slice(0, 200) : null,
        }
        await repositoryTransaction(["outbox"], (tx) => {
          tx.objectStore("outbox").put(updated, entry.key)
        })
        stopped.add(run)
        changed()
      }
    }
  } catch {
    /* Storage unavailability is displayed by the persistence caller/status. */
  } finally {
    running = false
    await repositoryTransaction(["context"], async (tx) => {
      const store = tx.objectStore("context"),
        current = (await idbRequest(store.get("syncLease"))) as
          | { workerId: string }
          | undefined
      if (current?.workerId === workerId) store.delete("syncLease")
    }).catch(() => undefined)
    if (retryRequested) {
      retryRequested = false
      rerunRequested = false
      void retryWorkoutSync()
    } else if (rerunRequested) {
      rerunRequested = false
      void syncWorkouts()
    }
  }
}
export async function retryWorkoutSync() {
  if (running) {
    retryRequested = true
    return
  }
  await repositoryTransaction(["outbox"], async (tx) => {
    const store = tx.objectStore("outbox"),
      entries = (await idbRequest(store.getAll())) as OutboxEntry[]
    for (const entry of entries)
      store.put({ ...entry, conflict: null, retryAt: 0 }, entry.key)
  })
  await syncWorkouts()
}
export function startWorkoutSync() {
  const trigger = () => {
    void syncWorkouts()
  }
  window.addEventListener("online", trigger)
  window.addEventListener("strength-workout-change", trigger)
  document.addEventListener("visibilitychange", trigger)
  const timer = setInterval(trigger, 15_000)
  trigger()
  return () => {
    clearInterval(timer)
    window.removeEventListener("online", trigger)
    window.removeEventListener("strength-workout-change", trigger)
    document.removeEventListener("visibilitychange", trigger)
  }
}
