import { createFileRoute } from "@tanstack/react-router"
import { sqlite } from "../../lib/db"

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: () => {
        try {
          sqlite.prepare("SELECT 1").get()
          return Response.json({ status: "healthy" })
        } catch {
          return Response.json({ status: "unhealthy" }, { status: 503 })
        }
      },
    },
  },
})
