import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { GetSessionDataResult } from "../../functions/getSessionData"
import { logSetFn } from "../../functions/logSet"
import { completeSessionFn } from "../../functions/completeSession"
import { useSessionStore } from "../../stores/sessionStore"
import { SessionHeader } from "./SessionHeader"
import { SetDetailView } from "./SetDetailView"
import { ExecutionView } from "./ExecutionView"

interface SessionPageProps {
  loaderData: GetSessionDataResult
}

export function SessionPage({ loaderData }: SessionPageProps) {
  const navigate = useNavigate()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  // Ref guards against double-firing completeSession when phase hits "session_complete"
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
    commitSet,
    adjustTimer,
    skipRest,
    setInputWeight,
    setInputReps,
    setInputRir,
  } = useSessionStore()

  // Initialize store with loader data on mount
  useEffect(() => {
    initSession({
      workoutLogId: loaderData.workoutLogId,
      sessionTemplateId: loaderData.sessionTemplate.id,
      programName: loaderData.program.name,
      exercises: loaderData.exercises,
      startedAt: loaderData.startedAt,
    })
    return () => reset()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed timer
  useEffect(() => {
    const startMs =
      startedAt instanceof Date
        ? startedAt.getTime()
        : new Date(startedAt).getTime()
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  // Watch for session complete → call completeSession → navigate to feedback
  useEffect(() => {
    if (phase !== "session_complete" || isCompletingRef.current) return
    isCompletingRef.current = true

    void completeSessionFn({ data: { workoutLogId, sessionTemplateId } })
      .then((result) => {
        void navigate({
          to: "/feedback/$id",
          params: { id: result.workoutLogId },
        })
      })
      .catch((err: unknown) => {
        console.error("Failed to complete session:", err)
        isCompletingRef.current = false
      })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived stats
  const totalVolumeKg = loggedSets.reduce(
    (sum: number, s: { weightKg: number; reps: number }) =>
      sum + s.weightKg * s.reps,
    0
  )

  const handleCommitSet = () => {
    void commitSet({
      weightKg: inputWeight,
      reps: inputReps,
      rirActual: inputRir,
      onPersist: async (entry: {
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
      },
    })
  }

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-muted text-sm">Loading session…</p>
      </div>
    )
  }

  const currentExercise = exercises[currentExerciseIndex]

  // Session complete loading screen — phase drives this, ref guards double-fire
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
        <p className="text-muted text-sm">Calculating your results…</p>
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
