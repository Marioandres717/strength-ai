import { createFileRoute } from "@tanstack/react-router"
import { loadDefinition } from "../../lib/workoutPersistence"
import { OnDemandWorkoutPreviewPage } from "../../components/on-demand-workouts/OnDemandWorkoutPreviewPage"
export const Route = createFileRoute("/on-demand-workouts/$id")({
  ssr: false,
  loader: ({ params }) => loadDefinition(params.id),
  component: Component,
})
function Component() {
  return <OnDemandWorkoutPreviewPage data={Route.useLoaderData()} />
}
