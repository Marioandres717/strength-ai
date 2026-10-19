import { z } from "zod"
import type {
  ExerciseInfo,
  SessionExercise,
  OnDemandWorkoutRunSnapshotV1,
} from "./session"

const focusSchema = z.enum(["strength", "hypertrophy", "mixed"])
export const constraintsSchema = z.object({
  timeMinutes: z.number().int().min(10).max(120),
  equipment: z.array(z.string().min(1).max(80)).max(35),
  focus: focusSchema,
  energy: z.number().int().min(1).max(5).nullable(),
  soreness: z.string().max(500).nullable(),
})
export type ResolvedOnDemandWorkoutConstraints = z.infer<
  typeof constraintsSchema
> & {
  defaults?: Record<string, "control" | "prompt" | "profile" | "fallback">
}

export const generateOnDemandWorkoutInputSchema = z.object({
  requestId: z.uuid(),
  prompt: z.string().trim().min(1).max(2000),
  timeMinutes: z.number().int().min(10).max(120).optional(),
  equipment: z.array(z.string().min(1).max(80)).max(35).optional(),
  focus: focusSchema.optional(),
  energy: z.number().int().min(1).max(5).optional(),
  soreness: z.string().max(500).optional(),
  experience: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  units: z.enum(["kg", "lbs"]).optional(),
  regenerateFromId: z.uuid().optional(),
  tweak: z.string().max(1000).optional(),
})
export type GenerateOnDemandWorkoutInput = z.infer<
  typeof generateOnDemandWorkoutInputSchema
>

export interface OnDemandWorkoutGenerationContext {
  constraints: ResolvedOnDemandWorkoutConstraints
  profile: { experience: string; units: "kg" | "lbs"; directives: string }
  library: ExerciseInfo[]
  baselines: Record<
    string,
    {
      loadKg: number
      loadBasis: "history" | "conservative_estimate" | "bodyweight"
      loadHistoryAt: string | null
      targetHistory?: {
        completedAt: string
        medianLoadKg: number
        minimumReps: number
        minimumRir: number
      }
    }
  >
  recentHistory: unknown[]
  previousWorkout?: {
    title: string
    exercises: { exerciseId: string; sets: number; repRange: string }[]
  }
  nextPlannedSession: string | null
}

export interface OnDemandWorkoutPreview {
  id: string
  revisionId: string
  revisionNumber: number
  title: string
  prompt: string
  focus: z.infer<typeof focusSchema>
  constraints: ResolvedOnDemandWorkoutConstraints
  reasoning: string
  editKind: "generated" | "preview_edit"
  estimatedDurationSeconds: number
  createdAt: string
  units: "kg" | "lbs"
  exercises: SessionExercise[]
  alternatives: Record<string, ExerciseInfo[]>
  snapshot: OnDemandWorkoutRunSnapshotV1
}

interface OnDemandWorkoutLibraryItem {
  id: string
  revisionId: string
  title: string
  promptExcerpt: string
  focus: z.infer<typeof focusSchema>
  estimatedDurationSeconds: number
  createdAt: string
  completedRunIds?: string[]
  timesCompleted: number
}
export interface OnDemandWorkoutLibraryPage {
  items: OnDemandWorkoutLibraryItem[]
  tombstoneIds: string[]
  nextCursor: { createdAt: string; id: string } | null
}

export type GenerationResult =
  | { status: "in_progress"; requestId: string }
  | {
      status: "saved"
      requestId: string
      onDemandWorkoutId: string
      preview: OnDemandWorkoutPreview | null
    }
  | { status: "save_pending"; requestId: string }
  | { status: "unknown"; requestId: string }
  | {
      status: "failed"
      requestId: string
      code: string
      reason: string
      attemptConsumed: boolean
      remaining?: number
      resetsAt?: string
    }

export interface GenerationRequestSummary {
  requestId: string
  promptExcerpt: string
  createdAt: string
  status: string
  onDemandWorkoutId: string | null
}

export const prescriptionRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("planned"),
    plannedExerciseId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("on_demand_workout"),
    onDemandWorkoutExerciseId: z.string().min(1),
  }),
])
export const snapshotSchema = z.object({
  version: z.literal(1),
  revisionId: z.uuid(),
  title: z.string().min(1).max(100),
  units: z.enum(["kg", "lbs"]),
  loadPolicyVersion: z.literal(1),
  exercises: z
    .array(
      z.object({
        onDemandWorkoutExerciseId: z.uuid(),
        exerciseId: z.string().min(1),
        sets: z.number().int().min(1).max(10),
        repRange: z.string().regex(/^([1-9][0-9]?|100)-([1-9][0-9]?|100)$/),
        loadKg: z.number().min(0).max(500),
        loadBasis: z.enum(["history", "conservative_estimate", "bodyweight"]),
        loadHistoryAt: z.iso.datetime({ offset: true }).nullable(),
        rirTarget: z.number().int().min(0).max(5),
        restSeconds: z.number().int().min(30).max(600),
        coachNote: z.string().max(400),
      })
    )
    .min(1)
    .max(12),
})

export const startWorkoutInputSchema = z.object({
  workoutLogId: z.uuid(),
  startedAt: z.iso.datetime({ offset: true }),
  intent: z.enum(["start", "offline_replay"]),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("planned"),
      sessionTemplateId: z.string().min(1),
      programId: z.string().min(1),
    }),
    z.object({
      kind: z.literal("on_demand_workout"),
      onDemandWorkoutId: z.uuid(),
      onDemandWorkoutRevisionId: z.uuid(),
    }),
  ]),
  onDemandWorkoutRunSnapshot: snapshotSchema.optional(),
})
export type StartWorkoutInput = z.infer<typeof startWorkoutInputSchema>

export const editOnDemandWorkoutInputSchema = z.object({
  onDemandWorkoutId: z.uuid(),
  expectedRevisionId: z.uuid(),
  action: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("remove"),
      onDemandWorkoutExerciseId: z.uuid(),
    }),
    z.object({
      kind: z.literal("swap"),
      onDemandWorkoutExerciseId: z.uuid(),
      replacementExerciseId: z.string().min(1),
    }),
  ]),
})

/** Deliberately narrow: controls remain visible and editable. */
export function parseOnDemandWorkoutPrompt(prompt: string): {
  timeMinutes?: number
  equipment?: string[]
} {
  const match = /\b(\d{2,3})\s*(?:min(?:ute)?s?)\b/i.exec(prompt)
  const minutes = match ? Number(match[1]) : undefined
  return {
    ...(minutes !== undefined && minutes >= 10 && minutes <= 120
      ? { timeMinutes: minutes }
      : {}),
    ...(/\bdumbbells?\s+only\b/i.test(prompt)
      ? { equipment: ["dumbbell"] }
      : {}),
  }
}
