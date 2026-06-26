import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useSessionStore } from "./sessionStore"
import type { SessionExercise, SessionInitPayload } from "./sessionStore"
import type { SelectExercise, SelectPlannedExercise } from "../../lib/schema"

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

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
    createdAt: new Date("2024-01-01"),
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

function makeInitPayload(
  overrides?: Partial<SessionInitPayload>
): SessionInitPayload {
  return {
    workoutLogId: "wl-1",
    sessionTemplateId: "st-1",
    programName: "Test Program",
    exercises: [makeSessionExercise()],
    startedAt: new Date("2024-06-01T10:00:00Z"),
    ...overrides,
  }
}

function makeOnPersist(resolveWith = "server-id-1") {
  return vi.fn().mockResolvedValue(resolveWith)
}

// ---------------------------------------------------------------------------
// Global reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  useSessionStore.getState().reset()
})

// ---------------------------------------------------------------------------
// initSession
// ---------------------------------------------------------------------------

describe("initSession", () => {
  it("seeds inputWeight, inputReps, inputRir from first exercise", () => {
    useSessionStore.getState().initSession(
      makeInitPayload({
        exercises: [
          makeSessionExercise({ loadKg: 80, repRange: "6-8", rirTarget: 1 }),
        ],
      })
    )
    const s = useSessionStore.getState()
    expect(s.inputWeight).toBe(80)
    expect(s.inputReps).toBe(6)
    expect(s.inputRir).toBe(1)
  })

  it("sets phase to active_set", () => {
    useSessionStore.getState().initSession(makeInitPayload())
    expect(useSessionStore.getState().phase).toBe("active_set")
  })

  it("sets workoutLogId, sessionTemplateId, programName from payload", () => {
    useSessionStore.getState().initSession(makeInitPayload())
    const s = useSessionStore.getState()
    expect(s.workoutLogId).toBe("wl-1")
    expect(s.sessionTemplateId).toBe("st-1")
    expect(s.programName).toBe("Test Program")
  })

  it("sets currentExerciseIndex to 0 and currentSetNumber to 1", () => {
    useSessionStore.getState().initSession(makeInitPayload())
    const s = useSessionStore.getState()
    expect(s.currentExerciseIndex).toBe(0)
    expect(s.currentSetNumber).toBe(1)
  })

  it("clears previous loggedSets when called a second time", async () => {
    useSessionStore.getState().initSession(makeInitPayload())
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    expect(useSessionStore.getState().loggedSets).toHaveLength(1)

    useSessionStore.getState().initSession(makeInitPayload())
    expect(useSessionStore.getState().loggedSets).toHaveLength(0)
  })

  it("falls back to inputReps = 8 when repRange is unparseable", () => {
    useSessionStore.getState().initSession(
      makeInitPayload({
        exercises: [makeSessionExercise({ repRange: "invalid" })],
      })
    )
    expect(useSessionStore.getState().inputReps).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// Input setters
// ---------------------------------------------------------------------------

describe("input setters", () => {
  it("setInputWeight clamps negative to 0", () => {
    useSessionStore.getState().setInputWeight(-5)
    expect(useSessionStore.getState().inputWeight).toBe(0)
  })

  it("setInputWeight allows positive value", () => {
    useSessionStore.getState().setInputWeight(100)
    expect(useSessionStore.getState().inputWeight).toBe(100)
  })

  it("setInputReps clamps below 1 to 1", () => {
    useSessionStore.getState().setInputReps(0)
    expect(useSessionStore.getState().inputReps).toBe(1)
  })

  it("setInputReps clamps above 100 to 100", () => {
    useSessionStore.getState().setInputReps(200)
    expect(useSessionStore.getState().inputReps).toBe(100)
  })

  it("setInputReps accepts values within range", () => {
    useSessionStore.getState().setInputReps(10)
    expect(useSessionStore.getState().inputReps).toBe(10)
  })

  it("setInputRir clamps below 0 to 0", () => {
    useSessionStore.getState().setInputRir(-1)
    expect(useSessionStore.getState().inputRir).toBe(0)
  })

  it("setInputRir clamps above 10 to 10", () => {
    useSessionStore.getState().setInputRir(15)
    expect(useSessionStore.getState().inputRir).toBe(10)
  })

  it("setInputRir accepts values within range", () => {
    useSessionStore.getState().setInputRir(3)
    expect(useSessionStore.getState().inputRir).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// commitSet
// ---------------------------------------------------------------------------

describe("commitSet", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSessionStore.getState().initSession(makeInitPayload())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("fills serverSetLogId after onPersist resolves", async () => {
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist("srv-42"),
    })
    const { loggedSets } = useSessionStore.getState()
    expect(loggedSets).toHaveLength(1)
    expect(loggedSets[0].serverSetLogId).toBe("srv-42")
  })

  it("leaves serverSetLogId = null when onPersist rejects", async () => {
    const onPersist = vi.fn().mockRejectedValue(new Error("network"))
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist,
    })
    expect(useSessionStore.getState().loggedSets[0].serverSetLogId).toBeNull()
  })

  it("sets phase to resting with correct timer values when not last set", async () => {
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    const s = useSessionStore.getState()
    expect(s.phase).toBe("resting")
    expect(s.restSecondsRemaining).toBe(90)
    expect(s.restSecondsTotal).toBe(90)
    expect(s.restIntervalId).not.toBeNull()
  })

  it("sets phase to session_complete when last set of last exercise", async () => {
    useSessionStore
      .getState()
      .initSession(
        makeInitPayload({ exercises: [makeSessionExercise({ sets: 1 })] })
      )
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    const s = useSessionStore.getState()
    expect(s.phase).toBe("session_complete")
    expect(s.restIntervalId).toBeNull()
  })

  /*it("isSubmitting guard: call is a no-op when isSubmitting is true", () => {
    useSessionStore.setState({ isSubmitting: true })
    const onPersist = makeOnPersist()
    useSessionStore.getState().commitSet({ weightKg: 60, reps: 8, rirActual: 2, onPersist })
    expect(onPersist).not.toHaveBeenCalled()
  })*/

  it("isSubmitting is false after commitSet resolves", async () => {
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    expect(useSessionStore.getState().isSubmitting).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// tickTimer
// ---------------------------------------------------------------------------

describe("tickTimer", () => {
  async function enterRestingPhase(
    plannedOverrides?: Partial<SelectPlannedExercise>
  ) {
    useSessionStore.getState().initSession(
      makeInitPayload({
        exercises: [makeSessionExercise({ sets: 3, ...plannedOverrides })],
      })
    )
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("decrements restSecondsRemaining by 1 per call", async () => {
    await enterRestingPhase()
    useSessionStore.getState().tickTimer()
    expect(useSessionStore.getState().restSecondsRemaining).toBe(89)
  })

  it("reaching 0 clears interval, sets phase to active_set, advances set number", async () => {
    await enterRestingPhase({ restSeconds: 2 })
    useSessionStore.getState().tickTimer()
    useSessionStore.getState().tickTimer()
    const s = useSessionStore.getState()
    expect(s.restSecondsRemaining).toBe(0)
    expect(s.restIntervalId).toBeNull()
    expect(s.phase).toBe("active_set")
    expect(s.currentSetNumber).toBe(2)
  })

  it("is a no-op when phase is not resting", () => {
    useSessionStore.getState().initSession(makeInitPayload())
    useSessionStore.getState().tickTimer()
    expect(useSessionStore.getState().restSecondsRemaining).toBe(0)
  })

  it("advances to next exercise when last set of exercise completes rest", async () => {
    const ex1 = makeSessionExercise(
      {
        id: "pe-1",
        exerciseId: "ex-1",
        sets: 1,
        restSeconds: 1,
        loadKg: 60,
        repRange: "8-10",
        rirTarget: 2,
      },
      { id: "ex-1", name: "Squat" }
    )
    const ex2 = makeSessionExercise(
      {
        id: "pe-2",
        exerciseId: "ex-2",
        sets: 3,
        restSeconds: 90,
        loadKg: 40,
        repRange: "10-12",
        rirTarget: 1,
      },
      { id: "ex-2", name: "Leg Press" }
    )
    useSessionStore
      .getState()
      .initSession(makeInitPayload({ exercises: [ex1, ex2] }))
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    useSessionStore.getState().tickTimer()
    const s = useSessionStore.getState()
    expect(s.currentExerciseIndex).toBe(1)
    expect(s.currentSetNumber).toBe(1)
    expect(s.phase).toBe("active_set")
    // inputs seeded from ex2
    expect(s.inputWeight).toBe(40)
    expect(s.inputReps).toBe(10)
    expect(s.inputRir).toBe(1)
  })

  it("interval wiring: advancing time fires tickTimer via setInterval", async () => {
    await enterRestingPhase({ restSeconds: 90 })
    vi.advanceTimersByTime(3000)
    expect(useSessionStore.getState().restSecondsRemaining).toBe(87)
  })
})

// ---------------------------------------------------------------------------
// adjustTimer
// ---------------------------------------------------------------------------

describe("adjustTimer", () => {
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

  it("increases restSecondsRemaining by positive delta", () => {
    useSessionStore.getState().adjustTimer(30)
    expect(useSessionStore.getState().restSecondsRemaining).toBe(120)
  })

  it("decreases restSecondsRemaining by negative delta", () => {
    useSessionStore.getState().adjustTimer(-30)
    expect(useSessionStore.getState().restSecondsRemaining).toBe(60)
  })

  it("clamps lower bound to 0", () => {
    useSessionStore.getState().adjustTimer(-9999)
    expect(useSessionStore.getState().restSecondsRemaining).toBe(0)
  })

  it("clamps upper bound to restSecondsTotal + 120", () => {
    useSessionStore.getState().adjustTimer(9999)
    expect(useSessionStore.getState().restSecondsRemaining).toBe(90 + 120)
  })
})

// ---------------------------------------------------------------------------
// skipRest
// ---------------------------------------------------------------------------

describe("skipRest", () => {
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

  it("clears interval, sets phase to active_set, advances currentSetNumber", () => {
    useSessionStore.getState().skipRest()
    const s = useSessionStore.getState()
    expect(s.restIntervalId).toBeNull()
    expect(s.phase).toBe("active_set")
    expect(s.currentSetNumber).toBe(2)
  })

  it("is a no-op when phase is not resting", () => {
    useSessionStore.getState().skipRest()
    useSessionStore.getState().skipRest()
    // second call while active_set should not change currentSetNumber further
    expect(useSessionStore.getState().currentSetNumber).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("returns all state to empty defaults", async () => {
    useSessionStore.getState().initSession(makeInitPayload())
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    useSessionStore.getState().reset()
    const s = useSessionStore.getState()
    expect(s.workoutLogId).toBe("")
    expect(s.loggedSets).toHaveLength(0)
    expect(s.phase).toBe("active_set")
    expect(s.currentExerciseIndex).toBe(0)
    expect(s.currentSetNumber).toBe(1)
    expect(s.isSubmitting).toBe(false)
  })

  it("clears a running rest interval", async () => {
    vi.useFakeTimers()
    useSessionStore.getState().initSession(makeInitPayload())
    await useSessionStore.getState().commitSet({
      weightKg: 60,
      reps: 8,
      rirActual: 2,
      onPersist: makeOnPersist(),
    })
    expect(useSessionStore.getState().restIntervalId).not.toBeNull()
    useSessionStore.getState().reset()
    expect(useSessionStore.getState().restIntervalId).toBeNull()
    vi.useRealTimers()
  })
})
