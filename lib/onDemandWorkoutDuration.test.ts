import { describe, expect, it } from "vitest"
import { estimateOnDemandWorkoutDuration } from "./onDemandWorkoutDuration"
import { suggestLoad } from "./loadSuggestions"
import { canApplyProgramRules } from "./rules"
import { fromKg } from "../src/lib/weightUnits"
import { parseOnDemandWorkoutPrompt } from "../src/types/on-demand-workout"

describe("on-demand workout policies", () => {
  it("includes the rest after exercise transitions but not the final workout set", () => {
    expect(
      estimateOnDemandWorkoutDuration([
        { sets: 2, repRange: "8-10", restSeconds: 60 },
        { sets: 1, repRange: "4-6", restSeconds: 120 },
      ])
    ).toBe(300 + 80 + 120 + 24 + 60)
  })
  it("uses median working load and reduces stale/under-target history only once", () => {
    const history = {
      workoutLogId: "run",
      completedAt: "2024-01-01T00:00:00Z",
      sets: [
        { weightKg: 50, reps: 4, rirActual: 1 },
        { weightKg: 100, reps: 8, rirActual: 2 },
        { weightKg: 75, reps: 8, rirActual: 2 },
      ],
    }
    const result = suggestLoad({
      baselineKg: 20,
      repRange: "8-12",
      rirTarget: 2,
      units: "kg",
      history,
      now: Date.parse("2024-03-01"),
    })
    expect(result.loadKg).toBe(67.5)
    expect(result.loadBasis).toBe("history")
    expect(
      suggestLoad({
        baselineKg: 20,
        repRange: "8-12",
        rirTarget: 2,
        units: "kg",
        history: {
          ...history,
          completedAt: new Date().toISOString(),
          sets: history.sets.map((s) => ({ ...s, reps: 12, rirActual: 4 })),
        },
      }).loadKg
    ).toBe(75)
  })
  it("rounds down to the displayed increment, allows lower AI suggestions and preserves zero", () => {
    const result = suggestLoad({
      baselineKg: 30,
      repRange: "8-12",
      rirTarget: 2,
      units: "lbs",
      modelLoadKg: 20,
    })
    expect(fromKg(result.loadKg, "lbs")).toBeCloseTo(40)
    expect(
      suggestLoad({
        baselineKg: 0,
        repRange: "8-12",
        rirTarget: 2,
        units: "kg",
      }).loadKg
    ).toBe(0)
  })
  it("only planned runs enter program rules regardless of week", () => {
    expect(canApplyProgramRules("planned")).toBe(true)
    expect(canApplyProgramRules("on_demand_workout")).toBe(false)
    expect(canApplyProgramRules("unknown")).toBe(false)
  })
  it("recognizes narrow visible prompt defaults without inventing a bench", () => {
    expect(parseOnDemandWorkoutPrompt("40 min, dumbbells only")).toEqual({
      timeMinutes: 40,
      equipment: ["dumbbell"],
    })
    expect(parseOnDemandWorkoutPrompt("make it quick")).toEqual({})
  })
})
