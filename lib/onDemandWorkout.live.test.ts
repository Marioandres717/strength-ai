// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"
import { generateOnDemandWorkout, OnDemandWorkoutOutputSchema } from "./ai"

afterEach(() => vi.unstubAllEnvs())

it.skipIf(process.env.RUN_ON_DEMAND_AI_SMOKE !== "1")(
  "accepts the structured schema at the live Anthropic boundary (one paid call)",
  async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic")
    const result = await generateOnDemandWorkout(
      {
        requestId: crypto.randomUUID(),
        prompt: "One easy set of push-ups",
        timeMinutes: 10,
        equipment: [],
        experience: "beginner",
      },
      {
        constraints: {
          timeMinutes: 10,
          equipment: [],
          focus: "mixed",
          energy: 3,
          soreness: null,
        },
        profile: { experience: "beginner", units: "kg", directives: "" },
        library: [
          {
            id: "push-ups",
            name: "Push-Ups",
            movement: "push",
            primaryMuscles: ["chest"],
            equipment: [],
          },
        ],
        baselines: {
          "push-ups": {
            loadKg: 0,
            loadBasis: "bodyweight",
            loadHistoryAt: null,
          },
        },
        recentHistory: [],
        nextPlannedSession: null,
      }
    )
    expect(OnDemandWorkoutOutputSchema.safeParse({ result }).success).toBe(true)
  },
  100_000
)
