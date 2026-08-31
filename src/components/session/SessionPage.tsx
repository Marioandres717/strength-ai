import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { completeSessionFn } from "../../functions/completeSession"
import type { GetSessionDataResult } from "../../functions/getSessionData"
import { logSetFn } from "../../functions/logSet"
import { useSessionStore } from "../../stores/sessionStore"
import { ExecutionView } from "./ExecutionView"
import { SessionHeader } from "./SessionHeader"
import { SetDetailView } from "./SetDetailView"

interface SessionPageProps {
  loaderData: GetSessionDataResult
}

export function SessionPage({ loaderData }: SessionPageProps) {
  const navigate = useNavigate()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [completionError, setCompletionError] = useState<string | null>(null)
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
    sessionTemplateId,
    programName,
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
      ? "Calculating your results..."
      : hasPendingSets
        ? "Waiting for every set to sync before completion..."
        : "Some sets failed to sync. Retry before completion.")

  const persistSet = async (entry: {
    plannedExerciseId: string
    setNumber: number
    weightKg: number
    reps: number
    rirActual: number
  }) => {
    const result = await logSetFn({
      data: {
        workoutLogId,
        plannedExerciseId: entry.plannedExerciseId,
        setNumber: entry.setNumber,
        weightKg: entry.weightKg,
        reps: entry.reps,
        rirActual: entry.rirActual,
        loggedAt: new Date().toISOString(),
      },
    })

    return result.setLogId
  }

  useEffect(() => {
    initSession({
      workoutLogId: loaderData.workoutLogId,
      sessionTemplateId: loaderData.sessionTemplate.id,
      programName: loaderData.program.name,
      exercises: loaderData.exercises,
      startedAt: loaderData.startedAt,
      persistedSets: loaderData.persistedSets,
    })
    return () => reset()
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
      const result = await completeSessionFn({
        data: { workoutLogId, sessionTemplateId },
      })

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

    void completeSessionFn({
      data: { workoutLogId, sessionTemplateId },
    })
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
    sessionTemplateId,
    workoutLogId,
  ])

  const totalVolumeKg = loggedSets.reduce(
    (sum: number, set) => sum + set.weightKg * set.reps,
    0
  )

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
        <p className="text-muted text-sm">Loading session...</p>
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
        programName={programName}
        currentExerciseIndex={currentExerciseIndex}
        totalExercises={exercises.length}
        elapsedSeconds={elapsedSeconds}
        totalVolumeKg={Math.round(totalVolumeKg)}
      />

      {phase === "active_set" ? (
        <SetDetailView
          exercise={currentExercise}
          setNumber={currentSetNumber}
          totalSets={currentExercise.planned.sets}
          exerciseIndex={currentExerciseIndex}
          totalExercises={exercises.length}
          inputWeight={inputWeight}
          inputReps={inputReps}
          inputRir={inputRir}
          isSubmitting={isSubmitting}
          errorMessage={setSyncError}
          onBack={() => {
            void navigate({ to: "/" })
          }}
          onWeightChange={setInputWeight}
          onRepsChange={setInputReps}
          onRirChange={setInputRir}
          onComplete={handleCommitSet}
        />
      ) : (
        <ExecutionView
          exercises={exercises}
          currentExerciseIndex={currentExerciseIndex}
          currentSetNumber={currentSetNumber}
          restSecondsRemaining={restSecondsRemaining}
          restSecondsTotal={restSecondsTotal}
          loggedSets={loggedSets}
          onLogSet={skipRest}
          onAdjustTimer={adjustTimer}
          onSkipRest={skipRest}
        />
      )}
    </div>
  )
}
