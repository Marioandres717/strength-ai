import { getOnDemandWorkoutDefaultsFn } from "../../functions/getOnDemandWorkoutDefaults"
import { getOnDemandWorkoutFn } from "../../functions/getOnDemandWorkout"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { OnDemandWorkoutGeneratePage } from "../../components/on-demand-workouts/OnDemandWorkoutGeneratePage"
export const Route = createFileRoute("/on-demand-workouts/new")({
  ssr: false,
  validateSearch: (input: unknown) =>
    z.object({ from: z.uuid().optional() }).parse(input),
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: async ({ deps }) => {
    try {
      return {
        defaults: await getOnDemandWorkoutDefaultsFn(),
        source: deps.from
          ? await getOnDemandWorkoutFn({
              data: { onDemandWorkoutId: deps.from },
            })
          : null,
      }
    } catch {
      return { defaults: null, source: null }
    }
  },
  component: Component,
})
function Component() {
  const { defaults, source } = Route.useLoaderData()
  const { from } = Route.useSearch()
  return (
    <OnDemandWorkoutGeneratePage
      key={from ?? "new"}
      defaults={defaults ?? undefined}
      initialPrompt={source?.prompt.slice(0, 2000)}
      regenerateFromId={from}
    />
  )
}
