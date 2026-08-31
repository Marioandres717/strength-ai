import type { LoggedSet, SessionExercise } from "../../stores/sessionStore"
import { ExerciseRow } from "./ExerciseRow"
import { RestTimer } from "./RestTimer"
import { StatChip } from "./StatChip"

interface ExecutionViewProps {
  exercises: SessionExercise[]
  currentExerciseIndex: number
  currentSetNumber: number
  restSecondsRemaining: number
  restSecondsTotal: number
  loggedSets: LoggedSet[]
  onLogSet: () => void
  onAdjustTimer: (delta: number) => void
  onSkipRest: () => void
}

export function ExecutionView({
  exercises,
  currentExerciseIndex,
  currentSetNumber,
  restSecondsRemaining,
  restSecondsTotal,
  loggedSets,
  onLogSet,
  onAdjustTimer,
  onSkipRest,
}: ExecutionViewProps) {
  const currentExercise = exercises[currentExerciseIndex]
  const completedExercises = exercises.slice(0, currentExerciseIndex)
  const upcomingExercises = exercises.slice(currentExerciseIndex + 1)
  const hasPendingSets = loggedSets.some((set) => set.syncStatus === "pending")
  const hasFailedSets = loggedSets.some((set) => set.syncStatus === "failed")

  return (
    <div className="pb-safe-bottom flex flex-1 flex-col overflow-y-auto">
      {completedExercises.length > 0 && (
        <div className="border-border border-b px-5">
          {completedExercises.map((exercise, index) => (
            <ExerciseRow
              key={exercise.planned.id}
              sessionExercise={exercise}
              status="completed"
              index={index}
            />
          ))}
        </div>
      )}

      <div className="border-accent bg-surface mx-4 mt-4 rounded-2xl border p-5">
        <p className="text-muted mb-1 text-xs font-semibold">
          Set {currentSetNumber} of {currentExercise.planned.sets}
        </p>
        <h2 className="mb-4 text-2xl leading-tight font-bold text-white">
          {currentExercise.exercise.name}
        </h2>

        {currentExercise.planned.coachNote && (
          <div className="bg-accent/10 border-accent/20 mb-4 rounded-xl border px-4 py-2.5">
            <div className="flex items-start gap-2">
              <svg
                className="text-accent mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <p className="text-sm text-white">
                {currentExercise.planned.coachNote}
              </p>
            </div>
          </div>
        )}

        <div className="mb-5 flex gap-3">
          <StatChip
            label="Target Load"
            value={currentExercise.planned.loadKg}
            unit="kg"
          />
          <StatChip
            label="Target Reps"
            value={currentExercise.planned.repRange}
          />
          <StatChip
            label="Target RIR"
            value={currentExercise.planned.rirTarget}
          />
        </div>

        <RestTimer
          secondsRemaining={restSecondsRemaining}
          secondsTotal={restSecondsTotal}
          onAdjust={onAdjustTimer}
          onSkip={onSkipRest}
        />
      </div>

      {(hasPendingSets || hasFailedSets) && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 px-4 py-2.5">
          <p className="text-xs text-amber-400">
            {hasFailedSets
              ? "Some sets need to sync before workout completion."
              : "Some sets are still syncing..."}
          </p>
        </div>
      )}

      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={onLogSet}
          className="bg-accent h-14 w-full rounded-2xl text-sm font-bold text-black transition-opacity active:opacity-80"
        >
          Log Set {currentSetNumber}
        </button>
      </div>

      {upcomingExercises.length > 0 && (
        <div className="mt-6 px-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-muted text-xs font-semibold tracking-widest uppercase">
              Upcoming
            </p>
            <p className="text-muted text-xs">
              {upcomingExercises.length} Remaining
            </p>
          </div>
          <div className="border-border divide-border divide-y rounded-2xl border">
            {upcomingExercises.map((exercise, index) => (
              <div key={exercise.planned.id} className="px-4">
                <ExerciseRow
                  sessionExercise={exercise}
                  status="upcoming"
                  index={currentExerciseIndex + 1 + index}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-6" />
    </div>
  )
}
