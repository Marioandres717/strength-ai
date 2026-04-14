import { createFileRoute, redirect } from "@tanstack/react-router"
import { getDashboardDataFn } from "../functions/getDashboardData"
import { DashboardPage } from "../components/DashboardPage"

function Component() {
  const { useLoaderData } = Route
  const data = useLoaderData()
  return <DashboardPage data={data} />
}

export const Route = createFileRoute("/")({
  loader: async () => {
    const data = await getDashboardDataFn()
    if (data.kind === "no_profile") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/onboarding" })
    }
    return data
  },
  component: Component,
})
