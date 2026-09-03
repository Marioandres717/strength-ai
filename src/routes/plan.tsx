import { createFileRoute, redirect } from "@tanstack/react-router"
import { PlanPage } from "../components/PlanPage"
import { getPlanDataFn } from "../functions/getPlanData"

function Component() {
  const data = Route.useLoaderData()

  if (data.kind !== "active") return null

  return <PlanPage data={data} />
}

export const Route = createFileRoute("/plan")({
  loader: async () => {
    const data = await getPlanDataFn()
    if (data.kind === "no_profile") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/onboarding" })
    }
    if (data.kind === "no_program") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" })
    }
    return data
  },
  component: Component,
})
