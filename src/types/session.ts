type SessionSource =
  | { kind: "planned"; sessionTemplateId: string; programId: string }
  | {
      kind: "on_demand_workout"
      onDemandWorkoutId: string
      onDemandWorkoutRevisionId: string
    }

export type PrescriptionRef =
  | { kind: "planned"; plannedExerciseId: string }
  | { kind: "on_demand_workout"; onDemandWorkoutExerciseId: string }

export function prescriptionId(ref: PrescriptionRef): string {
  return ref.kind === "planned"
    ? ref.plannedExerciseId
    : ref.onDemandWorkoutExerciseId
}

export function setKey(ref: PrescriptionRef, setNumber: number): string {
  return `${ref.kind}:${prescriptionId(ref)}:${setNumber}`
}

export interface PriorPerformance {
  weightKg: number
  reps: number
  rirActual: number | null
  date: string
}

export type LoadBasis = "history" | "conservative_estimate" | "bodyweight"
interface SessionPrescription {
  ref: PrescriptionRef
  orderIndex: number
  sets: number
  repRange: string
  loadKg: number
  rirTarget: number
  restSeconds: number
  coachNote: string | null
  loadBasis?: LoadBasis
  loadHistoryAt?: string | null
}

export interface ExerciseInfo {
  id: string
  name: string
  movement: "squat" | "hinge" | "push" | "pull" | "carry" | "isolation"
  primaryMuscles: string[]
  equipment: string[]
}

export interface SessionExercise {
  prescription: SessionPrescription
  exercise: ExerciseInfo
  priorPerformance: PriorPerformance | null
}

export interface PersistedSet {
  setLogId: string
  prescriptionRef: PrescriptionRef
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
}

export interface SessionRun {
  restDeadline?: number | null
  restSeconds?: number
  workoutLogId: string
  source: SessionSource
  title: string
  programName: string | null
  units: "kg" | "lbs"
  startedAt: Date
  completedAt?: Date | null
  exercises: SessionExercise[]
  persistedSets: PersistedSet[]
  snapshot?: OnDemandWorkoutRunSnapshotV1
}

export interface OnDemandWorkoutRunSnapshotV1 {
  version: 1
  revisionId: string
  title: string
  units: "kg" | "lbs"
  loadPolicyVersion: 1
  exercises: {
    onDemandWorkoutExerciseId: string
    exerciseId: string
    sets: number
    repRange: string
    loadKg: number
    loadBasis: LoadBasis
    loadHistoryAt: string | null
    rirTarget: number
    restSeconds: number
    coachNote: string
  }[]
}
