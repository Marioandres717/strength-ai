// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  adaptWeek,
  generateOnDemandWorkout,
  generatePlan,
  ollamaConfiguration,
  swapExercise,
} from "./ai"
import type { ExerciseLibraryEntry } from "./ai"
import type { OnDemandWorkoutGenerationContext } from "../src/types/on-demand-workout"

const library: ExerciseLibraryEntry[] = [
  {
    id: "squat",
    name: "Back Squat",
    movement: "squat",
    primaryMuscles: ["quadriceps"],
    equipment: ["barbell", "rack"],
  },
  {
    id: "rdl",
    name: "Romanian Deadlift",
    movement: "hinge",
    primaryMuscles: ["hamstrings"],
    equipment: ["barbell"],
  },
  {
    id: "push-ups",
    name: "Push-Ups",
    movement: "push",
    primaryMuscles: ["chest"],
    equipment: [],
  },
  {
    id: "row",
    name: "Barbell Row",
    movement: "pull",
    primaryMuscles: ["back"],
    equipment: ["barbell"],
  },
  {
    id: "curl",
    name: "Barbell Curl",
    movement: "isolation",
    primaryMuscles: ["biceps"],
    equipment: ["barbell"],
  },
]
const equipment = ["barbell", "rack"]
const context: OnDemandWorkoutGenerationContext = {
  constraints: {
    timeMinutes: 30,
    equipment,
    focus: "mixed",
    energy: 3,
    soreness: null,
  },
  profile: { experience: "beginner", units: "kg", directives: "" },
  library,
  baselines: Object.fromEntries(
    library.map((ex) => [
      ex.id,
      {
        loadKg: ex.equipment.length ? 20 : 0,
        loadBasis: ex.equipment.length ? "conservative_estimate" : "bodyweight",
        loadHistoryAt: null,
      },
    ])
  ),
  recentHistory: [],
  nextPlannedSession: null,
}

describe.skipIf(process.env.RUN_OLLAMA_AI_SMOKE !== "1")(
  "live local model evaluation (no cloud calls)",
  () => {
    beforeAll(async () => {
      vi.stubEnv("AI_PROVIDER", "ollama")
      vi.stubEnv("ANTHROPIC_API_KEY", "")
      vi.stubEnv("OPENAI_API_KEY", "")
      const config = ollamaConfiguration()
      const version: unknown = await (
        await fetch(`${config.baseUrl}/api/version`)
      ).json()
      const tags: unknown = await (
        await fetch(`${config.baseUrl}/api/tags`)
      ).json()
      console.warn(
        "[Ollama evaluation]",
        JSON.stringify({ config, version, tags })
      )
      // Explicitly unload only the evaluation model to measure a cold first request.
      await fetch(`${config.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model, keep_alive: 0 }),
      })
    })
    afterAll(() => vi.unstubAllEnvs())
    it("cold: generates a four-week plan using library exercises", async () => {
      const result = await generatePlan({
        goal: "both",
        experience: "beginner",
        equipment,
        sessionsPerWeek: 3,
        sessionLengthMin: 45,
        exerciseLibrary: library,
      })
      expect(result.weeks).toHaveLength(4)
      for (const week of result.weeks) {
        expect(week.sessions).toHaveLength(3)
        for (const session of week.sessions) {
          expect(session.exercises.length).toBeGreaterThan(0)
          for (const ex of session.exercises)
            expect(
              library.some((entry) => entry.name === ex.exerciseName)
            ).toBe(true)
        }
      }
    }, 310000)
    it("warm: adapts an existing week", async () => {
      const result = await adaptWeek({
        weekNumber: 1,
        sessions: [
          {
            dayLabel: "A",
            focus: "mixed",
            exercises: [
              {
                exerciseName: "Back Squat",
                sets: 3,
                repRange: "6-8",
                loadKg: 20,
                rirTarget: 2,
                restSeconds: 120,
              },
            ],
          },
        ],
        logs: [
          {
            dayLabel: "A",
            focus: "mixed",
            fatigueRating: 3,
            notes: null,
            sets: [
              {
                exerciseName: "Back Squat",
                setNumber: 1,
                weightKg: 20,
                reps: 8,
                rirActual: 2,
              },
            ],
          },
        ],
        exerciseLibrary: library,
      })
      expect(result.reasoning.length).toBeGreaterThan(0)
      for (const change of result.changes)
        expect(change.exerciseName).toBe("Back Squat")
    }, 310000)
    it("warm: swaps within the available library", async () => {
      const result = await swapExercise({
        exerciseToReplace: library[0],
        sessionContext: [],
        availableEquipment: equipment,
        exerciseLibrary: library,
      })
      for (const candidate of result.candidates)
        expect(
          library.some((entry) => entry.name === candidate.exerciseName)
        ).toBe(true)
    }, 310000)
    it.each([
      ["normal", "A balanced 30 minute workout", 30, equipment, library],
      [
        "restricted",
        "One easy set of push-ups in 10 minutes, no equipment",
        10,
        [],
        [library[2]],
      ],
      [
        "infeasible",
        "Only heavy barbell back squats. Do not substitute. I have no equipment.",
        10,
        [],
        [],
      ],
    ] as const)(
      "warm: %s on-demand request",
      async (name, prompt, minutes, available, entries) => {
        const result = await generateOnDemandWorkout(
          {
            requestId: crypto.randomUUID(),
            prompt,
            timeMinutes: minutes,
            equipment: [...available],
            experience: "beginner",
          },
          {
            ...context,
            library: [...entries],
            constraints: {
              ...context.constraints,
              timeMinutes: minutes,
              equipment: [...available],
            },
          }
        )
        if (name === "infeasible") {
          expect(result.status).toBe("infeasible")
          return
        }
        expect(result.status).toBe("workout")
        if (result.status !== "workout") throw new Error("Expected workout")
        expect(result.estimatedDurationSeconds).toBeLessThanOrEqual(
          minutes * 60
        )
        for (const ex of result.exercises)
          expect(entries.some((entry) => entry.id === ex.exerciseId)).toBe(true)
        if (name === "restricted") {
          expect(result.exercises).toHaveLength(1)
          expect(result.exercises[0]).toMatchObject({ sets: 1, loadKg: 0 })
        }
      },
      310000
    )
  }
)
