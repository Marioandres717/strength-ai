import type { SessionRun } from "../../types/session"
import { plannedSessionAdapter } from "../../lib/plannedSessionAdapter"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  cacheRun,
  commitWorkoutSet,
  completeWorkoutLocally,
  saveRestDeadline,
  loadRun,
  getLocalRun,
} from "../../lib/workoutPersistence"
import type { SetCommit } from "../../lib/workoutPersistence"
import type { GetSessionDataResult } from "../../functions/getSessionData"

import { useSessionStore } from "../../stores/sessionStore"
import { displayWeight, toKg } from "../../lib/weightUnits"
import { ExecutionView } from "./ExecutionView"
import { SessionHeader } from "./SessionHeader"
import { SetDetailView } from "./SetDetailView"

export interface SessionPersistence {
  updateRest?: typeof saveRestDeadline
  prepare: (run: SessionRun) => Promise<SessionRun>
  commit: (id: string, entry: SetCommit) => Promise<string>
  complete: (id: string) => Promise<{ workoutLogId: string }>
}
const localPersistence: SessionPersistence = {
  prepare: async (run) => {
    if (!(await getLocalRun(run.workoutLogId))) await cacheRun(run)
    return loadRun(run.workoutLogId, false)
  },
  commit: commitWorkoutSet,
  complete: completeWorkoutLocally,
  updateRest: saveRestDeadline,
}

interface SessionPageProps {
  persistence?: SessionPersistence
  loaderData: GetSessionDataResult | SessionRun
}

export function SessionPage({
  loaderData,
  persistence = localPersistence,
}: SessionPageProps) {
  const navigate = useNavigate()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [timerError, setTimerError] = useState<string | null>(null)
  const isCompletingRef = useRef(false)

  const {
    initSession,
    reset,
    phase,
    exercises,
    currentExerciseIndex,
    currentSetNumber,
    inputWeight,
    inputReps,
    inputRir,
    restSecondsRemaining,
    restSecondsTotal,
    loggedSets,
    isSubmitting,
    workoutLogId,
    programName,
    title,
    startedAt,
    setSyncError,
    commitSet,
    retryUnsyncedSets,
    adjustTimer,
    skipRest,
    setInputWeight,
    setInputReps,
    setInputRir,
  } = useSessionStore()

  const allSetsSaved =
    loggedSets.length > 0 &&
    loggedSets.every((entry) => entry.syncStatus === "saved")
  const hasPendingSets = loggedSets.some(
    (entry) => entry.syncStatus === "pending"
  )
  const hasFailedSets = loggedSets.some(
    (entry) => entry.syncStatus === "failed"
  )
  const sessionCompleteStatusText =
    completionError ??
    (allSetsSaved
      ? "Saving workout on this device..."
      : hasPendingSets
        ? "Saving committed sets on this device..."
        : "Some sets could not be saved. Retry before finishing.")

  const persistSet = (entry: SetCommit) =>
    persistence.commit(workoutLogId, entry)

  useEffect(() => {
    let active = true
    const run =
      "source" in loaderData ? loaderData : plannedSessionAdapter(loaderData)
    void persistence
      .prepare(run)
      .then((prepared) => {
        if (active) initSession(prepared)
      })
      .catch(() =>
        setCompletionError(
          "Device storage is unavailable. Reload to retry before logging sets."
        )
      )
    const visibility = () => useSessionStore.getState().tickTimer()
    document.addEventListener("visibilitychange", visibility)
    return () => {
      active = false
      document.removeEventListener("visibilitychange", visibility)
      reset()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const startMs =
      startedAt instanceof Date
        ? startedAt.getTime()
        : new Date(startedAt).getTime()
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000))
    }
    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [startedAt])

  const retryCompletion = async () => {
    if (isCompletingRef.current || !allSetsSaved) return

    isCompletingRef.current = true
    setCompletionError(null)

    try {
      const result = await persistence.complete(workoutLogId)

      void navigate({
        to: "/feedback/$id",
        params: { id: result.workoutLogId },
      })
    } catch (error) {
      console.error("Failed to complete session:", error)
      setCompletionError("Failed to complete workout. Retry to continue.")
      isCompletingRef.current = false
    }
  }

  useEffect(() => {
    if (phase !== "session_complete" || completionError !== null) return
    if (!allSetsSaved || isCompletingRef.current) return

    isCompletingRef.current = true

    void persistence
      .complete(workoutLogId)
      .then((result) => {
        void navigate({
          to: "/feedback/$id",
          params: { id: result.workoutLogId },
        })
      })
      .catch((error) => {
        console.error("Failed to complete session:", error)
        setCompletionError("Failed to complete workout. Retry to continue.")
        isCompletingRef.current = false
      })
  }, [
    allSetsSaved,
    completionError,
    navigate,
    phase,
    persistence,
    workoutLogId,
  ])

  const totalVolumeKg = loggedSets.reduce(
    (sum: number, set) => sum + set.weightKg * set.reps,
    0
  )
  const units = loaderData.units

  const handleCommitSet = () => {
    setCompletionError(null)

    void commitSet({
      weightKg: inputWeight,
      reps: inputReps,
      rirActual: inputRir,
      onPersist: persistSet,
    })
  }

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-muted text-sm">
          {completionError ?? "Loading session..."}
        </p>
      </div>
    )
  }

  const currentExercise = exercises[currentExerciseIndex]

  if (phase === "session_complete") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="bg-accent/20 flex h-16 w-16 items-center justify-center rounded-full">
          <svg
            className="text-accent h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Session Complete!</h1>
        <p className="text-muted text-sm">{sessionCompleteStatusText}</p>
        {!allSetsSaved && hasFailedSets && (
          <button
            type="button"
            onClick={() => {
              void retryUnsyncedSets({ onPersist: persistSet })
            }}
            disabled={isSubmitting}
            className="bg-accent h-12 rounded-2xl px-6 text-sm font-bold text-black transition-opacity active:opacity-80 disabled:opacity-60"
          >
            {isSubmitting ? "Retrying set sync..." : "Retry set sync"}
          </button>
        )}
        {completionError && (
          <button
            type="button"
            onClick={() => void retryCompletion()}
            className="bg-accent h-12 rounded-2xl px-6 text-sm font-bold text-black transition-opacity active:opacity-80"
          >
            Retry completion
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-bg flex min-h-screen flex-col">
      <SessionHeader
        title={programName ?? title}
        currentExerciseIndex={currentExerciseIndex}
        totalExercises={exercises.length}
        elapsedSeconds={elapsedSeconds}
        totalVolumeKg={Math.round(displayWeight(totalVolumeKg, units))}
        units={units}
      />

      {phase === "active_set" ? (
        <SetDetailView
          exercise={currentExercise}
          setNumber={currentSetNumber}
          totalSets={currentExercise.prescription.sets}
          exerciseIndex={currentExerciseIndex}
          totalExercises={exercises.length}
          inputWeight={displayWeight(inputWeight, units)}
          units={units}
          inputReps={inputReps}
          inputRir={inputRir}
          isSubmitting={isSubmitting}
          errorMessage={setSyncError ?? timerError}
          onBack={() => {
            void navigate({
              to:
                "source" in loaderData &&
                loaderData.source.kind === "on_demand_workout"
                  ? "/on-demand-workouts"
                  : "/",
            })
          }}
          onWeightChange={(weight) => setInputWeight(toKg(weight, units))}
          onRepsChange={setInputReps}
          onRirChange={setInputRir}
          onComplete={handleCommitSet}
        />
      ) : (
        <ExecutionView
          units={units}
          exercises={exercises}
          currentExerciseIndex={currentExerciseIndex}
          currentSetNumber={currentSetNumber}
          restSecondsRemaining={restSecondsRemaining}
          restSecondsTotal={restSecondsTotal}
          loggedSets={loggedSets}
          onLogSet={() => {
            skipRest()
            void persistence
              .updateRest?.(workoutLogId, null, 0)
              .catch(() => undefined)
          }}
          onAdjustTimer={(delta) => {
            adjustTimer(delta)
            const state = useSessionStore.getState()
            void persistence
              .updateRest?.(
                workoutLogId,
                state.restDeadline,
                state.restSecondsTotal
              )
              .catch(() =>
                setTimerError("Could not save the timer adjustment.")
              )
          }}
          onSkipRest={() => {
            skipRest()
            void persistence
              .updateRest?.(workoutLogId, null, 0)
              .catch(() =>
                setTimerError("Could not save the timer adjustment.")
              )
          }}
        />
      )}
    </div>
  )
}
