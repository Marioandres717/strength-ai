import type { PriorPerformance } from "../types/session"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { getSessionDataOperation } from "./getSessionData.server"
import type {
  SelectExercise,
  SelectPlannedExercise,
  SelectProgram,
  SelectSessionTemplate,
} from "../../lib/schema"

export type { PriorPerformance } from "../types/session"
export interface SessionExerciseRow {
  planned: SelectPlannedExercise
  exercise: SelectExercise
  priorPerformance: PriorPerformance | null
}

export interface PersistedSetLog {
  setLogId: string
  plannedExerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
}

export interface GetSessionDataResult {
  units: "kg" | "lbs"
  sessionTemplate: SelectSessionTemplate
  program: SelectProgram
  exercises: SessionExerciseRow[]
  workoutLogId: string
  startedAt: Date
  persistedSets: PersistedSetLog[]
}

const inputSchema = z.object({ sessionTemplateId: z.string().min(1) })

export const getSessionDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) => getSessionDataOperation(db, data.sessionTemplateId))
