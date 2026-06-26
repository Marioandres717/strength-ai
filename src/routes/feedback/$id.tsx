import { createFileRoute } from "@tanstack/react-router"
import { getFeedbackDataFn } from "../../functions/getFeedbackData"
import { FeedbackPage } from "../../components/feedback/FeedbackPage"

export const Route = createFileRoute("/feedback/$id")({
  loader: ({ params }) =>
    getFeedbackDataFn({ data: { workoutLogId: params.id } }),
  component: Component,
})

function Component() {
  const data = Route.useLoaderData()
  return (
    <FeedbackPage
      workoutLogId={data.workoutLogId}
      sessionName={data.sessionName}
      progressionChanges={data.progressionChanges}
    />
  )
}
