import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SelectExercise, SelectPlannedExercise } from "../../lib/schema"
import { useSessionStore } from "./sessionStore"
import type {
  PersistedLoggedSet,
  SessionExercise,
  SessionInitPayload,
} from "./sessionStore"

function makePlannedExercise(
  overrides?: Partial<SelectPlannedExercise>
): SelectPlannedExercise {
  return {
    id: "pe-1",
    sessionTemplateId: "st-1",
    exerciseId: "ex-1",
    orderIndex: 0,
    sets: 3,
    repRange: "8-10",
    loadKg: 60,
    rirTarget: 2,
    restSeconds: 90,
    coachNote: null,
    userId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  }
}

function makeExercise(overrides?: Partial<SelectExercise>): SelectExercise {
  return {
    id: "ex-1",
    name: "Squat",
    movement: "squat",
    primaryMuscles: ["quads"],
    equipment: ["barbell"],
    ...overrides,
  }
}

function makeSessionExercise(
  plannedOverrides?: Partial<SelectPlannedExercise>,
  exerciseOverrides?: Partial<SelectExercise>
): SessionExercise {
  return {
    planned: makePlannedExercise(plannedOverrides),
    exercise: makeExercise(exerciseOverrides),
    priorPerformance: null,
  }
}

function makePersistedSet(
  overrides?: Partial<PersistedLoggedSet>
): PersistedLoggedSet {
  return {
    setLogId: "set-log-1",
    plannedExerciseId: "pe-1",
    setNumber: 1,
    weightKg: 60,
    reps: 8,
    rirActual: 2,
    loggedAt: new Date("2024-06-01T10:00:00Z"),
    ...overrides,
  }
}

function makeInitPayload(
  overrides?: Partial<SessionInitPayload>
): SessionInitPayload {
  return {
    workoutLogId: "wl-1",
    sessionTemplateId: "st-1",
    programName: "Test Program",
    exercises: [makeSessionExercise()],
    startedAt: new Date("2024-06-01T10:00:00Z"),
    persistedSets: [],
    ...overrides,
  }
}

function makeOnPersist(resolveWith = "server-id-1") {
  return vi.fn().mockResolvedValue(resolveWith)
}

function makeDeferredPersist() {
  let resolve!: (value: string) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    onPersist: vi.fn().mockImplementation(() => promise),
    resolve,
    reject,
  }
}

beforeEach(() => {
  useSessionStore.getState().reset()
})

describe("initSession", () => {
  it("seeds active-set inputs from the first missing prescribed set", () => {
    useSessionStore.getState().initSession(
      makeInitPayload({
        exercises: [
          makeSessionExercise({
            id: "pe-1",
            sets: 3,
            loadKg: 80,
            repRange: "6-8",
            rirTarget: 1,
          }),
        ],
        persistedSets: [
          makePersistedSet({
            plannedExerciseId: "pe-1",
            setNumber: 1,
          }),
        ],
      })
    )

    const state = useSessionStore.getState()
    expect(state.phase).toBe("active_set")
    expect(state.currentExerciseIndex).toBe(0)
    expect(state.currentSetNumber).toBe(2)
    expect(state.inputWeight).toBe(80)
    expect(state.inputReps).toBe(6)
    expect(state.inputRir).toBe(1)
  })

  it("deduplicates persisted sets by planned exercise and set number", () => {
    useSessionStore.getState().initSession(
      makeInitPayload({
        persistedSets: [
          makePersistedSet({
            setLogId: "older",
            reps: 7,
            loggedAt: new Date("2024-06-01T10:00:00Z"),
          }),
          makePersistedSet({
            setLogId: "newer",
            reps: 9,
            loggedAt: new Date("2024-06-01T10:05:00Z"),
          }),
        ],
      })
    )

    const [loggedSet] = useSessionStore.getState().loggedSets
    expect(useSessionStore.getState().loggedSets).toHaveLength(1)
    expect(loggedSet.serverSetLogId).toBe("newer")
    expect(loggedSet.reps).toBe(9)
    expect(loggedSet.syncStatus).toBe("saved")
  })

  it("resumes at the first gap in logged sets", () => {
    useSessionStore.getState().initSession(
      makeInitPayload({
        exercises: [
          makeSessionExercise({ id: "pe-1", sets: 3 }),
          makeSessionExercise(
            { id: "pe-2", exerciseId: "ex-2", orderIndex: 1, sets: 2 },
            { id: "ex-2", name: "Bench Press", movement: "push" }
          ),
        ],
        persistedSets: [
          makePersistedSet({ plannedExerciseId: "pe-1", setNumber: 1 }),
          makePersistedSet({
            setLogId: "set-log-2",
            plannedExerciseId: "pe-1",
            setNumber: 3,
            loggedAt: new Date("2024-06-01T10:01:00Z"),
          }),
        ],
      })
    )

    const state = useSessionStore.getState()
    expect(state.currentExerciseIndex).toBe(0)
    expect(state.currentSetNumber).toBe(2)
    expect(state.phase).toBe("active_set")
  })

  it("goes straight to session_complete when all prescribed sets are already saved", () => {
    useSessionStore.getState().initSession(
      makeInitPayload({
        exercises: [makeSessionExercise({ id: "pe-1", sets: 2 })],
        persistedSets: [
          makePersistedSet({ plannedExerciseId: "pe-1", setNumber: 1 }),
          makePersistedSet({
            setLogId: "set-log-2",
            plannedExerciseId: "pe-1",
            setNumber: 2,
            loggedAt: new Date("2024-06-01T10:01:00Z"),
          }),
        ],
      })
    )

    expect(useSessionStore.getState().phase).toBe("session_complete")
  })
})

describe("commitSet", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSessionStore.getState().initSession(makeInitPayload())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps non-final sets optimistic while syncing in the background", async () => {
    const deferred = makeDeferredPersist()
    const commitPromise = useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: deferred.onPersist,
    })

    const pendingState = useSessionStore.getState()
    expect(pendingState.phase).toBe("resting")
    expect(pendingState.isSubmitting).toBe(false)
    expect(pendingState.loggedSets[0].syncStatus).toBe("pending")

    deferred.resolve("srv-1")
    await commitPromise

    expect(useSessionStore.getState().loggedSets[0].syncStatus).toBe("saved")
  })

  it("waits for final-set persistence before entering session_complete", async () => {
    useSessionStore
      .getState()
      .initSession(
        makeInitPayload({ exercises: [makeSessionExercise({ sets: 1 })] })
      )

    const deferred = makeDeferredPersist()
    const commitPromise = useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: deferred.onPersist,
    })

    expect(useSessionStore.getState().phase).toBe("active_set")
    expect(useSessionStore.getState().isSubmitting).toBe(true)
    expect(useSessionStore.getState().loggedSets[0].syncStatus).toBe("pending")

    deferred.resolve("srv-final")
    await commitPromise

    const state = useSessionStore.getState()
    expect(state.phase).toBe("session_complete")
    expect(state.isSubmitting).toBe(false)
    expect(state.loggedSets[0].serverSetLogId).toBe("srv-final")
    expect(state.loggedSets[0].syncStatus).toBe("saved")
  })

  it("keeps the final set active and retryable when persistence fails", async () => {
    useSessionStore
      .getState()
      .initSession(
        makeInitPayload({ exercises: [makeSessionExercise({ sets: 1 })] })
      )

    const onPersist = vi.fn().mockRejectedValue(new Error("network"))
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist,
    })

    const state = useSessionStore.getState()
    expect(state.phase).toBe("active_set")
    expect(state.isSubmitting).toBe(false)
    expect(state.setSyncError).toMatch(/final set/i)
    expect(state.loggedSets).toHaveLength(1)
    expect(state.loggedSets[0].syncStatus).toBe("failed")
  })

  it("reuses a failed final-set entry instead of duplicating it on retry", async () => {
    useSessionStore
      .getState()
      .initSession(
        makeInitPayload({ exercises: [makeSessionExercise({ sets: 1 })] })
      )

    const failingPersist = vi.fn().mockRejectedValue(new Error("network"))
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: failingPersist,
    })

    await useSessionStore.getState().commitSet({
      weightKg: 62.5,
      reps: 9,
      rirActual: 1,
      onPersist: makeOnPersist("srv-retry"),
    })

    const state = useSessionStore.getState()
    expect(state.loggedSets).toHaveLength(1)
    expect(state.loggedSets[0]).toMatchObject({
      weightKg: 62.5,
      reps: 9,
      rirActual: 1,
      serverSetLogId: "srv-retry",
      syncStatus: "saved",
    })
    expect(state.phase).toBe("session_complete")
  })

  it("retries failed intermediate sets without duplicating them", async () => {
    const failingPersist = vi.fn().mockRejectedValue(new Error("network"))

    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: failingPersist,
    })

    expect(useSessionStore.getState().phase).toBe("resting")
    expect(useSessionStore.getState().loggedSets).toHaveLength(1)
    expect(useSessionStore.getState().loggedSets[0].syncStatus).toBe("failed")

    const retryResult = await useSessionStore.getState().retryUnsyncedSets({
      onPersist: makeOnPersist("srv-retried"),
    })

    expect(retryResult).toBe(true)
    expect(useSessionStore.getState().loggedSets).toHaveLength(1)
    expect(useSessionStore.getState().loggedSets[0]).toMatchObject({
      serverSetLogId: "srv-retried",
      syncStatus: "saved",
    })
  })
})

describe("timer controls", () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    useSessionStore.getState().initSession(makeInitPayload())
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("advances the timer toward the next active set", () => {
    useSessionStore.getState().tickTimer()
    expect(useSessionStore.getState().restSecondsRemaining).toBe(89)
  })

  it("skipRest clears the interval and advances to the next set", () => {
    useSessionStore.getState().skipRest()
    const state = useSessionStore.getState()
    expect(state.restIntervalId).toBeNull()
    expect(state.phase).toBe("active_set")
    expect(state.currentSetNumber).toBe(2)
  })
})

describe("reset", () => {
  it("returns state to the empty defaults", async () => {
    useSessionStore.getState().initSession(makeInitPayload())
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })

    useSessionStore.getState().reset()

    const state = useSessionStore.getState()
    expect(state.workoutLogId).toBe("")
    expect(state.loggedSets).toHaveLength(0)
    expect(state.phase).toBe("active_set")
    expect(state.currentExerciseIndex).toBe(0)
    expect(state.currentSetNumber).toBe(1)
    expect(state.isSubmitting).toBe(false)
    expect(state.setSyncError).toBeNull()
  })
})
