import type { getOnDemandWorkoutDefaultsFn } from "../../functions/getOnDemandWorkoutDefaults"
import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { exercises } from "../../../data/exercises"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../ui/field"
import { Alert, AlertTitle, AlertDescription } from "../ui/alert"
import { generateOnDemandWorkoutFn } from "../../functions/generateOnDemandWorkout"
import { getOnDemandWorkoutGenerationFn } from "../../functions/getOnDemandWorkoutGeneration"
import { retryOnDemandWorkoutSaveFn } from "../../functions/retryOnDemandWorkoutSave"
import { listOnDemandWorkoutGenerationsFn } from "../../functions/listOnDemandWorkoutGenerations"
import {
  cacheDefinition,
  retainGenerationRequest,
} from "../../lib/workoutPersistence"
import { parseOnDemandWorkoutPrompt } from "../../types/on-demand-workout"
import type {
  GenerationResult,
  GenerationRequestSummary,
  GenerateOnDemandWorkoutInput,
} from "../../types/on-demand-workout"

const equipmentKeys = [...new Set(exercises.flatMap((e) => e.equipment))].sort()
export function OnDemandWorkoutGeneratePage({
  regenerateFromId,
  defaults,
  initialPrompt,
}: {
  defaults?: Awaited<ReturnType<typeof getOnDemandWorkoutDefaultsFn>>
  initialPrompt?: string
  regenerateFromId?: string
}) {
  const [prompt, setPrompt] = useState(initialPrompt ?? ""),
    [timeOverridden, setTimeOverridden] = useState(false),
    [equipmentOverridden, setEquipmentOverridden] = useState(false),
    [time, setTime] = useState(String(defaults?.timeMinutes ?? 30)),
    [equipment, setEquipment] = useState<string[]>(
      defaults?.equipment ?? ["dumbbell"]
    ),
    [experience, setExperience] = useState<
      "beginner" | "intermediate" | "advanced"
    >(defaults?.experience ?? "beginner"),
    [focus, setFocus] = useState<"strength" | "hypertrophy" | "mixed">(
      defaults?.focus ?? "mixed"
    ),
    [energy, setEnergy] = useState(""),
    [soreness, setSoreness] = useState(""),
    [tweak, setTweak] = useState(""),
    [units, setUnits] = useState<"kg" | "lbs">(defaults?.units ?? "kg"),
    [result, setResult] = useState<GenerationResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recent, setRecent] = useState<GenerationRequestSummary[]>([])
  async function accept(next: GenerationResult) {
    setResult(next)
    if (next.status === "saved" && next.preview)
      await cacheDefinition(next.preview).catch(() =>
        setError(
          "Workout saved on the server. Device storage could not cache it for offline use."
        )
      )
    setBusy(next.status === "in_progress")
  }
  useEffect(() => {
    void listOnDemandWorkoutGenerationsFn({ data: {} })
      .then(setRecent)
      .catch(() => undefined)
    const id = localStorage.getItem("on-demand-generation-request")
    if (id)
      void getOnDemandWorkoutGenerationFn({ data: { requestId: id } })
        .then(accept)
        .catch(() =>
          setError(
            "Could not check the last request. Connect and check recent requests before generating again."
          )
        )
  }, [])
  useEffect(() => {
    if (result?.status !== "in_progress") return
    const timer = setInterval(() => {
      void getOnDemandWorkoutGenerationFn({
        data: { requestId: result.requestId },
      })
        .then(accept)
        .catch(() =>
          setError(
            "Connection lost. This request may still be running; check its status before starting another."
          )
        )
    }, 3000)
    return () => clearInterval(timer)
  }, [result])
  async function generate() {
    if (!navigator.onLine) {
      setError(
        "Connect to generate a workout. Generation is never queued offline."
      )
      return
    }
    setBusy(true)
    setError("")
    const input: GenerateOnDemandWorkoutInput = {
      requestId: crypto.randomUUID(),
      prompt,
      timeMinutes: Number(time),
      equipment,
      experience,
      focus,
      units,
      ...(energy ? { energy: Number(energy) } : {}),
      ...(soreness ? { soreness } : {}),
      ...(regenerateFromId ? { regenerateFromId, tweak } : {}),
    }
    try {
      await retainGenerationRequest(input)
      localStorage.setItem("on-demand-generation-request", input.requestId)
      const next = await generateOnDemandWorkoutFn({ data: input })
      await accept(next)
      await retainGenerationRequest(input, next).catch(() =>
        setError(
          "The server retained this result. Device storage could not update its recovery record."
        )
      )
    } catch {
      setError(
        "The response was lost. Check this request before generating again."
      )
      setResult({ status: "unknown", requestId: input.requestId })
      setBusy(false)
    }
  }
  const inFlight = result?.status === "in_progress"
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <Link
        to="/on-demand-workouts"
        className="text-muted min-h-11 text-sm underline"
      >
        Workout library
      </Link>
      <h1 className="text-3xl font-bold">Generate workout</h1>
      <p className="text-muted text-sm">
        Describe what you want to train. Every valid workout is saved
        automatically. One generation uses one daily attempt.
      </p>
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          void generate()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="workout-prompt">
              What do you want to train?
            </FieldLabel>
            <Textarea
              id="workout-prompt"
              required
              maxLength={2000}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                const parsed = parseOnDemandWorkoutPrompt(event.target.value)
                if (!timeOverridden && parsed.timeMinutes)
                  setTime(String(parsed.timeMinutes))
                if (!equipmentOverridden && parsed.equipment)
                  setEquipment(parsed.equipment)
              }}
              placeholder="40 min, dumbbells only, upper body"
            />
            <FieldDescription>
              Controls below take priority over your prompt for this workout.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="workout-time">Minutes available</FieldLabel>
            <Input
              id="workout-time"
              type="number"
              min={10}
              max={120}
              required
              value={time}
              onChange={(e) => {
                setTimeOverridden(true)
                setTime(e.target.value)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workout-experience">Experience</FieldLabel>
            <select
              id="workout-experience"
              value={experience}
              onChange={(e) =>
                setExperience(e.target.value as typeof experience)
              }
              className="bg-surface min-h-11 rounded-md border p-2"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="workout-focus">Focus</FieldLabel>
            <select
              id="workout-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value as typeof focus)}
              className="bg-surface min-h-11 rounded-md border p-2"
            >
              <option value="mixed">Mixed</option>
              <option value="strength">Strength</option>
              <option value="hypertrophy">Hypertrophy</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="workout-units">Display units</FieldLabel>
            <select
              id="workout-units"
              value={units}
              onChange={(e) => setUnits(e.target.value as typeof units)}
              className="bg-surface min-h-11 rounded-md border p-2"
            >
              <option value="kg">kg</option>
              <option value="lbs">lb</option>
            </select>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-3 text-sm font-medium">
              Available equipment
            </legend>
            <p className="text-muted text-xs">
              Select only what is available, including a bench or rack if
              needed.
            </p>
            {equipmentKeys.map((key) => (
              <label
                key={key}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={equipment.includes(key)}
                  onChange={(e) => {
                    setEquipmentOverridden(true)
                    setEquipment(
                      e.target.checked
                        ? [...equipment, key]
                        : equipment.filter((k) => k !== key)
                    )
                  }}
                />
                {key}
              </label>
            ))}
          </fieldset>
          <Field>
            <FieldLabel htmlFor="workout-energy">
              Energy (optional, 1–5)
            </FieldLabel>
            <Input
              id="workout-energy"
              type="number"
              min={1}
              max={5}
              value={energy}
              onChange={(e) => setEnergy(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workout-soreness">
              Soreness / movements to avoid
            </FieldLabel>
            <Textarea
              id="workout-soreness"
              maxLength={500}
              value={soreness}
              onChange={(e) => setSoreness(e.target.value)}
            />
          </Field>
          {regenerateFromId && (
            <Field>
              <FieldLabel htmlFor="workout-tweak">
                What should change?
              </FieldLabel>
              <Textarea
                id="workout-tweak"
                maxLength={1000}
                value={tweak}
                onChange={(e) => setTweak(e.target.value)}
              />
              <FieldDescription>
                The original workout remains saved in your library.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>
        <Button
          type="submit"
          disabled={busy || !prompt.trim()}
          className="min-h-14"
        >
          {busy ? "Generating workout…" : "Generate workout"}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Check request status</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <section aria-live="polite" className="flex flex-col gap-3">
          {inFlight && (
            <p>
              Generating one workout. You can return later; the result will be
              saved.
            </p>
          )}
          {result.status === "saved" && (
            <>
              <p>Workout saved.</p>
              {result.preview ? (
                <Button asChild>
                  <Link
                    to="/on-demand-workouts/$id"
                    params={{ id: result.onDemandWorkoutId }}
                  >
                    Preview workout
                  </Link>
                </Button>
              ) : (
                <p>This saved workout has since been deleted.</p>
              )}
            </>
          )}
          {result.status === "failed" && (
            <p role="alert">
              {result.reason}{" "}
              {result.attemptConsumed
                ? "This attempt counts toward the daily allowance."
                : "No generation attempt was used."}
              {result.resetsAt
                ? ` Resets ${new Date(result.resetsAt).toLocaleString()}.`
                : ""}
            </p>
          )}
          {result.status === "unknown" && (
            <p>
              The provider outcome cannot be confirmed. This request will not be
              sent again automatically.
            </p>
          )}
          {result.status === "save_pending" && (
            <>
              <p>
                Your output is retained on the server; saving to the library is
                pending.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  void retryOnDemandWorkoutSaveFn({
                    data: { requestId: result.requestId },
                  })
                    .then(accept)
                    .catch(() =>
                      setError(
                        "Save is still pending. Retry when the server is available."
                      )
                    )
                }
              >
                Retry save without generating
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() =>
              void getOnDemandWorkoutGenerationFn({
                data: { requestId: result.requestId },
              })
                .then(accept)
                .catch(() => setError("Could not reach the server."))
            }
          >
            Check request status
          </Button>
        </section>
      )}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Recent requests</h2>
          {recent.map((r) => (
            <Button
              key={r.requestId}
              variant="outline"
              className="h-auto min-h-11 justify-start text-left whitespace-normal"
              onClick={() =>
                void getOnDemandWorkoutGenerationFn({
                  data: { requestId: r.requestId },
                }).then(accept)
              }
            >
              {r.promptExcerpt} · {r.status}
            </Button>
          ))}
        </section>
      )}
    </main>
  )
}
