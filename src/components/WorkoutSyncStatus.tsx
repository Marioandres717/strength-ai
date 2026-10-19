import { useEffect, useState } from "react"
import { repositoryAll } from "../lib/offline/workoutRepository"
import type { OutboxEntry } from "../lib/workoutPersistence"
import { retryWorkoutSync } from "../lib/offline/workoutSync"

export function WorkoutSyncStatus() {
  const [status, setStatus] = useState("")
  const [updateWaiting, setUpdateWaiting] = useState(false)
  useEffect(() => {
    const update = () => setUpdateWaiting(true)
    window.addEventListener("strength-update-waiting", update)
    return () => window.removeEventListener("strength-update-waiting", update)
  }, [])
  useEffect(() => {
    const update = () => {
      void repositoryAll<OutboxEntry>("outbox")
        .then((entries) =>
          setStatus(
            entries.some((e) => e.conflict)
              ? "Sync needs attention. Check this device's clock and retry; your workout is retained."
              : entries.length
                ? "Saved on this device; sync pending."
                : "All workouts synced."
          )
        )
        .catch(() =>
          setStatus("Device storage is unavailable. Sets cannot be saved.")
        )
    }
    update()
    window.addEventListener("strength-sync-status", update)
    window.addEventListener("strength-workout-change", update)
    return () => {
      window.removeEventListener("strength-sync-status", update)
      window.removeEventListener("strength-workout-change", update)
    }
  }, [])
  return (
    <div
      className="text-muted mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-2 text-xs"
      role="status"
    >
      <span>
        {status}
        {updateWaiting
          ? " Update ready. Finish your workout, sync, then close all app tabs to update."
          : ""}
      </span>
      <button
        type="button"
        className="min-h-11 shrink-0 underline"
        onClick={() => void retryWorkoutSync()}
      >
        Retry sync
      </button>
    </div>
  )
}
