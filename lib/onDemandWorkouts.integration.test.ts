import type * as AnthropicModule from "@anthropic-ai/sdk"
import { getFeedbackDataOperation } from "../src/functions/getFeedbackData"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { createWorkoutTestDb } from "../src/test/workoutDb"
import {
  generateOnDemandWorkoutOperation,
  buildGenerationContext,
  getOnDemandWorkoutGenerationOperation,
  listOnDemandWorkoutGenerationsOperation,
  reconcileOnDemandWorkoutGenerations,
  retryOnDemandWorkoutSaveOperation,
} from "./onDemandWorkoutGeneration.server"
import {
  deleteOnDemandWorkoutOperation,
  editOnDemandWorkoutOperation,
  getWorkoutRunOperation,
  getOnDemandWorkoutOperation,
  listOnDemandWorkoutsOperation,
  startWorkoutOperation,
} from "./onDemandWorkouts.server"
import { completeSessionOperation } from "../src/functions/completeSession.server"
import { logSetOperation } from "../src/functions/logSet.server"
import { saveFeedbackOperation } from "../src/functions/saveFeedback"
import {
  onDemandWorkout,
  onDemandWorkoutGenerationRequest,
  onDemandWorkoutRevision,
  plannedExercise,
  program,
  sessionTemplate,
  setLog,
  workoutLog,
  userProfile,
} from "./schema"
import { workoutHistory } from "./workoutHistory.server"

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof AnthropicModule>()
  return {
    ...actual,
    default: class {
      messages = { parse }
    },
  }
})
let context: ReturnType<typeof createWorkoutTestDb>, directory: string
beforeEach(() => {
  context = createWorkoutTestDb()
  directory = mkdtempSync(join(tmpdir(), "strength-generation-"))
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
  parse.mockReset()
})
afterEach(() => {
  context.close()
  rmSync(directory, { recursive: true, force: true })
  vi.unstubAllEnvs()
})
function input() {
  return {
    requestId: crypto.randomUUID(),
    prompt: "30 min barbell workout",
    timeMinutes: 30,
    equipment: ["barbell"],
    experience: "beginner" as const,
  }
}
function output(exerciseId: string) {
  return {
    status: "workout",
    title: "Independent strength",
    focus: "mixed",
    reasoning: "A conservative session for today.",
    resolvedConstraints: {
      timeMinutes: 30,
      equipment: ["barbell"],
      focus: "mixed",
      energy: null,
      soreness: null,
    },
    estimatedDurationSeconds: 1,
    exercises: [
      {
        exerciseId,
        sets: 1,
        repRange: "8-12",
        loadKg: 500,
        rirTarget: 2,
        restSeconds: 60,
        coachNote: "Controlled repetitions.",
      },
    ],
  }
}
async function generate() {
  const ex = context.insertExercise({ name: "Back Squat" })
  parse.mockResolvedValue({ parsed_output: { result: output(ex.id) } })
  const request = input()
  const result = await generateOnDemandWorkoutOperation(
    context.db,
    request,
    directory
  )
  if (result.status !== "saved" || !result.preview)
    throw new Error(JSON.stringify(result))
  return { result, request, preview: result.preview, ex }
}

describe("generation with real SQLite and the Anthropic boundary", () => {
  it("uses explicit experience and units and keeps preview units after profile changes", async () => {
    context.db
      .insert(userProfile)
      .values({
        id: "profile",
        goal: "both",
        experience: "advanced",
        equipment: ["barbell"],
        sessionsPerWeek: 3,
        sessionLengthMin: 60,
        units: "kg",
      })
      .run()
    const ex = context.insertExercise({ name: "Back Squat" })
    const request = {
      ...input(),
      experience: "beginner" as const,
      units: "lbs" as const,
    }
    expect(buildGenerationContext(context.db, request).profile).toMatchObject({
      experience: "beginner",
      units: "lbs",
    })
    parse.mockResolvedValue({ parsed_output: { result: output(ex.id) } })
    const result = await generateOnDemandWorkoutOperation(
      context.db,
      request,
      directory
    )
    expect(result.status).toBe("saved")
    if (result.status !== "saved") throw new Error("Generation failed")
    expect(result.preview?.units).toBe("lbs")
    context.db.update(userProfile).set({ units: "kg" }).run()
    expect(
      getOnDemandWorkoutOperation(context.db, result.onDemandWorkoutId).snapshot
        .units
    ).toBe("lbs")
  })
  it("makes one explicit Sonnet attempt, saves immediately, clamps loads and replays by request ID", async () => {
    vi.stubEnv("AI_PROVIDER", "openai")
    vi.stubEnv("ANTHROPIC_MODEL", "other-model")
    const { request, result, preview } = await generate()
    expect(parse).toHaveBeenCalledTimes(1)
    const [parameters, options] = parse.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ]
    expect(parameters.model).toBe("claude-sonnet-4-6")
    expect(parameters.max_tokens).toBe(4096)
    expect(JSON.stringify(parameters.output_config)).toContain(
      '"type":"json_schema"'
    )
    expect(options).toEqual({ maxRetries: 0, timeout: 90000 })
    expect(preview.exercises[0].prescription.loadKg).toBe(20)
    expect(preview.estimatedDurationSeconds).toBe(348)
    expect(context.db.select().from(program).all()).toEqual([])
    expect(context.db.select().from(sessionTemplate).all()).toEqual([])
    expect(
      await generateOnDemandWorkoutOperation(context.db, request, directory)
    ).toMatchObject({
      status: "saved",
      onDemandWorkoutId: result.onDemandWorkoutId,
    })
    expect(
      await generateOnDemandWorkoutOperation(
        context.db,
        { ...request, prompt: "different" },
        directory
      )
    ).toMatchObject({ status: "failed", code: "CONFLICT" })
    expect(
      retryOnDemandWorkoutSaveOperation(
        context.db,
        request.requestId,
        directory
      ).status
    ).toBe("saved")
    expect(listOnDemandWorkoutGenerationsOperation(context.db)).toHaveLength(1)
    expect(
      listOnDemandWorkoutsOperation(context.db).items[0].timesCompleted
    ).toBe(0)
    expect(parse).toHaveBeenCalledTimes(1)
  })
  it("rejects unknown IDs and excessive duration without publishing a definition or retrying", async () => {
    const ex = context.insertExercise()
    const invalid = output(ex.id)
    invalid.exercises[0].exerciseId = "invented"
    parse.mockResolvedValue({ parsed_output: { result: invalid } })
    expect(
      (await generateOnDemandWorkoutOperation(context.db, input(), directory))
        .status
    ).toBe("failed")
    const long = output(ex.id)
    long.exercises[0] = {
      ...long.exercises[0],
      sets: 10,
      repRange: "90-100",
      restSeconds: 600,
    }
    parse.mockResolvedValue({ parsed_output: { result: long } })
    expect(
      await generateOnDemandWorkoutOperation(context.db, input(), directory)
    ).toMatchObject({
      status: "failed",
      code: "DURATION",
      attemptConsumed: true,
    })
    expect(context.db.select().from(onDemandWorkout).all()).toEqual([])
    expect(parse).toHaveBeenCalledTimes(2)
  })
  it("recovers a database save failure from the durable receipt without another provider call", async () => {
    const ex = context.insertExercise()
    parse.mockResolvedValue({ parsed_output: { result: output(ex.id) } })
    context.sqlite.exec(
      "CREATE TRIGGER simulate_disk_failure BEFORE INSERT ON on_demand_workout BEGIN SELECT RAISE(FAIL, 'database locked'); END"
    )
    const request = input()
    expect(
      await generateOnDemandWorkoutOperation(context.db, request, directory)
    ).toMatchObject({ status: "save_pending" })
    context.sqlite.exec("DROP TRIGGER simulate_disk_failure")
    expect(
      retryOnDemandWorkoutSaveOperation(
        context.db,
        request.requestId,
        directory
      ).status
    ).toBe("saved")
    expect(context.db.select().from(onDemandWorkout).all()).toHaveLength(1)
    reconcileOnDemandWorkoutGenerations(context.db, directory)
    expect(
      getOnDemandWorkoutGenerationOperation(context.db, request.requestId)
        .status
    ).toBe("saved")
    expect(parse).toHaveBeenCalledTimes(1)
  })
  it("enforces dispatched quota across failed requests and preserves unknown outcomes on restart", async () => {
    context.insertExercise()
    parse.mockRejectedValue(new Error("timeout"))
    for (let i = 0; i < 5; i++)
      expect(
        (await generateOnDemandWorkoutOperation(context.db, input(), directory))
          .status
      ).toBe("failed")
    expect(
      await generateOnDemandWorkoutOperation(context.db, input(), directory)
    ).toMatchObject({ status: "failed", code: "DAILY_CAP" })
    expect(parse).toHaveBeenCalledTimes(5)
    const row = context.db
      .select()
      .from(onDemandWorkoutGenerationRequest)
      .get()!
    context.db
      .update(onDemandWorkoutGenerationRequest)
      .set({ status: "calling" })
      .where(eq(onDemandWorkoutGenerationRequest.id, row.id))
      .run()
    reconcileOnDemandWorkoutGenerations(context.db, directory)
    expect(
      getOnDemandWorkoutGenerationOperation(context.db, row.id).status
    ).toBe("unknown")
  })
})

describe("immutable runs and program isolation", () => {
  it("pins snapshots, retries committed sets after completion, preserves deleted history and never changes a program", async () => {
    const { preview, ex } = await generate()
    const prog = context.insertProgram({ userId: null })
    const template = context.insertSessionTemplate({
      programId: prog.id,
      weekNumber: 4,
      userId: null,
    })
    context.insertPlannedExercise({
      sessionTemplateId: template.id,
      exerciseId: ex.id,
      userId: null,
    })
    const before = {
      programs: context.db.select().from(program).all(),
      templates: context.db.select().from(sessionTemplate).all(),
      exercises: context.db.select().from(plannedExercise).all(),
    }
    const startedAt = new Date(Date.now() - 60_000).toISOString(),
      id = crypto.randomUUID()
    const data = {
      workoutLogId: id,
      startedAt,
      intent: "start" as const,
      source: {
        kind: "on_demand_workout" as const,
        onDemandWorkoutId: preview.id,
        onDemandWorkoutRevisionId: preview.revisionId,
      },
      onDemandWorkoutRunSnapshot: preview.snapshot,
    }
    expect(startWorkoutOperation(context.db, data).workoutLogId).toBe(id)
    expect(startWorkoutOperation(context.db, data).workoutLogId).toBe(id)
    expect(() =>
      completeSessionOperation(context.db, { workoutLogId: id })
    ).toThrow(/incomplete/)
    const set = {
      workoutLogId: id,
      prescriptionRef: preview.exercises[0].prescription.ref,
      setNumber: 1,
      weightKg: 100,
      reps: 12,
      rirActual: 5,
      loggedAt: new Date(Date.now() - 30_000),
    }
    const saved = logSetOperation(context.db, set)
    const completedAt = new Date(Date.now() - 20_000)
    expect(
      completeSessionOperation(context.db, { workoutLogId: id, completedAt })
        .progressionChanges
    ).toEqual([])
    expect(logSetOperation(context.db, set)).toEqual({
      setLogId: saved.setLogId,
      alreadyExisted: true,
    })
    expect(() => logSetOperation(context.db, { ...set, reps: 13 })).toThrow(
      /conflict/
    )
    await saveFeedbackOperation(context.db, {
      workoutLogId: id,
      fatigueRating: 5,
      notes: "Very tired",
    })
    expect({
      programs: context.db.select().from(program).all(),
      templates: context.db.select().from(sessionTemplate).all(),
      exercises: context.db.select().from(plannedExercise).all(),
    }).toEqual(before)
    expect(workoutHistory(context.db).latest.get(ex.id)?.sets[0].weightKg).toBe(
      100
    )
    expect(workoutHistory(context.db).recent[0].fatigue).toBe(5)
    expect(
      (await getFeedbackDataOperation(context.db, { workoutLogId: id }))
        .progressionChanges
    ).toEqual([])
    deleteOnDemandWorkoutOperation(context.db, preview.id)
    expect(listOnDemandWorkoutsOperation(context.db).items).toHaveLength(0)
    expect(getWorkoutRunOperation(context.db, id).snapshot).toEqual(
      preview.snapshot
    )
    expect(() =>
      startWorkoutOperation(context.db, {
        ...data,
        workoutLogId: crypto.randomUUID(),
      })
    ).toThrow(/unavailable/)
    const offline = startWorkoutOperation(context.db, {
      ...data,
      workoutLogId: crypto.randomUUID(),
      intent: "offline_replay",
    })
    expect(offline.source.kind).toBe("on_demand_workout")
    expect(context.db.select().from(setLog).all()).toHaveLength(1)
    expect(
      context.db.select().from(workoutLog).all()[0].completedAt?.getTime()
    ).toBe(Math.floor(completedAt.getTime() / 1000) * 1000)
  })
  it("creates fresh revisions for swaps, rejects stale edits and retains the original run prescription", async () => {
    const { preview } = await generate()
    const replacement = context.insertExercise({
      name: "Front Squat",
      movement: "squat",
      primaryMuscles: ["quads"],
    })
    const fresh = (
      await import("./onDemandWorkouts.server")
    ).getOnDemandWorkoutOperation(context.db, preview.id)
    const action = {
      kind: "swap" as const,
      onDemandWorkoutExerciseId:
        preview.snapshot.exercises[0].onDemandWorkoutExerciseId,
      replacementExerciseId: replacement.id,
    }
    const result = editOnDemandWorkoutOperation(context.db, {
      onDemandWorkoutId: preview.id,
      expectedRevisionId: preview.revisionId,
      action,
    })
    // Alternatives stay constrained to relevant movement/muscles.
    expect(
      fresh.alternatives[
        preview.snapshot.exercises[0].onDemandWorkoutExerciseId
      ]
    ).toBeDefined()
    expect(result.preview.revisionNumber).toBe(2)
    expect(
      context.db.select().from(onDemandWorkoutRevision).all()
    ).toHaveLength(2)
    expect(
      editOnDemandWorkoutOperation(context.db, {
        onDemandWorkoutId: preview.id,
        expectedRevisionId: preview.revisionId,
        action,
      }).status
    ).toBe("conflict")
  })
})
