import { createFileRoute } from "@tanstack/react-router"
import { loadRun } from "../../lib/workoutPersistence"
import { SessionPage } from "../../components/session/SessionPage"
export const Route = createFileRoute("/workout/$id")({
  ssr: false,
  loader: ({ params }) => loadRun(params.id),
  component: Component,
})
function Component() {
  return <SessionPage loaderData={Route.useLoaderData()} />
}
