import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "../ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card"
import type { OnDemandWorkoutLibraryPage as Library } from "../../types/on-demand-workout"
import { loadLibrary } from "../../lib/workoutPersistence"
import { OfflineWorkoutAvailability } from "../OfflineWorkoutAvailability"

export function OnDemandWorkoutLibraryPage({ data }: { data: Library }) {
  const [page, setPage] = useState(data)
  const [error, setError] = useState("")
  useEffect(() => {
    setPage(data)
  }, [data])
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-3xl font-bold">On-demand workouts</h1>
        <p className="text-muted mt-2 text-sm">
          A workout for today. Your program stays on track.
        </p>
      </div>
      <Button asChild size="lg" className="min-h-14">
        <Link to="/on-demand-workouts/new">Generate workout</Link>
      </Button>
      {!page.items.length && (
        <p className="text-muted text-sm">
          No saved workouts yet. Every successful generation is saved here
          automatically.
        </p>
      )}
      {page.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle>
              <Link to="/on-demand-workouts/$id" params={{ id: item.id }}>
                {item.title}
              </Link>
            </CardTitle>
            <CardDescription>
              {Math.ceil(item.estimatedDurationSeconds / 60)} min estimate ·{" "}
              {item.focus} · {new Date(item.createdAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OfflineWorkoutAvailability id={item.id} />
            <p className="text-muted text-sm">
              {item.timesCompleted
                ? `${item.timesCompleted} completed`
                : "Not started"}
            </p>
            <p className="mt-2 text-sm">{item.promptExcerpt}</p>
            <Button variant="outline" asChild className="mt-4 min-h-11 w-full">
              <Link to="/on-demand-workouts/$id" params={{ id: item.id }}>
                View workout
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
      {page.nextCursor && (
        <Button
          variant="outline"
          onClick={() => {
            void loadLibrary(page.nextCursor!)
              .then((next) =>
                setPage({ ...next, items: [...page.items, ...next.items] })
              )
              .catch(() => setError("Could not load more workouts."))
          }}
        >
          Load more
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
