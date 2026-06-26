import type { SessionExercise } from "../../stores/sessionStore"
import { SpinnerInput } from "./SpinnerInput"

interface SetDetailViewProps {
  exercise: SessionExercise
  setNumber: number
  totalSets: number
  exerciseIndex: number
  totalExercises: number
  inputWeight: number
  inputReps: number
  inputRir: number
  isSubmitting: boolean
  onBack: () => void
  onWeightChange: (v: number) => void
  onRepsChange: (v: number) => void
  onRirChange: (v: number) => void
  onComplete: () => void
}

export function SetDetailView({
  exercise,
  setNumber,
  totalSets,
  exerciseIndex,
  totalExercises,
  inputWeight,
  inputReps,
  inputRir,
  isSubmitting,
  onBack,
  onWeightChange,
  onRepsChange,
  onRirChange,
  onComplete,
}: SetDetailViewProps) {
  const { planned, priorPerformance } = exercise
  const isLastSet = setNumber >= totalSets
  const restMins = Math.floor(planned.restSeconds / 60)
  const restSecs = planned.restSeconds % 60
  const restLabel =
    restSecs === 0
      ? `${restMins}:00 Rest`
      : `${restMins}:${String(restSecs).padStart(2, "0")} Rest`

  return (
    <div className="pb-safe-bottom flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-border flex items-center gap-3 border-b px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="text-muted -ml-1 rounded-lg p-1"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M15 19l-7-7 7-7"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">
            {exercise.exercise.name}
          </h2>
          <p className="text-muted text-xs">
            Exercise {exerciseIndex + 1} of {totalExercises}
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 pt-5">
        {/* Prior performance */}
        {priorPerformance && (
          <div className="bg-surface/60 mb-4 rounded-xl px-4 py-3">
            <p className="text-muted mb-1 text-xs font-semibold tracking-widest uppercase">
              Last Session Performance
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tabular-nums">
                {priorPerformance.weightKg}
              </span>
              <span className="text-muted text-sm">lbs</span>
              <span className="text-muted mx-1 text-sm">×</span>
              <span className="text-2xl font-bold text-white tabular-nums">
                {priorPerformance.reps}
              </span>
              <span className="text-muted text-sm">reps</span>
              {priorPerformance.rirActual !== null && (
                <>
                  <span className="text-muted mx-1 text-sm">@</span>
                  <span className="text-2xl font-bold text-white tabular-nums">
                    {priorPerformance.rirActual}
                  </span>
                  <span className="text-muted text-sm">RIR</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Coach note / adaptive adjustment */}
        {planned.coachNote && (
          <div className="bg-accent/10 border-accent/20 mb-5 rounded-xl border px-4 py-3">
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
              <div>
                <p className="text-accent mb-0.5 text-xs font-semibold">
                  Adaptive Adjustment
                </p>
                <p className="text-sm text-white">{planned.coachNote}</p>
              </div>
            </div>
          </div>
        )}

        {/* Set badge */}
        <div className="mb-5 flex items-center justify-between">
          <p className="text-2xl font-bold text-white">
            Set {setNumber}
            <span className="text-muted ml-2 text-lg font-normal">
              of {totalSets}
            </span>
          </p>
          <span className="border-border rounded-full border px-3 py-1 text-xs font-semibold text-white">
            Working Set
          </span>
        </div>

        {/* Spinner inputs */}
        <div className="divide-border divide-y rounded-2xl">
          <div className="py-3">
            <SpinnerInput
              label="Weight"
              value={inputWeight}
              step={2.5}
              min={0}
              max={500}
              unit="kg"
              hint={`${planned.loadKg} kg`}
              onChange={onWeightChange}
            />
          </div>
          <div className="py-3">
            <SpinnerInput
              label="Reps"
              value={inputReps}
              step={1}
              min={1}
              max={100}
              unit="reps"
              hint={planned.repRange}
              onChange={onRepsChange}
            />
          </div>
          <div className="py-3">
            <SpinnerInput
              label="RIR"
              value={inputRir}
              step={1}
              min={0}
              max={10}
              unit="RIR"
              hint={`${planned.rirTarget} target`}
              onChange={onRirChange}
            />
          </div>
        </div>

        {/* Rest preview */}
        {!isLastSet && (
          <div className="mt-4 flex items-center gap-2">
            <svg
              className="text-muted h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-muted text-sm">Next up: {restLabel}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 py-5">
        <button
          type="button"
          onClick={onComplete}
          disabled={isSubmitting}
          className="bg-accent h-14 w-full rounded-2xl text-sm font-bold text-black transition-opacity active:opacity-80 disabled:opacity-60"
        >
          {isLastSet ? "Complete Workout" : "Complete Set & Rest"}
        </button>
      </div>
    </div>
  )
}
