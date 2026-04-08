import { describe, expect, it } from "vitest"
import {
  AICallError,
  AdaptationSchema,
  PlanGenerationSchema,
  SwapSchema,
  resolveExerciseName,
  type ExerciseLibraryEntry,
} from "./ai"
import {
  buildAdaptationUserMessage,
  buildPlanUserMessage,
  buildSwapUserMessage,
} from "./prompts"

// ── Fixtures ───────────────────────────────────────────────────────────────────

const LIBRARY: ExerciseLibraryEntry[] = [
  {
    id: "1",
    name: "Back Squat",
    movement: "squat",
    primaryMuscles: ["quadriceps", "glutes"],
    equipment: ["barbell", "rack"],
  },
  {
    id: "2",
    name: "Romanian Deadlift",
    movement: "hinge",
    primaryMuscles: ["hamstrings", "glutes"],
    equipment: ["barbell"],
  },
  {
    id: "3",
    name: "Barbell Bench Press",
    movement: "push",
    primaryMuscles: ["chest", "triceps"],
    equipment: ["barbell", "bench"],
  },
  {
    id: "4",
    name: "Pull-Ups",
    movement: "pull",
    primaryMuscles: ["lats", "biceps"],
    equipment: ["pull-up bar"],
  },
  {
    id: "5",
    name: "Bicep Curl",
    movement: "isolation",
    primaryMuscles: ["biceps"],
    equipment: ["dumbbell"],
  },
]

function makeIndex(
  library: ExerciseLibraryEntry[]
): Map<string, ExerciseLibraryEntry> {
  return new Map(library.map((e) => [e.name.toLowerCase().trim(), e]))
}

// ── AICallError ────────────────────────────────────────────────────────────────

describe("AICallError", () => {
  it("sets code and message correctly", () => {
    const err = new AICallError("API_ERROR", "something went wrong")
    expect(err.code).toBe("API_ERROR")
    expect(err.message).toBe("something went wrong")
    expect(err.name).toBe("AICallError")
    expect(err).toBeInstanceOf(Error)
  })

  it("stores cause when provided", () => {
    const cause = new Error("original")
    const err = new AICallError("VALIDATION_ERROR", "schema mismatch", cause)
    expect(err.cause).toBe(cause)
  })
})

// ── resolveExerciseName ────────────────────────────────────────────────────────

describe("resolveExerciseName", () => {
  const index = makeIndex(LIBRARY)

  it("resolves exact match", () => {
    expect(resolveExerciseName("Back Squat", LIBRARY, index)).toBe("Back Squat")
  })

  it("resolves case-insensitive match", () => {
    expect(resolveExerciseName("back squat", LIBRARY, index)).toBe("Back Squat")
    expect(resolveExerciseName("BACK SQUAT", LIBRARY, index)).toBe("Back Squat")
    expect(resolveExerciseName("Back squat", LIBRARY, index)).toBe("Back Squat")
  })

  it("resolves normalized token match (reordered words)", () => {
    // "Squat Back" normalizes to same sorted tokens as "Back Squat"
    expect(resolveExerciseName("Squat Back", LIBRARY, index)).toBe("Back Squat")
  })

  it("resolves via Dice similarity for minor typos", () => {
    // "Bacck Squat" is close enough to "Back Squat" via bigram overlap
    expect(resolveExerciseName("Bacck Squat", LIBRARY, index)).toBe(
      "Back Squat"
    )
  })

  it("throws EXERCISE_NAME_MISMATCH for unrecognised names", () => {
    let caught: unknown
    try {
      resolveExerciseName("Leg Press", LIBRARY, index)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AICallError)
    expect((caught as AICallError).code).toBe("EXERCISE_NAME_MISMATCH")
  })

  it("throws EXERCISE_NAME_MISMATCH for empty string", () => {
    expect(() => resolveExerciseName("", LIBRARY, index)).toThrow(AICallError)
  })
})

// ── Zod schemas ────────────────────────────────────────────────────────────────

describe("PlanGenerationSchema", () => {
  const validPlan = {
    program: {
      name: "Northern Strength Block I",
      weeksTotal: 4,
      sessionsPerWeek: 3,
      aiRationale: "A balanced 3-day program focused on strength.",
    },
    weeks: Array.from({ length: 4 }, (_, i) => ({
      weekNumber: i + 1,
      sessions: [
        {
          dayLabel: "Upper A",
          focus: "strength",
          exercises: [
            {
              exerciseName: "Back Squat",
              orderIndex: 0,
              sets: 4,
              repRange: "4-6",
              loadKg: 80,
              rirTarget: 2,
              restSeconds: 180,
              coachNote: "Drive through your heels.",
            },
          ],
        },
      ],
    })),
    reasoning: "A detailed explanation of the program design.",
  }

  it("accepts a valid plan", () => {
    const result = PlanGenerationSchema.safeParse(validPlan)
    expect(result.success).toBe(true)
  })

  it("rejects when weeks array has wrong length", () => {
    const bad = { ...validPlan, weeks: validPlan.weeks.slice(0, 3) }
    expect(PlanGenerationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects weeksTotal != 4", () => {
    const bad = {
      ...validPlan,
      program: { ...validPlan.program, weeksTotal: 6 },
    }
    expect(PlanGenerationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects sets outside 1-10 range", () => {
    const bad = {
      ...validPlan,
      weeks: validPlan.weeks.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({
          ...s,
          exercises: s.exercises.map((e) => ({ ...e, sets: 0 })),
        })),
      })),
    }
    expect(PlanGenerationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects rirTarget outside 0-5 range", () => {
    const bad = {
      ...validPlan,
      weeks: validPlan.weeks.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({
          ...s,
          exercises: s.exercises.map((e) => ({ ...e, rirTarget: 6 })),
        })),
      })),
    }
    expect(PlanGenerationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects restSeconds outside 30-600 range", () => {
    const bad = {
      ...validPlan,
      weeks: validPlan.weeks.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({
          ...s,
          exercises: s.exercises.map((e) => ({ ...e, restSeconds: 10 })),
        })),
      })),
    }
    expect(PlanGenerationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects invalid focus enum", () => {
    const bad = {
      ...validPlan,
      weeks: validPlan.weeks.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({ ...s, focus: "cardio" })),
      })),
    }
    expect(PlanGenerationSchema.safeParse(bad).success).toBe(false)
  })
})

describe("AdaptationSchema", () => {
  it("accepts valid output with changes", () => {
    const result = AdaptationSchema.safeParse({
      changes: [
        {
          sessionDayLabel: "Upper A",
          exerciseName: "Back Squat",
          field: "sets",
          oldValue: 4,
          newValue: 3,
          reason: "High fatigue across the week.",
        },
      ],
      reasoning: "Fatigue was elevated — reduced volume to manage recovery.",
    })
    expect(result.success).toBe(true)
  })

  it("accepts empty changes array (no changes needed)", () => {
    const result = AdaptationSchema.safeParse({
      changes: [],
      reasoning: "Week progressed as expected. No changes warranted.",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid field value", () => {
    const result = AdaptationSchema.safeParse({
      changes: [
        {
          sessionDayLabel: "Upper A",
          exerciseName: "Back Squat",
          field: "volume",
          oldValue: 4,
          newValue: 3,
          reason: "Too much.",
        },
      ],
      reasoning: "Test.",
    })
    expect(result.success).toBe(false)
  })
})

describe("SwapSchema", () => {
  it("accepts valid swap output", () => {
    const result = SwapSchema.safeParse({
      candidates: [
        {
          exerciseName: "Front Squat",
          rank: 1,
          reason: "Same movement pattern.",
        },
        {
          exerciseName: "Goblet Squat",
          rank: 2,
          reason: "Requires only a dumbbell.",
        },
      ],
      reasoning: "Two solid alternatives given available equipment.",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty candidates array", () => {
    const result = SwapSchema.safeParse({
      candidates: [],
      reasoning: "None found.",
    })
    expect(result.success).toBe(false)
  })

  it("rejects more than 3 candidates", () => {
    const result = SwapSchema.safeParse({
      candidates: [1, 2, 3, 4].map((rank) => ({
        exerciseName: "Back Squat",
        rank,
        reason: "Fits well.",
      })),
      reasoning: "Four options found.",
    })
    expect(result.success).toBe(false)
  })
})

// ── Message builders ───────────────────────────────────────────────────────────

describe("buildPlanUserMessage", () => {
  const input = {
    goal: "strength" as const,
    experience: "intermediate" as const,
    equipment: ["barbell", "rack", "bench"],
    sessionsPerWeek: 3,
    sessionLengthMin: 60,
    exerciseLibrary: LIBRARY,
  }

  it("includes goal, experience, and session info", () => {
    const msg = buildPlanUserMessage(input)
    expect(msg).toContain("Goal: strength")
    expect(msg).toContain("Experience: intermediate")
    expect(msg).toContain("Sessions per week: 3")
    expect(msg).toContain("60 minutes")
  })

  it("includes all equipment", () => {
    const msg = buildPlanUserMessage(input)
    expect(msg).toContain("barbell")
    expect(msg).toContain("rack")
    expect(msg).toContain("bench")
  })

  it("includes exercise names from the library", () => {
    const msg = buildPlanUserMessage(input)
    expect(msg).toContain("Back Squat")
    expect(msg).toContain("Pull-Ups")
  })

  it("includes custom directives when provided", () => {
    const withDirectives = {
      ...input,
      customDirectives: "Focus on posterior chain",
    }
    const msg = buildPlanUserMessage(withDirectives)
    expect(msg).toContain("Focus on posterior chain")
  })

  it("shows bodyweight only when equipment is empty", () => {
    const msg = buildPlanUserMessage({ ...input, equipment: [] })
    expect(msg).toContain("bodyweight only")
  })
})

describe("buildAdaptationUserMessage", () => {
  const input = {
    weekNumber: 2,
    sessions: [
      {
        dayLabel: "Upper A",
        focus: "strength" as const,
        exercises: [
          {
            exerciseName: "Back Squat",
            sets: 4,
            repRange: "4-6",
            loadKg: 80,
            rirTarget: 2,
            restSeconds: 180,
          },
        ],
      },
    ],
    logs: [
      {
        dayLabel: "Upper A",
        focus: "strength" as const,
        fatigueRating: 4,
        notes: "Felt heavy",
        sets: [
          {
            exerciseName: "Back Squat",
            setNumber: 1,
            weightKg: 80,
            reps: 5,
            rirActual: 1,
          },
        ],
      },
    ],
    exerciseLibrary: LIBRARY,
  }

  it("includes week number", () => {
    const msg = buildAdaptationUserMessage(input)
    expect(msg).toContain("Week 2")
  })

  it("includes session and exercise data", () => {
    const msg = buildAdaptationUserMessage(input)
    expect(msg).toContain("Upper A")
    expect(msg).toContain("Back Squat")
    expect(msg).toContain("80kg")
  })

  it("includes fatigue rating and notes", () => {
    const msg = buildAdaptationUserMessage(input)
    expect(msg).toContain("fatigue rating: 4")
    expect(msg).toContain("Felt heavy")
  })

  it("includes RIR actual in set logs", () => {
    const msg = buildAdaptationUserMessage(input)
    expect(msg).toContain("RIR actual 1")
  })
})

describe("buildSwapUserMessage", () => {
  const input = {
    exerciseToReplace: LIBRARY[0], // Back Squat
    sessionContext: [
      {
        exerciseName: "Barbell Bench Press",
        sets: 4,
        repRange: "4-6",
        loadKg: 80,
        rirTarget: 2,
        restSeconds: 180,
      },
    ],
    availableEquipment: ["barbell", "rack", "dumbbell"],
    exerciseLibrary: LIBRARY,
  }

  it("includes exercise to replace", () => {
    const msg = buildSwapUserMessage(input)
    expect(msg).toContain("Back Squat")
    expect(msg).toContain("squat")
  })

  it("includes session context", () => {
    const msg = buildSwapUserMessage(input)
    expect(msg).toContain("Barbell Bench Press")
  })

  it("includes available equipment", () => {
    const msg = buildSwapUserMessage(input)
    expect(msg).toContain("barbell")
    expect(msg).toContain("dumbbell")
  })

  it("shows bodyweight only when equipment is empty", () => {
    const msg = buildSwapUserMessage({ ...input, availableEquipment: [] })
    expect(msg).toContain("bodyweight only")
  })
})

// ── Integration tests (require ANTHROPIC_API_KEY) ─────────────────────────────

const hasKey = !!process.env.ANTHROPIC_API_KEY

describe.skipIf(!hasKey)("generatePlan integration", () => {
  it("returns a valid 4-week plan with coach notes and library-matching exercise names", async () => {
    const { generatePlan } = await import("./ai")

    const output = await generatePlan({
      goal: "strength",
      experience: "beginner",
      equipment: ["dumbbell", "bench"],
      sessionsPerWeek: 3,
      sessionLengthMin: 45,
      exerciseLibrary: LIBRARY,
    })

    expect(output.weeks).toHaveLength(4)
    expect(output.program.weeksTotal).toBe(4)
    expect(output.program.name.length).toBeGreaterThan(0)
    expect(output.program.aiRationale.length).toBeGreaterThan(0)

    const exerciseNames = new Set(LIBRARY.map((e) => e.name))
    for (const week of output.weeks) {
      for (const session of week.sessions) {
        for (const ex of session.exercises) {
          expect(ex.coachNote.length).toBeGreaterThan(0)
          expect(exerciseNames.has(ex.exerciseName)).toBe(true)
        }
      }
    }
  }, 60_000)
})
