import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { TriangleAlertIcon } from "lucide-react"
import type { ProgressionChange } from "../../functions/completeSession"
import { saveFeedbackFn } from "../../functions/saveFeedback"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { Button } from "../ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field"
import { Slider } from "../ui/slider"
import { Textarea } from "../ui/textarea"

interface FeedbackPageProps {
  workoutLogId: string
  sessionName: string
  progressionChanges: ProgressionChange[]
}

export function FeedbackPage({
  workoutLogId,
  sessionName,
  progressionChanges,
}: FeedbackPageProps) {
  const navigate = useNavigate()
  const [fatigue, setFatigue] = useState(3)
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    if (isSaving) return

    setIsSaving(true)
    setSaveError(null)

    try {
      await saveFeedbackFn({
        data: {
          workoutLogId,
          fatigueRating: fatigue,
          notes,
        },
      })
      void navigate({ to: "/" })
    } catch (error) {
      console.error("Failed to save feedback:", error)
      setSaveError("Failed to save feedback. Retry to finish the workout.")
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-bg flex min-h-screen flex-col">
      <div className="pt-safe-top flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          aria-label="Close"
          className="border-border bg-surface flex size-9 items-center justify-center rounded-full border text-white"
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
        <div className="mt-2 mb-8">
          <h1 className="text-4xl font-bold text-white">Session Logged</h1>
          <p className="text-muted mt-2 text-sm">
            {sessionName} · Rate the session and leave any notes worth carrying
            forward.
          </p>
        </div>

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

        <FieldGroup className="mb-8">
          <Field>
            <div className="mb-4 flex items-center justify-between">
              <FieldLabel htmlFor="fatigue">Perceived Fatigue</FieldLabel>
              <span className="text-accent text-base font-bold tabular-nums">
                {fatigue} / 5
              </span>
            </div>
            <Slider
              id="fatigue"
              min={1}
              max={5}
              step={1}
              value={[fatigue]}
              onValueChange={([value]) => setFatigue(value ?? 3)}
              aria-label="Perceived fatigue from 1 to 5"
              className="[--color-muted:var(--color-border)] [--color-primary:var(--color-accent)] **:data-[slot=slider-thumb]:size-5 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-track]:h-2"
            />
            <div className="mt-2 flex justify-between">
              <span className="text-muted text-xs">Fresh</span>
              <span className="text-muted text-xs">Exhausted</span>
            </div>
            <FieldDescription>
              Use a 1-5 scale based on overall session fatigue.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Training Notes</FieldLabel>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 2000))}
              placeholder="Optional notes about fatigue, performance, or anything to review later."
              rows={5}
              maxLength={2000}
            />
            <FieldDescription>
              Optional. Notes are trimmed automatically and capped at 2,000
              characters.
            </FieldDescription>
          </Field>
        </FieldGroup>

        {saveError && (
          <Alert variant="destructive" className="mb-6">
            <TriangleAlertIcon />
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="bg-accent hover:bg-accent/90 mb-6 h-14 w-full rounded-2xl text-sm font-bold text-black"
        >
          {isSaving ? "Saving..." : "Save & Finish"}
        </Button>
      </div>
    </div>
  )
}
