interface SessionHeaderProps {
  programName: string
  currentExerciseIndex: number
  totalExercises: number
  elapsedSeconds: number
  totalVolumeKg: number
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function SessionHeader({
  programName,
  currentExerciseIndex,
  totalExercises,
  elapsedSeconds,
  totalVolumeKg,
}: SessionHeaderProps) {
  return (
    <div className="border-border pt-safe-top border-b px-5 pb-4">
      {/* Top row: program name + menu */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h1 className="text-lg leading-tight font-bold text-white">
          {programName}
        </h1>
        {/* Button below has no purpose */}
        <button
          type="button"
          aria-label="Session options"
          className="text-muted -mr-1 rounded-lg p-1"
        >
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-5">
        <div>
          <p className="text-muted text-xs">Progress</p>
          <p className="mt-0.5 text-sm font-bold text-white tabular-nums">
            {currentExerciseIndex + 1}/{totalExercises}
            <span className="text-muted ml-1 text-xs font-normal">
              Exercises
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted text-xs">Volume</p>
          <p className="mt-0.5 text-sm font-bold text-white tabular-nums">
            {totalVolumeKg.toLocaleString()}
            <span className="text-muted ml-1 text-xs font-normal">kg</span>
          </p>
        </div>
        <div>
          <p className="text-muted text-xs">Elapsed</p>
          <p className="mt-0.5 text-sm font-bold text-white tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </p>
        </div>
      </div>
    </div>
  )
}
