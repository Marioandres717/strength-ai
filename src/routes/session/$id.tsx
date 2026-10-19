import { createFileRoute } from "@tanstack/react-router"
import { getSessionDataFn } from "../../functions/getSessionData"
import { SessionPage } from "../../components/session/SessionPage"

import { cacheRun, loadRun } from "../../lib/workoutPersistence"
import { plannedSessionAdapter } from "../../lib/plannedSessionAdapter"

export const Route = createFileRoute("/session/$id")({
  ssr: false,
  loader: async ({ params }) => {
    const data = await getSessionDataFn({
      data: { sessionTemplateId: params.id },
    })
    const run = plannedSessionAdapter(data)
    await cacheRun(run)
    return loadRun(run.workoutLogId)
  },
  component: Component,
})

function Component() {
  const data = Route.useLoaderData()
  return <SessionPage loaderData={data} />
}
