import { useEffect, useState } from "react"
import { repositoryGet } from "../lib/offline/workoutRepository"
import type { CachedDefinition } from "../lib/workoutPersistence"

export function OfflineWorkoutAvailability({ id }: { id: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    async function check() {
      const cached = await repositoryGet<CachedDefinition>("definitions", id)
      const worker = navigator.serviceWorker?.controller
      if (!cached || cached.tombstone || !worker) return
      const channel = new MessageChannel()
      channel.port1.onmessage = () => {
        if (active) setReady(true)
        channel.port1.close()
      }
      worker.postMessage("SHELL_STATUS", [channel.port2])
      setTimeout(() => channel.port1.close(), 5000)
    }
    const update = () => {
      void check().catch(() => undefined)
    }
    update()
    navigator.serviceWorker?.addEventListener("controllerchange", update)
    const timer = setInterval(update, 3000)
    return () => {
      active = false
      clearInterval(timer)
      navigator.serviceWorker?.removeEventListener("controllerchange", update)
    }
  }, [id])
  return (
    <p className="text-muted text-xs">
      {ready
        ? "Available offline on this device"
        : "Open online and allow the app to finish downloading for offline use"}
    </p>
  )
}
