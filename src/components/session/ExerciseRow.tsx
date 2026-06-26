import type { SessionExercise } from "../../stores/sessionStore"

interface ExerciseRowProps {
  sessionExercise: SessionExercise
  status: "completed" | "upcoming"
  index: number
}

export function ExerciseRow({
  sessionExercise,
  status,
  index,
}: ExerciseRowProps) {
  const { exercise, planned } = sessionExercise
  const isCompleted = status === "completed"

  return (
    <div
      className={`flex items-center gap-3 py-3 ${isCompleted ? "opacity-50" : ""}`}
    >
      {/* Status icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        {isCompleted ? (
          <svg
            className="text-accent h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-label="Completed"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path
              d="M8 12l3 3 5-5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="text-muted text-sm font-semibold tabular-nums">
            {index + 1}
          </span>
        )}
      </div>

      {/* Exercise info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {exercise.name}
        </p>
        <p className="text-muted text-xs">
          {planned.sets} sets · {planned.repRange} reps
        </p>
      </div>

      {/* Chevron for upcoming */}
      {!isCompleted && (
        <svg
          className="text-muted h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M9 18l6-6-6-6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}
