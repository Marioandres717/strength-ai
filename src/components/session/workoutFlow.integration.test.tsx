import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import type * as TanStackRouter from "@tanstack/react-router"
import type * as SaveFeedbackModule from "../../functions/saveFeedback"
import { plannedExercise, setLog, workoutLog } from "../../../lib/schema"
import {
  completeSessionOperation,
  type CompleteSessionInput,
  type CompleteSessionResult,
} from "../../functions/completeSession.server"
import { getSessionDataOperation } from "../../functions/getSessionData"
import {
  logSetOperation,
  type LogSetInput,
  type LogSetResult,
} from "../../functions/logSet.server"
import {
  saveFeedbackInputSchema,
  saveFeedbackOperation,
  type SaveFeedbackInput,
} from "../../functions/saveFeedback"
import { fireEvent, render, screen, waitFor } from "../../test/utils"
import { createWorkoutTestDb } from "../../test/workoutDb"
import { FeedbackPage } from "../feedback/FeedbackPage"
import { SessionPage } from "./SessionPage"

const {
  mockNavigate,
  mockLogSetFn,
  mockCompleteSessionFn,
  mockSaveFeedbackFn,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogSetFn: vi.fn(),
  mockCompleteSessionFn: vi.fn(),
  mockSaveFeedbackFn: vi.fn(),
}))

let activeDb: ReturnType<typeof createWorkoutTestDb> | null = null
let lastCompletionResult: CompleteSessionResult | null = null

interface LogSetFnCall {
  data: Omit<LogSetInput, "loggedAt"> & { loggedAt: string }
}

interface CompleteSessionFnCall {
  data: CompleteSessionInput
}

interface SaveFeedbackFnCall {
  data: SaveFeedbackInput
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../../functions/logSet", () => ({
  logSetFn: mockLogSetFn,
}))

vi.mock("../../functions/completeSession", () => ({
  completeSessionFn: mockCompleteSessionFn,
}))

vi.mock("../../functions/saveFeedback", async (importOriginal) => {
  const actual = await importOriginal<typeof SaveFeedbackModule>()

  return {
    ...actual,
    saveFeedbackFn: mockSaveFeedbackFn,
  }
})

function requireActiveDb() {
  if (!activeDb) {
    throw new Error("Active DB context missing.")
  }

  return activeDb
}

function makeContext() {
  const context = createWorkoutTestDb()
  activeDb = context
  return context
}

function seedWorkoutFlow(context: ReturnType<typeof createWorkoutTestDb>) {
  const program = context.insertProgram()
  const currentSession = context.insertSessionTemplate({
    programId: program.id,
    weekNumber: 1,
    dayLabel: "Lower A",
  })
  const futureSession = context.insertSessionTemplate({
    programId: program.id,
    weekNumber: 2,
    dayLabel: "Lower B",
  })
  const exercise = context.insertExercise({ name: "Back Squat" })
  const currentPlanned = context.insertPlannedExercise({
    sessionTemplateId: currentSession.id,
    exerciseId: exercise.id,
    orderIndex: 0,
    sets: 2,
    repRange: "5-5",
    loadKg: 100,
    rirTarget: 2,
    restSeconds: 60,
  })
  const futurePlanned = context.insertPlannedExercise({
    sessionTemplateId: futureSession.id,
    exerciseId: exercise.id,
    orderIndex: 0,
    sets: 2,
    repRange: "5-5",
    loadKg: 100,
    rirTarget: 2,
    restSeconds: 60,
  })

  return {
    currentSession,
    currentPlanned,
    futurePlanned,
  }
}

function toLogSetInput(call: LogSetFnCall): LogSetInput {
  return {
    ...call.data,
    loggedAt: new Date(call.data.loggedAt),
  }
}

async function renderSession(sessionTemplateId: string) {
  const loaderData = await getSessionDataOperation(
    requireActiveDb().db,
    sessionTemplateId
  )

  return render(<SessionPage loaderData={loaderData} />)
}

function renderFeedback(workoutLogId: string, sessionName: string) {
  if (!lastCompletionResult) {
    throw new Error("Completion result missing.")
  }

  return render(
    <FeedbackPage
      workoutLogId={workoutLogId}
      sessionName={sessionName}
      progressionChanges={lastCompletionResult.progressionChanges}
    />
  )
}

function assertUniqueCompositeSetRows(
  rows: { plannedExerciseId: string; setNumber: number }[]
) {
  const compositeKeys = new Set(
    rows.map((row) => `${row.plannedExerciseId}:${row.setNumber}`)
  )
  expect(compositeKeys.size).toBe(rows.length)
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockLogSetFn.mockReset()
  mockCompleteSessionFn.mockReset()
  mockSaveFeedbackFn.mockReset()
  lastCompletionResult = null

  mockLogSetFn.mockImplementation(
    (call: LogSetFnCall): Promise<LogSetResult> =>
      Promise.resolve(
        logSetOperation(requireActiveDb().db, toLogSetInput(call))
      )
  )

  mockCompleteSessionFn.mockImplementation(
    (call: CompleteSessionFnCall): Promise<CompleteSessionResult> => {
      const result = completeSessionOperation(requireActiveDb().db, call.data)
      lastCompletionResult = result
      return Promise.resolve(result)
    }
  )

  mockSaveFeedbackFn.mockImplementation(
    (call: SaveFeedbackFnCall): Promise<{ ok: boolean }> =>
      saveFeedbackOperation(
        requireActiveDb().db,
        saveFeedbackInputSchema.parse(call.data)
      )
  )
})

afterEach(() => {
  activeDb?.close()
  activeDb = null
})

describe("workout flow integration", () => {
  it("covers session execution, refresh resume, completion ordering, and feedback persistence", async () => {
    const context = makeContext()
    const flow = seedWorkoutFlow(context)
    let view = await renderSession(flow.currentSession.id)

    fireEvent.click(screen.getByRole("button", { name: "Complete Set & Rest" }))
    await waitFor(() => expect(mockLogSetFn).toHaveBeenCalledTimes(1))

    view.unmount()

    let finalSetResolve!: (value: LogSetResult) => void
    const finalSetPromise = new Promise<LogSetResult>((resolve) => {
      finalSetResolve = resolve
    })

    mockLogSetFn.mockImplementationOnce((call: LogSetFnCall) =>
      Promise.resolve(logSetOperation(context.db, toLogSetInput(call)))
    )
    mockLogSetFn.mockImplementationOnce(
      (_call: LogSetFnCall): Promise<LogSetResult> => finalSetPromise
    )

    view = await renderSession(flow.currentSession.id)
    expect(
      screen.getByRole("button", { name: "Complete Workout" })
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Complete Workout" }))
    expect(mockCompleteSessionFn).not.toHaveBeenCalled()

    const resumedWorkout = context.db
      .select({ id: workoutLog.id })
      .from(workoutLog)
      .where(eq(workoutLog.sessionTemplateId, flow.currentSession.id))
      .all()[0]

    if (!resumedWorkout) {
      throw new Error("Expected resumed workout log.")
    }

    finalSetResolve(
      logSetOperation(context.db, {
        workoutLogId: resumedWorkout.id,
        plannedExerciseId: flow.currentPlanned.id,
        setNumber: 2,
        weightKg: 100,
        reps: 5,
        rirActual: 2,
        loggedAt: new Date("2024-06-01T10:20:00Z"),
      })
    )

    await waitFor(() => expect(mockCompleteSessionFn).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/feedback/$id",
        params: { id: resumedWorkout.id },
      })
    )

    const savedWorkoutId = lastCompletionResult?.workoutLogId
    if (!savedWorkoutId) {
      throw new Error("Workout ID missing after completion.")
    }

    view.unmount()
    renderFeedback(savedWorkoutId, flow.currentSession.dayLabel)

    fireEvent.change(screen.getByRole("textbox", { name: "Training Notes" }), {
      target: { value: "  Strong session  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save & Finish" }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/" }))

    const setRows = context.db.select().from(setLog).all()
    expect(setRows).toHaveLength(2)
    assertUniqueCompositeSetRows(setRows)

    const savedWorkout = context.db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.id, savedWorkoutId))
      .all()[0]
    expect(savedWorkout.completedAt).not.toBeNull()
    expect(savedWorkout.fatigueRating).toBe(3)
    expect(savedWorkout.notes).toBe("Strong session")

    const progressedExercise = context.db
      .select({ loadKg: plannedExercise.loadKg })
      .from(plannedExercise)
      .where(eq(plannedExercise.id, flow.futurePlanned.id))
      .all()[0]
    expect(progressedExercise.loadKg).toBe(102.5)
  })

  it("retries a rejected set write without duplicate rows or premature completion", async () => {
    const context = makeContext()
    const flow = seedWorkoutFlow(context)
    let shouldRejectFirstSet = true

    mockLogSetFn.mockImplementation(
      (call: LogSetFnCall): Promise<LogSetResult> => {
        if (call.data.setNumber === 1 && shouldRejectFirstSet) {
          shouldRejectFirstSet = false
          return Promise.reject(new Error("set write failed"))
        }

        return Promise.resolve(
          logSetOperation(requireActiveDb().db, toLogSetInput(call))
        )
      }
    )

    await renderSession(flow.currentSession.id)

    fireEvent.click(screen.getByRole("button", { name: "Complete Set & Rest" }))
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    fireEvent.click(screen.getByRole("button", { name: "Complete Workout" }))

    expect(mockCompleteSessionFn).not.toHaveBeenCalled()
    expect(
      await screen.findByRole("button", { name: "Retry set sync" })
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Retry set sync" }))
    await waitFor(() => expect(mockCompleteSessionFn).toHaveBeenCalledTimes(1))

    const setRows = context.db.select().from(setLog).all()
    expect(setRows).toHaveLength(2)
    assertUniqueCompositeSetRows(setRows)
  })

  it("allows a failed completion call to be retried without duplicate progression", async () => {
    const context = makeContext()
    const flow = seedWorkoutFlow(context)
    let shouldRejectCompletion = true

    mockCompleteSessionFn.mockImplementation(
      (call: CompleteSessionFnCall): Promise<CompleteSessionResult> => {
        if (shouldRejectCompletion) {
          shouldRejectCompletion = false
          return Promise.reject(new Error("completion failed"))
        }

        const result = completeSessionOperation(requireActiveDb().db, call.data)
        lastCompletionResult = result
        return Promise.resolve(result)
      }
    )

    await renderSession(flow.currentSession.id)

    fireEvent.click(screen.getByRole("button", { name: "Complete Set & Rest" }))
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    fireEvent.click(screen.getByRole("button", { name: "Complete Workout" }))

    expect(
      await screen.findByRole("button", { name: "Retry completion" })
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Retry completion" }))
    await waitFor(() => expect(mockCompleteSessionFn).toHaveBeenCalledTimes(2))

    const completedWorkout = context.db
      .select()
      .from(workoutLog)
      .where(eq(workoutLog.sessionTemplateId, flow.currentSession.id))
      .all()[0]
    expect(completedWorkout.completedAt).not.toBeNull()

    const progressedExercise = context.db
      .select({ loadKg: plannedExercise.loadKg })
      .from(plannedExercise)
      .where(eq(plannedExercise.id, flow.futurePlanned.id))
      .all()[0]
    expect(progressedExercise.loadKg).toBe(102.5)
  })
})
