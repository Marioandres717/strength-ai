import { Link } from "@tanstack/react-router"
export function WorkoutUnavailable() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
      <h1 className="text-2xl font-bold">This screen is unavailable</h1>
      <p className="text-muted text-sm">
        Connect to load this screen, or open a workout already saved on this
        device.
      </p>
      <Link to="/on-demand-workouts" className="min-h-11 underline">
        Open workout library
      </Link>
    </main>
  )
}
