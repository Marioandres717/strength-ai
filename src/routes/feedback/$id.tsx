import { useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { createFileRoute } from "@tanstack/react-router"
import { loadWorkoutFeedback } from "../../lib/workoutPersistence"
import { FeedbackPage } from "../../components/feedback/FeedbackPage"

export const Route = createFileRoute("/feedback/$id")({
  ssr: false,
  loader: ({ params }) => loadWorkoutFeedback(params.id),
  component: Component,
})

function Component() {
  const data = Route.useLoaderData()
  const router = useRouter()
  useEffect(() => {
    if (!data.pendingSync) return
    const update = () => {
      void router.invalidate()
    }
    window.addEventListener("strength-sync-status", update)
    // Completion can be acknowledged between the loader and effect subscription.
    update()
    return () => window.removeEventListener("strength-sync-status", update)
  }, [data.pendingSync, router])
  return (
    <FeedbackPage
      workoutLogId={data.workoutLogId}
      sessionName={data.sessionName}
      progressionChanges={data.progressionChanges}
      units={data.units}
      returnTo={data.returnTo}
      pendingSync={data.pendingSync}
    />
  )
}
