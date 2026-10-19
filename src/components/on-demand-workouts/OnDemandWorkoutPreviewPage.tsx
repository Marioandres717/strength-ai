import { useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "../ui/button"
import { Alert, AlertTitle, AlertDescription } from "../ui/alert"
import type { OnDemandWorkoutPreview } from "../../types/on-demand-workout"
import { prescriptionId } from "../../types/session"
import {
  cacheDefinition,
  deleteWorkoutLocally,
  startLocalWorkout,
  unfinishedRun,
} from "../../lib/workoutPersistence"
import { editOnDemandWorkoutFn } from "../../functions/editOnDemandWorkout"
import { formatWeight } from "../../lib/weightUnits"
import { OfflineWorkoutAvailability } from "../OfflineWorkoutAvailability"

export function OnDemandWorkoutPreviewPage({
  data,
}: {
  data: OnDemandWorkoutPreview
}) {
  const [preview, setPreview] = useState(data),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [resume, setResume] = useState<string | undefined>(),
    [deleting, setDeleting] = useState(false),
    [online, setOnline] = useState(true)
  const navigate = useNavigate()
  useEffect(() => {
    setPreview(data)
    void unfinishedRun(data.id).then(setResume)
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [data])
  async function edit(id: string, replacement?: string) {
    setBusy(true)
    setError("")
    try {
      const result = await editOnDemandWorkoutFn({
        data: {
          onDemandWorkoutId: preview.id,
          expectedRevisionId: preview.revisionId,
          action: replacement
            ? {
                kind: "swap",
                onDemandWorkoutExerciseId: id,
                replacementExerciseId: replacement,
              }
            : { kind: "remove", onDemandWorkoutExerciseId: id },
        },
      })
      setPreview(result.preview)
      await cacheDefinition(result.preview)
      if (result.status === "conflict")
        setError(
          "This workout changed on another device. The latest version is now shown."
        )
    } catch {
      setError("Could not save the edit. Connect to the server and try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <Link
        to="/on-demand-workouts"
        className="text-muted min-h-11 text-sm underline"
      >
        Workout library
      </Link>
      <div>
        <h1 className="text-3xl font-bold">{preview.title}</h1>
        <p className="text-muted mt-2 text-sm">
          {Math.ceil(preview.estimatedDurationSeconds / 60)} min estimate ·{" "}
          {preview.focus}
        </p>
      </div>
      <p className="text-sm">{preview.reasoning}</p>
      <OfflineWorkoutAvailability id={preview.id} />
      {preview.editKind === "preview_edit" && (
        <p className="text-muted text-sm">
          You edited the exercise selection. The rationale above describes the
          original generation.
        </p>
      )}
      <dl className="bg-surface grid grid-cols-2 gap-3 rounded-xl p-4 text-sm">
        <dt>Time budget</dt>
        <dd>{preview.constraints.timeMinutes} minutes</dd>
        <dt>Equipment</dt>
        <dd>{preview.constraints.equipment.join(", ") || "Bodyweight"}</dd>
        <dt>Energy</dt>
        <dd>{preview.constraints.energy ?? "Not specified"}</dd>
        <dt>Soreness</dt>
        <dd>{preview.constraints.soreness ?? "Not specified"}</dd>
      </dl>
      <p className="text-muted text-xs">
        Loads refresh from your latest available exact-exercise history.
        Conservative suggestions never automatically increase. Review before
        starting.
      </p>
      {preview.exercises.map(({ exercise, prescription: p }) => (
        <section
          className="border-border flex flex-col gap-3 rounded-xl border p-4"
          key={prescriptionId(p.ref)}
        >
          <h2 className="font-semibold">{exercise.name}</h2>
          <p className="text-sm">
            {p.sets} × {p.repRange} · {formatWeight(p.loadKg, preview.units)} ·{" "}
            {p.rirTarget} RIR · {p.restSeconds}s rest
          </p>
          <p className="text-muted text-xs">
            {p.loadBasis === "history"
              ? `History: ${new Date(p.loadHistoryAt!).toLocaleDateString()}`
              : p.loadBasis === "bodyweight"
                ? "Bodyweight / no additional load"
                : "Conservative starting estimate — adjust as needed"}
          </p>
          <p className="text-sm">{p.coachNote}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!online || busy || preview.exercises.length === 1}
              onClick={() => void edit(prescriptionId(p.ref))}
            >
              Remove
            </Button>
            {preview.alternatives[prescriptionId(p.ref)]?.length > 0 && (
              <label className="text-muted flex min-h-11 items-center gap-2 text-sm">
                Swap
                <select
                  aria-label={`Replace ${exercise.name}`}
                  disabled={!online || busy}
                  value=""
                  onChange={(event) =>
                    void edit(prescriptionId(p.ref), event.target.value)
                  }
                  className="bg-surface border-border max-w-48 rounded-md border p-2"
                >
                  <option value="">Choose replacement</option>
                  {preview.alternatives[prescriptionId(p.ref)].map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>
      ))}
      {!online && (
        <p className="text-muted text-sm">
          Cached workout. Editing and generation require a connection. Loads use
          the latest history saved on this device.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Action needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {resume && (
        <Button className="min-h-14" asChild>
          <Link to="/workout/$id" params={{ id: resume }}>
            Resume workout
          </Link>
        </Button>
      )}
      <Button
        className="min-h-14"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void startLocalWorkout(preview)
            .then((id) => navigate({ to: "/workout/$id", params: { id } }))
            .catch(() => {
              setError(
                "Could not save the workout on this device. Start again after checking device storage."
              )
              setBusy(false)
            })
        }}
      >
        {resume ? "Run again" : "Start workout"}
      </Button>
      <Button asChild variant="outline" disabled={!online}>
        <Link to="/on-demand-workouts/new" search={{ from: preview.id }}>
          Regenerate with a tweak
        </Link>
      </Button>
      <p className="text-muted text-xs">
        Regeneration creates another saved workout and uses one daily attempt.
      </p>
      {deleting ? (
        <div className="flex flex-col gap-3">
          <p>
            Remove this workout from the library? Existing workout logs are
            kept.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              void deleteWorkoutLocally(preview.id)
                .then(() => navigate({ to: "/on-demand-workouts" }))
                .catch(() =>
                  setError("Could not save the deletion on this device.")
                )
            }}
          >
            Delete workout
          </Button>
          <Button variant="outline" onClick={() => setDeleting(false)}>
            Keep workout
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setDeleting(true)}>
          Delete from library
        </Button>
      )}
    </main>
  )
}
