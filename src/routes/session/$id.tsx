import { createFileRoute } from "@tanstack/react-router"
import { getSessionDataFn } from "../../functions/getSessionData"
import { SessionPage } from "../../components/session/SessionPage"

export const Route = createFileRoute("/session/$id")({
  loader: ({ params }) =>
    getSessionDataFn({ data: { sessionTemplateId: params.id } }),
  component: Component,
})

function Component() {
  const data = Route.useLoaderData()
  return <SessionPage loaderData={data} />
}
