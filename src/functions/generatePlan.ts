import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { generatePlan } from "../../lib/ai"
import {
  exercise,
  plannedExercise,
  program,
  sessionTemplate,
  userProfile,
} from "../../lib/schema"

// ── Equipment preset → equipment string array ──────────────────────────────────
// Values must match the equipment strings used in data/exercises.ts exactly.

const EQUIPMENT_MAP = {
  full_gym: [
    "barbell",
    "rack",
    "dumbbell",
    "bench",
    "cable machine",
    "leg press machine",
    "leg curl machine",
    "leg extension machine",
    "pull-up bar",
    "dip station",
    "bodyweight",
  ],
  dumbbells_only: ["dumbbell", "bench", "pull-up bar", "bodyweight"],
  home_gym: [
    "barbell",
    "rack",
    "dumbbell",
    "bench",
    "pull-up bar",
    "bodyweight",
  ],
  minimal: ["dumbbell", "bodyweight"],
} as const

// ── Input schema ───────────────────────────────────────────────────────────────

const inputSchema = z.object({
  goal: z.enum(["strength", "hypertrophy", "both", "recomp", "fat_loss"]),
  equipmentPreset: z.enum([
    "full_gym",
    "dumbbells_only",
    "home_gym",
    "minimal",
  ]),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  daysPerWeek: z.union([
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  sessionLengthMin: z.union([z.literal(45), z.literal(60), z.literal(90)]),
  customDirectives: z.string().optional(),
})

export type GeneratePlanInput = z.infer<typeof inputSchema>
export interface GeneratePlanResult {
  profileId: string
  programId: string
}

// ── Server function ────────────────────────────────────────────────────────────

export const generatePlanFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<GeneratePlanResult> => {
    const equipmentList = [...EQUIPMENT_MAP[data.equipmentPreset]]

    // Load exercise library from DB
    const exercises = await db.select().from(exercise)

    // Call AI — may take 5–15 seconds
    const result = await generatePlan({
      goal: data.goal,
      experience: data.experience,
      equipment: equipmentList,
      sessionsPerWeek: data.daysPerWeek,
      sessionLengthMin: data.sessionLengthMin,
      customDirectives: data.customDirectives,
      exerciseLibrary: exercises,
    })

    // Build name → id lookup for resolving AI exercise names to DB ids
    const exerciseIdByName = new Map(
      exercises.map((e) => [e.name.toLowerCase(), e.id])
    )

    const profileId = crypto.randomUUID()
    const programId = crypto.randomUUID()

    // Persist everything in a single synchronous transaction
    db.transaction((tx) => {
      tx.insert(userProfile)
        .values({
          id: profileId,
          goal: data.goal,
          experience: data.experience,
          equipment: equipmentList,
          sessionsPerWeek: data.daysPerWeek,
          sessionLengthMin: data.sessionLengthMin,
          customDirectives: data.customDirectives ?? null,
          units: "kg",
          userId: null,
        })
        .run()

      tx.insert(program)
        .values({
          id: programId,
          name: result.program.name,
          weeksTotal: result.program.weeksTotal,
          sessionsPerWeek: result.program.sessionsPerWeek,
          status: "active",
          aiRationale: result.program.aiRationale,
          userId: null,
        })
        .run()

      for (const week of result.weeks) {
        for (const session of week.sessions) {
          const sessionId = crypto.randomUUID()

          tx.insert(sessionTemplate)
            .values({
              id: sessionId,
              programId,
              weekNumber: week.weekNumber,
              dayLabel: session.dayLabel,
              focus: session.focus,
              userId: null,
            })
            .run()

          for (const ex of session.exercises) {
            const exerciseId = exerciseIdByName.get(
              ex.exerciseName.toLowerCase()
            )
            if (!exerciseId) continue

            tx.insert(plannedExercise)
              .values({
                id: crypto.randomUUID(),
                sessionTemplateId: sessionId,
                exerciseId,
                orderIndex: ex.orderIndex,
                sets: ex.sets,
                repRange: ex.repRange,
                loadKg: ex.loadKg,
                rirTarget: ex.rirTarget,
                restSeconds: ex.restSeconds,
                coachNote: ex.coachNote ?? null,
                userId: null,
              })
              .run()
          }
        }
      }
    })

    return { profileId, programId }
  })
