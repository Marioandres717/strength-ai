import { create } from "zustand"
import type { SelectExercise, SelectPlannedExercise } from "../../lib/schema"
import type { PriorPerformance } from "../functions/getSessionData"
import { parseRepRangeLower } from "../../lib/rules"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionPhase = "active_set" | "resting" | "session_complete"
export type LoggedSetSyncStatus = "pending" | "saved" | "failed"

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
  serverSetLogId: string | null
  syncStatus: LoggedSetSyncStatus
}

export interface PersistedLoggedSet {
  setLogId: string
  plannedExerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
}

export interface SessionInitPayload {
  workoutLogId: string
  sessionTemplateId: string
  programName: string
  exercises: SessionExercise[]
  startedAt: Date
  persistedSets: PersistedLoggedSet[]
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
  setSyncError: string | null

  // ── Actions ──────────────────────────────────────────────────────────────

  initSession: (payload: SessionInitPayload) => void

  commitSet: (params: {
    weightKg: number
    reps: number
    rirActual: number
    onPersist: (
      entry: Omit<LoggedSet, "serverSetLogId" | "syncStatus">
    ) => Promise<string>
  }) => Promise<void>
  retryUnsyncedSets: (params: {
    onPersist: (
      entry: Omit<LoggedSet, "serverSetLogId" | "syncStatus">
    ) => Promise<string>
  }) => Promise<boolean>

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

function toSetKey(plannedExerciseId: string, setNumber: number) {
  return `${plannedExerciseId}:${setNumber}`
}

function updateLoggedSet(
  loggedSets: LoggedSet[],
  target: Pick<LoggedSet, "plannedExerciseId" | "setNumber">,
  updater: (entry: LoggedSet) => LoggedSet
) {
  return loggedSets.map((entry) =>
    entry.plannedExerciseId === target.plannedExerciseId &&
    entry.setNumber === target.setNumber
      ? updater(entry)
      : entry
  )
}

function upsertLoggedSet(loggedSets: LoggedSet[], nextEntry: LoggedSet) {
  const existingIndex = loggedSets.findIndex(
    (entry) =>
      entry.plannedExerciseId === nextEntry.plannedExerciseId &&
      entry.setNumber === nextEntry.setNumber
  )

  if (existingIndex === -1) {
    return [...loggedSets, nextEntry]
  }

  const nextLoggedSets = [...loggedSets]
  nextLoggedSets[existingIndex] = nextEntry
  return nextLoggedSets
}

function dedupePersistedSets(persistedSets: PersistedLoggedSet[]) {
  const deduped = new Map<string, PersistedLoggedSet>()

  for (const entry of persistedSets) {
    const key = toSetKey(entry.plannedExerciseId, entry.setNumber)
    const existing = deduped.get(key)
    if (!existing || entry.loggedAt.getTime() >= existing.loggedAt.getTime()) {
      deduped.set(key, entry)
    }
  }

  return [...deduped.values()]
}

function findNextUnloggedSet(
  exercises: SessionExercise[],
  loggedSets: LoggedSet[]
): { exerciseIndex: number; setNumber: number } | null {
  const savedKeys = new Set(
    loggedSets
      .filter((entry) => entry.syncStatus === "saved")
      .map((entry) => toSetKey(entry.plannedExerciseId, entry.setNumber))
  )

  for (const [exerciseIndex, exercise] of exercises.entries()) {
    for (
      let setNumber = 1;
      setNumber <= exercise.planned.sets;
      setNumber += 1
    ) {
      if (!savedKeys.has(toSetKey(exercise.planned.id, setNumber))) {
        return { exerciseIndex, setNumber }
      }
    }
  }

  return null
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
  setSyncError: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionState>()((set, get) => ({
  ...EMPTY_STATE,

  initSession: (payload) => {
    const firstExercise = payload.exercises[0]
    const loggedSets = dedupePersistedSets(payload.persistedSets).map(
      (entry) => ({
        plannedExerciseId: entry.plannedExerciseId,
        setNumber: entry.setNumber,
        weightKg: entry.weightKg,
        reps: entry.reps,
        rirActual: entry.rirActual,
        serverSetLogId: entry.setLogId,
        syncStatus: "saved" as const,
      })
    )
    const nextUnloggedSet = findNextUnloggedSet(payload.exercises, loggedSets)
    const activeExercise =
      nextUnloggedSet != null
        ? payload.exercises[nextUnloggedSet.exerciseIndex]
        : firstExercise

    set({
      ...EMPTY_STATE,
      workoutLogId: payload.workoutLogId,
      sessionTemplateId: payload.sessionTemplateId,
      programName: payload.programName,
      exercises: payload.exercises,
      startedAt: payload.startedAt,
      loggedSets,
      phase: nextUnloggedSet == null ? "session_complete" : "active_set",
      currentExerciseIndex: nextUnloggedSet?.exerciseIndex ?? 0,
      currentSetNumber: nextUnloggedSet?.setNumber ?? 1,
      ...(activeExercise ? seedInputs(activeExercise) : {}),
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
      syncStatus: "pending",
    }
    const existingEntry = state.loggedSets.find(
      (entry) =>
        entry.plannedExerciseId === newEntry.plannedExerciseId &&
        entry.setNumber === newEntry.setNumber
    )

    if (existingEntry?.syncStatus === "saved") return

    const nextLoggedSets = upsertLoggedSet(state.loggedSets, newEntry)

    if (isSessionComplete) {
      set({
        isSubmitting: true,
        loggedSets: nextLoggedSets,
        setSyncError: null,
      })
    } else {
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
        loggedSets: nextLoggedSets,
        setSyncError: null,
      })
    }

    try {
      const setLogId = await onPersist({
        plannedExerciseId: newEntry.plannedExerciseId,
        setNumber: newEntry.setNumber,
        weightKg: newEntry.weightKg,
        reps: newEntry.reps,
        rirActual: newEntry.rirActual,
      })

      // Fill in the server-assigned ID
      set((s) => {
        const loggedSets = updateLoggedSet(s.loggedSets, newEntry, (entry) => ({
          ...entry,
          serverSetLogId: setLogId,
          syncStatus: "saved",
        }))

        return {
          loggedSets,
          phase: isSessionComplete ? "session_complete" : s.phase,
          isSubmitting: false,
          setSyncError: null,
        }
      })
    } catch {
      set((s) => ({
        loggedSets: updateLoggedSet(s.loggedSets, newEntry, (entry) => ({
          ...entry,
          syncStatus: "failed",
        })),
        isSubmitting: false,
        setSyncError: isSessionComplete
          ? "Failed to save your final set. Retry to finish the workout."
          : s.setSyncError,
      }))
    }
  },

  retryUnsyncedSets: async ({ onPersist }) => {
    const state = get()
    if (state.isSubmitting) return false

    const unsyncedSets = state.loggedSets.filter(
      (entry) => entry.syncStatus !== "saved"
    )

    if (unsyncedSets.length === 0) {
      return true
    }

    set({ isSubmitting: true, setSyncError: null })

    let allSucceeded = true

    for (const entry of unsyncedSets) {
      set((currentState) => ({
        loggedSets: updateLoggedSet(
          currentState.loggedSets,
          entry,
          (current) => ({
            ...current,
            syncStatus: "pending",
          })
        ),
      }))

      try {
        const setLogId = await onPersist({
          plannedExerciseId: entry.plannedExerciseId,
          setNumber: entry.setNumber,
          weightKg: entry.weightKg,
          reps: entry.reps,
          rirActual: entry.rirActual,
        })

        set((currentState) => ({
          loggedSets: updateLoggedSet(
            currentState.loggedSets,
            entry,
            (current) => ({
              ...current,
              serverSetLogId: setLogId,
              syncStatus: "saved",
            })
          ),
        }))
      } catch {
        allSucceeded = false
        set((currentState) => ({
          loggedSets: updateLoggedSet(
            currentState.loggedSets,
            entry,
            (current) => ({
              ...current,
              syncStatus: "failed",
            })
          ),
        }))
      }
    }

    set({ isSubmitting: false })

    return allSucceeded
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
