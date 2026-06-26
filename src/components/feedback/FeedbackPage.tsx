import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { saveFeedbackFn } from "../../functions/saveFeedback"
import type { ProgressionChange } from "../../functions/completeSession"
import { Slider } from "../ui/slider"

interface FeedbackPageProps {
  workoutLogId: string
  sessionName: string
  progressionChanges: ProgressionChange[]
}

const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Quads",
  "Glutes",
  "Hamstrings",
  "Calves",
  "Core",
  "Arms",
]

const LOWER_BODY = new Set(["Quads", "Glutes", "Hamstrings", "Calves"])
const UPPER_BODY = new Set(["Chest", "Back", "Shoulders", "Arms"])

function buildCoachMessage(fatigue: number, soreness: string[]): string {
  const lowerSore = soreness.filter((m) => LOWER_BODY.has(m))
  const upperSore = soreness.filter((m) => UPPER_BODY.has(m))

  let message = ""

  if (fatigue >= 8) {
    message += "Based on your high fatigue rating"
    if (lowerSore.length > 0) {
      message += ` and localized lower-body soreness (${lowerSore.join(", ")})`
    } else if (upperSore.length > 0) {
      message += ` and upper-body soreness (${upperSore.join(", ")})`
    } else if (soreness.length > 0) {
      message += ` and ${soreness.join(", ")} soreness`
    }
    message +=
      ", your next session load will be kept steady to allow full recovery."
  } else if (fatigue >= 6) {
    message += "Moderate fatigue detected."
    if (soreness.length > 0) {
      message += ` Keep an eye on ${soreness.join(", ")} going into your next session.`
    } else {
      message +=
        " Your next session targets are unchanged — maintain current loads."
    }
  } else {
    message += "Great recovery profile."
    if (soreness.length === 0) {
      message +=
        " No soreness flagged — your next session can target a load increase if you hit all reps."
    } else {
      message += ` Light soreness in ${soreness.join(", ")} is normal. Targets remain on track.`
    }
  }

  return message
}

export function FeedbackPage({
  workoutLogId,
  sessionName,
  progressionChanges,
}: FeedbackPageProps) {
  const navigate = useNavigate()
  const [fatigue, setFatigue] = useState(5)
  const [soreness, setSoreness] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const toggleSoreness = (muscle: string) => {
    setSoreness((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    )
  }

  const coachMessage = buildCoachMessage(fatigue, soreness)

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)

    // Encode soreness into notes if any muscles selected
    const notesValue =
      soreness.length > 0 ? `Soreness: ${soreness.join(", ")}` : null

    try {
      await saveFeedbackFn({
        data: {
          workoutLogId,
          fatigueRating: fatigue,
          notes: notesValue,
        },
      })
      void navigate({ to: "/" })
    } catch (err) {
      console.error("Failed to save feedback:", err)
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-bg flex min-h-screen flex-col">
      {/* Header bar */}
      <div className="pt-safe-top flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          aria-label="Close"
          className="border-border bg-surface flex h-9 w-9 items-center justify-center rounded-full border text-white"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className="text-sm font-semibold text-white">Workout Complete</p>
      </div>

      <div className="pb-safe-bottom flex-1 overflow-y-auto px-5">
        {/* Hero */}
        <div className="mt-2 mb-8">
          <h1 className="text-4xl font-bold text-white">Session Logged</h1>
          <p className="text-muted mt-2 text-sm">
            {sessionName} · Help calibrate your next training block.
          </p>
        </div>

        {/* Progression changes (if any) */}
        {progressionChanges.length > 0 && (
          <div className="mb-6">
            <p className="text-muted mb-3 text-xs font-semibold tracking-widest uppercase">
              Load Progressions
            </p>
            <div className="border-border divide-border divide-y rounded-2xl border">
              {progressionChanges.map((change) => (
                <div key={change.plannedExerciseId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {change.exerciseName || "Exercise"}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-muted text-sm tabular-nums">
                        {change.oldLoadKg} kg
                      </span>
                      <svg
                        className="text-accent h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 12h14M12 5l7 7-7 7"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-accent text-sm font-bold tabular-nums">
                        {change.newLoadKg} kg
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Perceived Fatigue */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-base font-semibold text-white">
              Perceived Fatigue
            </p>
            <span className="text-accent text-base font-bold tabular-nums">
              {fatigue} / 10
            </span>
          </div>

          <Slider
            min={1}
            max={10}
            step={1}
            value={[fatigue]}
            onValueChange={([v]) => setFatigue(v)}
            aria-label="Perceived fatigue from 1 to 10"
            className="[--color-muted:var(--color-border)] [--color-primary:var(--color-accent)] **:data-[slot=slider-thumb]:size-5 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-track]:h-2"
          />

          <div className="mt-2 flex justify-between">
            <span className="text-muted text-xs">Fresh</span>
            <span className="text-muted text-xs">Exhausted</span>
          </div>
        </div>

        {/* Muscle Soreness */}
        <div className="mb-8">
          <p className="mb-4 text-base font-semibold text-white">
            Muscle Soreness
          </p>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((muscle) => {
              const selected = soreness.includes(muscle)
              return (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleSoreness(muscle)}
                  aria-pressed={selected}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-accent text-black"
                      : "border-border bg-surface border text-white"
                  }`}
                >
                  {selected && (
                    <span className="mr-1.5" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {muscle}
                </button>
              )
            })}
          </div>
        </div>

        {/* Adaptive Coach Active */}
        <div className="bg-accent/10 border-accent/20 mb-8 rounded-2xl border px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <svg
              className="text-accent h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="text-accent text-sm font-semibold">
              Adaptive Coach Active
            </p>
          </div>
          <p className="text-muted text-sm leading-relaxed">{coachMessage}</p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="bg-accent mb-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-black transition-opacity disabled:opacity-60"
        >
          {isSaving ? (
            "Saving…"
          ) : (
            <>
              Save & Finish
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
