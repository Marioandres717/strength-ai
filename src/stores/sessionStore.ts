import { create } from "zustand"
import type { SelectExercise, SelectPlannedExercise } from "../../lib/schema"
import type { PriorPerformance } from "../functions/getSessionData"
import { parseRepRangeLower } from "../../lib/rules"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionPhase = "active_set" | "resting" | "session_complete"

export interface SessionExercise {
  planned: SelectPlannedExercise
  exercise: SelectExercise
  priorPerformance: PriorPerformance | null
}

export interface LoggedSet {
  plannedExerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  /** null = optimistic (server call in flight); filled once logSet resolves */
  serverSetLogId: string | null
}

export interface SessionInitPayload {
  workoutLogId: string
  sessionTemplateId: string
  programName: string
  exercises: SessionExercise[]
  startedAt: Date
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface SessionState {
  // Identity
  workoutLogId: string
  sessionTemplateId: string
  programName: string

  // Exercise list (static after init)
  exercises: SessionExercise[]

  // Progress pointers
  currentExerciseIndex: number
  currentSetNumber: number // 1-based

  // Active-set inputs (reset on each set)
  inputWeight: number
  inputReps: number
  inputRir: number

  // Phase / timer
  phase: SessionPhase
  restSecondsRemaining: number
  restSecondsTotal: number
  restIntervalId: ReturnType<typeof setInterval> | null

  // Committed sets (optimistic)
  loggedSets: LoggedSet[]

  // Session timing
  startedAt: Date

  // Loading guard
  isSubmitting: boolean

  // ── Actions ──────────────────────────────────────────────────────────────

  initSession: (payload: SessionInitPayload) => void

  commitSet: (params: {
    weightKg: number
    reps: number
    rirActual: number
    onPersist: (entry: Omit<LoggedSet, "serverSetLogId">) => Promise<string>
  }) => Promise<void>

  tickTimer: () => void
  adjustTimer: (deltaSeconds: number) => void
  skipRest: () => void

  setInputWeight: (v: number) => void
  setInputReps: (v: number) => void
  setInputRir: (v: number) => void

  reset: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedInputs(exercise: SessionExercise) {
  const lowerReps = (() => {
    try {
      return parseRepRangeLower(exercise.planned.repRange)
    } catch {
      return 8
    }
  })()
  return {
    inputWeight: exercise.planned.loadKg,
    inputReps: lowerReps,
    inputRir: exercise.planned.rirTarget,
  }
}

/** Determine the next state after a rest ends (timer hits 0 or skip). */
function advanceAfterRest(state: SessionState): Partial<SessionState> {
  const currentExercise = state.exercises[state.currentExerciseIndex]
  const isLastSetOfExercise =
    state.currentSetNumber >= currentExercise.planned.sets
  const isLastExercise =
    state.currentExerciseIndex >= state.exercises.length - 1

  if (!isLastSetOfExercise) {
    // Next set of same exercise
    const nextSetNumber = state.currentSetNumber + 1
    return {
      phase: "active_set",
      currentSetNumber: nextSetNumber,
      ...seedInputs(currentExercise),
    }
  }

  if (!isLastExercise) {
    // First set of next exercise
    const nextExercise = state.exercises[state.currentExerciseIndex + 1]
    return {
      phase: "active_set",
      currentExerciseIndex: state.currentExerciseIndex + 1,
      currentSetNumber: 1,
      ...seedInputs(nextExercise),
    }
  }

  // Should not happen (session_complete is set before rest starts on final set)
  return { phase: "session_complete" }
}

const EMPTY_STATE = {
  workoutLogId: "",
  sessionTemplateId: "",
  programName: "",
  exercises: [] as SessionExercise[],
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  inputWeight: 0,
  inputReps: 8,
  inputRir: 2,
  phase: "active_set" as SessionPhase,
  restSecondsRemaining: 0,
  restSecondsTotal: 0,
  restIntervalId: null as ReturnType<typeof setInterval> | null,
  loggedSets: [] as LoggedSet[],
  startedAt: new Date(),
  isSubmitting: false,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionState>()((set, get) => ({
  ...EMPTY_STATE,

  initSession: (payload) => {
    const firstExercise = payload.exercises[0]
    set({
      ...EMPTY_STATE,
      workoutLogId: payload.workoutLogId,
      sessionTemplateId: payload.sessionTemplateId,
      programName: payload.programName,
      exercises: payload.exercises,
      startedAt: payload.startedAt,
      phase: "active_set",
      ...(firstExercise ? seedInputs(firstExercise) : {}),
    })
  },

  commitSet: async ({ weightKg, reps, rirActual, onPersist }) => {
    const state = get()
    if (state.isSubmitting) return

    const currentExercise = state.exercises[state.currentExerciseIndex]
    const isLastSetOfExercise =
      state.currentSetNumber >= currentExercise.planned.sets
    const isLastExercise =
      state.currentExerciseIndex >= state.exercises.length - 1
    const isSessionComplete = isLastSetOfExercise && isLastExercise

    const newEntry: LoggedSet = {
      plannedExerciseId: currentExercise.planned.id,
      setNumber: state.currentSetNumber,
      weightKg,
      reps,
      rirActual,
      serverSetLogId: null,
    }

    // Optimistically append the set
    set({ isSubmitting: true, loggedSets: [...state.loggedSets, newEntry] })

    if (isSessionComplete) {
      // No rest timer — go straight to session_complete
      set({ phase: "session_complete", isSubmitting: false })
    } else {
      // Start rest timer
      const restSeconds = currentExercise.planned.restSeconds
      const intervalId = setInterval(() => {
        get().tickTimer()
      }, 1000)

      set({
        phase: "resting",
        restSecondsRemaining: restSeconds,
        restSecondsTotal: restSeconds,
        restIntervalId: intervalId,
        isSubmitting: false,
      })
    }

    // Persist to server in the background
    try {
      const setLogId = await onPersist({
        plannedExerciseId: newEntry.plannedExerciseId,
        setNumber: newEntry.setNumber,
        weightKg: newEntry.weightKg,
        reps: newEntry.reps,
        rirActual: newEntry.rirActual,
      })

      // Fill in the server-assigned ID
      set((s) => ({
        loggedSets: s.loggedSets.map((ls) =>
          ls.plannedExerciseId === newEntry.plannedExerciseId &&
          ls.setNumber === newEntry.setNumber
            ? { ...ls, serverSetLogId: setLogId }
            : ls
        ),
      }))
    } catch {
      // Leave serverSetLogId as null to signal retry needed
    }
  },

  tickTimer: () => {
    const state = get()
    if (state.phase !== "resting") return

    const next = state.restSecondsRemaining - 1
    if (next <= 0) {
      if (state.restIntervalId !== null) {
        clearInterval(state.restIntervalId)
      }
      set({
        restSecondsRemaining: 0,
        restIntervalId: null,
        ...advanceAfterRest(state),
      })
    } else {
      set({ restSecondsRemaining: next })
    }
  },

  adjustTimer: (deltaSeconds) => {
    const state = get()
    const next = state.restSecondsRemaining + deltaSeconds
    set({
      restSecondsRemaining: Math.max(
        0,
        Math.min(next, state.restSecondsTotal + 120)
      ),
    })
  },

  skipRest: () => {
    const state = get()
    if (state.phase !== "resting") return
    if (state.restIntervalId !== null) {
      clearInterval(state.restIntervalId)
    }
    set({
      restSecondsRemaining: 0,
      restIntervalId: null,
      ...advanceAfterRest(state),
    })
  },

  setInputWeight: (v) => set({ inputWeight: Math.max(0, v) }),
  setInputReps: (v) => set({ inputReps: Math.max(1, Math.min(v, 100)) }),
  setInputRir: (v) => set({ inputRir: Math.max(0, Math.min(v, 10)) }),

  reset: () => {
    const state = get()
    if (state.restIntervalId !== null) {
      clearInterval(state.restIntervalId)
    }
    set({ ...EMPTY_STATE })
  },
}))
