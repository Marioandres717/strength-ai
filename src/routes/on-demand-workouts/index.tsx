import { createFileRoute } from "@tanstack/react-router"
import { loadLibrary } from "../../lib/workoutPersistence"
import { OnDemandWorkoutLibraryPage } from "../../components/on-demand-workouts/OnDemandWorkoutLibraryPage"
export const Route = createFileRoute("/on-demand-workouts/")({
  ssr: false,
  loader: () => loadLibrary(),
  component: Component,
})
function Component() {
  return <OnDemandWorkoutLibraryPage data={Route.useLoaderData()} />
}
