// @vitest-environment node
import { createServer } from "node:http"
import type { Server } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWorkoutTestDb } from "../src/test/workoutDb"
import { generateOnDemandWorkoutOperation } from "./onDemandWorkoutGeneration.server"
import { onDemandWorkoutGenerationRequest } from "./schema"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  adaptWeek,
  ollamaConfiguration,
  resolveAIProvider,
  validateAIConfiguration,
} from "./ai"

let server: Server
let requests: unknown[]
let status: number
let body: string
let stall: boolean
const input = { weekNumber: 1, sessions: [], logs: [], exerciseLibrary: [] }

beforeEach(async () => {
  requests = []
  status = 200
  body = JSON.stringify({
    done: true,
    message: {
      content: JSON.stringify({ changes: [], reasoning: "Maintain targets." }),
    },
  })
  stall = false
  vi.stubEnv("AI_PROVIDER", "ollama")
  vi.stubEnv("ANTHROPIC_API_KEY", "")
  vi.stubEnv("OPENAI_API_KEY", "")
  vi.stubEnv("OLLAMA_MODEL", "qwen3:14b")
  vi.stubEnv("OLLAMA_TIMEOUT_MS", "1000")
  vi.stubEnv("OLLAMA_NUM_CTX", "32768")
  server = createServer((req, res) => {
    void (async () => {
      let received = ""
      for await (const chunk of req) received += String(chunk)
      requests.push(JSON.parse(received))
      if (stall) return
      res.writeHead(status, { "Content-Type": "application/json" })
      res.end(body)
    })().catch(() => {
      res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Missing fixture port")
  vi.stubEnv("OLLAMA_BASE_URL", `http://127.0.0.1:${address.port}`)
})
afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  vi.unstubAllEnvs()
})

describe("Ollama HTTP integration", () => {
  it("saves local workouts and replays without redispatch or cloud keys", async () => {
    const db = createWorkoutTestDb()
    const directory = mkdtempSync(join(tmpdir(), "ollama-generation-"))
    try {
      const exercise = db.insertExercise({ name: "Back Squat" })
      body = JSON.stringify({
        done: true,
        message: {
          content: JSON.stringify({
            result: {
              status: "workout",
              title: "Local workout",
              focus: "mixed",
              reasoning: "Conservative targets.",
              resolvedConstraints: {
                timeMinutes: 30,
                equipment: ["barbell"],
                focus: "mixed",
                energy: null,
                soreness: null,
              },
              estimatedDurationSeconds: 300,
              exercises: [
                {
                  exerciseId: exercise.id,
                  sets: 1,
                  repRange: "8-12",
                  loadKg: 500,
                  rirTarget: 2,
                  restSeconds: 60,
                  coachNote: "Controlled reps.",
                },
              ],
            },
          }),
        },
      })
      const request = {
        requestId: crypto.randomUUID(),
        prompt: "30 min barbell workout",
        timeMinutes: 30,
        equipment: ["barbell"],
        experience: "beginner" as const,
      }
      const result = await generateOnDemandWorkoutOperation(
        db.db,
        request,
        directory
      )
      expect(result.status).toBe("saved")
      if (result.status !== "saved") throw new Error("Expected saved workout")
      expect(result.preview?.exercises[0].prescription.loadKg).toBeLessThan(500)
      await expect(
        generateOnDemandWorkoutOperation(db.db, request, directory)
      ).resolves.toMatchObject({
        status: "saved",
        onDemandWorkoutId: result.onDemandWorkoutId,
      })
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({ options: { num_predict: 4096 } })
      vi.stubEnv("OLLAMA_TIMEOUT_MS", "bad")
      await expect(
        generateOnDemandWorkoutOperation(
          db.db,
          { ...request, requestId: crypto.randomUUID() },
          directory
        )
      ).resolves.toMatchObject({ status: "failed", code: "PRE_DISPATCH" })
      expect(
        db.db.select().from(onDemandWorkoutGenerationRequest).all()
      ).toHaveLength(1)
      vi.stubEnv("OLLAMA_TIMEOUT_MS", "1000")
      status = 500
      for (let attempt = 0; attempt < 4; attempt++) {
        const failedRequest = { ...request, requestId: crypto.randomUUID() }
        await expect(
          generateOnDemandWorkoutOperation(db.db, failedRequest, directory)
        ).resolves.toMatchObject({
          status: "failed",
          code: "LOCAL_PROVIDER",
          attemptConsumed: true,
        })
        await expect(
          generateOnDemandWorkoutOperation(db.db, failedRequest, directory)
        ).resolves.toMatchObject({ status: "failed", code: "LOCAL_PROVIDER" })
      }
      await expect(
        generateOnDemandWorkoutOperation(
          db.db,
          { ...request, requestId: crypto.randomUUID() },
          directory
        )
      ).resolves.toMatchObject({ status: "failed", code: "DAILY_CAP" })
      expect(requests).toHaveLength(5)
    } finally {
      db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it("uses schema-constrained generation with no cloud credentials", async () => {
    expect(() => validateAIConfiguration()).not.toThrow()
    await expect(adaptWeek(input)).resolves.toEqual({
      changes: [],
      reasoning: "Maintain targets.",
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      model: "qwen3:14b",
      stream: false,
      think: false,
      format: { type: "object" },
      options: { temperature: 0, num_predict: 2048, num_ctx: 32768 },
    })
  })
  it.each([
    "not JSON",
    JSON.stringify({ done: false, message: { content: "{}" } }),
    JSON.stringify({ done: true, message: { content: "not JSON" } }),
    JSON.stringify({ done: true, message: { content: "{}" } }),
    JSON.stringify({
      done: true,
      done_reason: "length",
      message: { content: "{}" },
    }),
  ])(
    "rejects malformed or incomplete output without retrying: %s",
    async (response) => {
      body = response
      await expect(adaptWeek(input)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
      expect(requests).toHaveLength(1)
    }
  )
  it.each([404, 500])("reports HTTP %i without retrying", async (code) => {
    status = code
    await expect(adaptWeek(input)).rejects.toMatchObject({ code: "API_ERROR" })
    expect(requests).toHaveLength(1)
  })
  it("aborts at the local deadline without retrying", async () => {
    stall = true
    vi.stubEnv("OLLAMA_TIMEOUT_MS", "100")
    await expect(adaptWeek(input)).rejects.toThrow("deadline")
    expect(requests).toHaveLength(1)
  })
  it("reports connection failures", async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await expect(adaptWeek(input)).rejects.toThrow("Cannot reach Ollama")
    expect(requests).toHaveLength(0)
  })
})

describe("provider configuration", () => {
  it("supports Ollama and documented defaults", () => {
    for (const name of [
      "OLLAMA_BASE_URL",
      "OLLAMA_MODEL",
      "OLLAMA_TIMEOUT_MS",
      "OLLAMA_NUM_CTX",
    ])
      vi.stubEnv(name, undefined)
    expect(resolveAIProvider("ollama")).toBe("ollama")
    expect(ollamaConfiguration()).toEqual({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:14b",
      timeout: 300000,
      numCtx: 32768,
    })
  })
  it.each([
    ["OLLAMA_BASE_URL", "ftp://localhost"],
    ["OLLAMA_BASE_URL", "http://user:pass@localhost"],
    ["OLLAMA_MODEL", " "],
    ["OLLAMA_TIMEOUT_MS", "0"],
    ["OLLAMA_TIMEOUT_MS", "NaN"],
    ["OLLAMA_TIMEOUT_MS", "2147483648"],
    ["OLLAMA_NUM_CTX", "-1"],
    ["OLLAMA_NUM_CTX", "1.5"],
  ])("rejects invalid %s=%s", (name, value) => {
    vi.stubEnv(name, value)
    expect(() => validateAIConfiguration()).toThrow()
  })
  it("validates only the selected cloud key", () => {
    vi.stubEnv("AI_PROVIDER", "openai")
    expect(() => validateAIConfiguration()).toThrow("OPENAI_API_KEY")
    vi.stubEnv("OPENAI_API_KEY", "test")
    expect(() => validateAIConfiguration()).not.toThrow()
  })
})
