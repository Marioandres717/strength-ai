import { create } from "zustand"
import type {
  SessionExercise,
  SessionRun,
  PrescriptionRef,
  PersistedSet,
} from "../types/session"
import { prescriptionId } from "../types/session"
import { parseRepRangeLower } from "../../lib/rules"
export type { SessionExercise } from "../types/session"
export type SessionPhase = "active_set" | "resting" | "session_complete"
export type LoggedSetSyncStatus = "pending" | "saved" | "failed"
export interface LoggedSet {
  prescriptionRef: PrescriptionRef
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
  serverSetLogId: string | null
  syncStatus: LoggedSetSyncStatus
}
export type PersistedLoggedSet = PersistedSet
export type SessionInitPayload = SessionRun

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface SessionState {
  // Identity
  workoutLogId: string
  source: SessionRun["source"]
  title: string
  programName: string | null

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
  restDeadline: number | null
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
      return parseRepRangeLower(exercise.prescription.repRange)
    } catch {
      return 8
    }
  })()
  return {
    inputWeight: exercise.prescription.loadKg,
    inputReps: lowerReps,
    inputRir: exercise.prescription.rirTarget,
  }
}

function toSetKey(prescriptionRef: PrescriptionRef, setNumber: number) {
  return `${prescriptionRef.kind}:${prescriptionId(prescriptionRef)}:${setNumber}`
}

function updateLoggedSet(
  loggedSets: LoggedSet[],
  target: Pick<LoggedSet, "prescriptionRef" | "setNumber">,
  updater: (entry: LoggedSet) => LoggedSet
) {
  return loggedSets.map((entry) =>
    toSetKey(entry.prescriptionRef, entry.setNumber) ===
      toSetKey(target.prescriptionRef, target.setNumber) &&
    entry.setNumber === target.setNumber
      ? updater(entry)
      : entry
  )
}

function upsertLoggedSet(loggedSets: LoggedSet[], nextEntry: LoggedSet) {
  const existingIndex = loggedSets.findIndex(
    (entry) =>
      toSetKey(entry.prescriptionRef, entry.setNumber) ===
        toSetKey(nextEntry.prescriptionRef, nextEntry.setNumber) &&
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
    const key = toSetKey(entry.prescriptionRef, entry.setNumber)
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
      .map((entry) => toSetKey(entry.prescriptionRef, entry.setNumber))
  )

  for (const [exerciseIndex, exercise] of exercises.entries()) {
    for (
      let setNumber = 1;
      setNumber <= exercise.prescription.sets;
      setNumber += 1
    ) {
      if (!savedKeys.has(toSetKey(exercise.prescription.ref, setNumber))) {
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
    state.currentSetNumber >= currentExercise.prescription.sets
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
  source: {
    kind: "planned",
    sessionTemplateId: "",
    programId: "",
  } as SessionRun["source"],
  title: "",
  programName: "",
  exercises: [] as SessionExercise[],
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  inputWeight: 0,
  inputReps: 8,
  inputRir: 2,
  phase: "active_set" as SessionPhase,
  restDeadline: null as number | null,
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
        prescriptionRef: entry.prescriptionRef,
        setNumber: entry.setNumber,
        weightKg: entry.weightKg,
        reps: entry.reps,
        rirActual: entry.rirActual,
        loggedAt: entry.loggedAt,
        serverSetLogId: entry.setLogId,
        syncStatus: "saved" as const,
      })
    )
    const nextUnloggedSet = findNextUnloggedSet(payload.exercises, loggedSets)
    const activeExercise =
      nextUnloggedSet != null
        ? payload.exercises[nextUnloggedSet.exerciseIndex]
        : firstExercise

    const rest =
      payload.restDeadline &&
      payload.restDeadline > Date.now() &&
      nextUnloggedSet
        ? payload.restDeadline
        : null
    const previousIndex = nextUnloggedSet
      ? nextUnloggedSet.exerciseIndex -
        (nextUnloggedSet.setNumber === 1 ? 1 : 0)
      : -1
    const previousExercise = payload.exercises[previousIndex]
    const previousSet = previousExercise
      ? payload.persistedSets.find(
          (entry) =>
            prescriptionId(entry.prescriptionRef) ===
              prescriptionId(previousExercise.prescription.ref) &&
            entry.setNumber ===
              (nextUnloggedSet && nextUnloggedSet.setNumber > 1
                ? nextUnloggedSet.setNumber - 1
                : previousExercise.prescription.sets)
        )
      : undefined
    set({
      ...EMPTY_STATE,
      workoutLogId: payload.workoutLogId,
      source: payload.source,
      title: payload.title,
      programName: payload.programName,
      exercises: payload.exercises,
      startedAt: payload.startedAt,
      loggedSets,
      phase:
        rest && previousIndex >= 0
          ? "resting"
          : nextUnloggedSet == null
            ? "session_complete"
            : "active_set",
      restDeadline: rest,
      restSecondsTotal: payload.restSeconds ?? 0,
      restSecondsRemaining: rest ? Math.ceil((rest - Date.now()) / 1000) : 0,
      restIntervalId: rest ? setInterval(() => get().tickTimer(), 1000) : null,
      currentExerciseIndex:
        rest && previousIndex >= 0
          ? previousIndex
          : (nextUnloggedSet?.exerciseIndex ?? 0),
      currentSetNumber:
        rest && previousSet
          ? previousSet.setNumber
          : (nextUnloggedSet?.setNumber ?? 1),
      ...(activeExercise ? seedInputs(activeExercise) : {}),
    })
  },

  commitSet: async ({ weightKg, reps, rirActual, onPersist }) => {
    const state = get()
    if (state.isSubmitting) return

    const currentExercise = state.exercises[state.currentExerciseIndex]
    const isLastSetOfExercise =
      state.currentSetNumber >= currentExercise.prescription.sets
    const isLastExercise =
      state.currentExerciseIndex >= state.exercises.length - 1
    const isSessionComplete = isLastSetOfExercise && isLastExercise

    const newEntry: LoggedSet = {
      prescriptionRef: currentExercise.prescription.ref,
      loggedAt:
        state.loggedSets.find(
          (entry) =>
            toSetKey(entry.prescriptionRef, entry.setNumber) ===
            toSetKey(currentExercise.prescription.ref, state.currentSetNumber)
        )?.loggedAt ?? new Date(),
      setNumber: state.currentSetNumber,
      weightKg,
      reps,
      rirActual,
      serverSetLogId: null,
      syncStatus: "pending",
    }
    const existingEntry = state.loggedSets.find(
      (entry) =>
        toSetKey(entry.prescriptionRef, entry.setNumber) ===
          toSetKey(newEntry.prescriptionRef, newEntry.setNumber) &&
        entry.setNumber === newEntry.setNumber
    )

    if (existingEntry?.syncStatus === "saved") return

    set({
      isSubmitting: true,
      loggedSets: upsertLoggedSet(state.loggedSets, newEntry),
      setSyncError: null,
    })

    try {
      const setLogId = await onPersist({
        prescriptionRef: newEntry.prescriptionRef,
        setNumber: newEntry.setNumber,
        weightKg: newEntry.weightKg,
        reps: newEntry.reps,
        rirActual: newEntry.rirActual,
        loggedAt: newEntry.loggedAt,
      })
      if (get().workoutLogId !== state.workoutLogId) return

      // Fill in the server-assigned ID
      set((s) => {
        const loggedSets = updateLoggedSet(s.loggedSets, newEntry, (entry) => ({
          ...entry,
          serverSetLogId: setLogId,
          syncStatus: "saved",
        }))

        return {
          loggedSets,
          phase: isSessionComplete ? "session_complete" : "resting",
          restDeadline: isSessionComplete
            ? null
            : Date.now() + currentExercise.prescription.restSeconds * 1000,
          restSecondsRemaining: currentExercise.prescription.restSeconds,
          restSecondsTotal: currentExercise.prescription.restSeconds,
          restIntervalId: isSessionComplete
            ? null
            : setInterval(() => get().tickTimer(), 1000),
          isSubmitting: false,
          setSyncError: null,
        }
      })
    } catch {
      if (get().workoutLogId !== state.workoutLogId) return
      set((s) => ({
        loggedSets: updateLoggedSet(s.loggedSets, newEntry, (entry) => ({
          ...entry,
          syncStatus: "failed",
        })),
        isSubmitting: false,
        setSyncError: isSessionComplete
          ? "Failed to save your final set. Retry to finish the workout."
          : "Failed to save set on this device. Retry before continuing.",
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
          prescriptionRef: entry.prescriptionRef,
          setNumber: entry.setNumber,
          weightKg: entry.weightKg,
          reps: entry.reps,
          rirActual: entry.rirActual,
          loggedAt: entry.loggedAt,
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

    const next = Math.ceil(
      ((state.restDeadline ?? Date.now()) - Date.now()) / 1000
    )
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
      restDeadline:
        Date.now() +
        Math.max(0, Math.min(next, state.restSecondsTotal + 120)) * 1000,
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
      restDeadline: null,
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
