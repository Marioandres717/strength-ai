import type { SessionExercise, SessionRun } from "../types/session"
import type { SessionWithExercises } from "../functions/getDashboardData"
import type { SelectProgram, SelectUserProfile } from "../../lib/schema"

const createdAt = new Date("2024-01-01T00:00:00Z")
export const program: SelectProgram = {
  id: "program-1",
  name: "Strength Foundation",
  weeksTotal: 4,
  sessionsPerWeek: 3,
  status: "active",
  aiRationale: "A progressive strength plan.",
  userId: null,
  createdAt,
}
export const profile: SelectUserProfile = {
  id: "profile-1",
  goal: "strength",
  experience: "beginner",
  equipment: ["barbell"],
  sessionsPerWeek: 3,
  sessionLengthMin: 60,
  customDirectives: null,
  units: "kg",
  userId: null,
  createdAt,
}
const exercise = {
  id: "exercise-1",
  name: "Back Squat",
  movement: "squat" as const,
  primaryMuscles: ["quads"],
  equipment: ["barbell"],
}
const planned = {
  id: "planned-1",
  sessionTemplateId: "session-1",
  exerciseId: exercise.id,
  orderIndex: 0,
  sets: 3,
  repRange: "5-8",
  loadKg: 80,
  rirTarget: 2,
  restSeconds: 120,
  coachNote: "Keep your chest tall.",
  userId: null,
  createdAt,
}
export const session: SessionWithExercises = {
  template: {
    id: "session-1",
    programId: program.id,
    weekNumber: 1,
    orderIndex: 0,
    dayLabel: "Lower Body",
    focus: "strength",
    userId: null,
    createdAt,
  },
  exercises: [{ exercise, planned }],
  workoutLog: null,
}
export const sessionExercise: SessionExercise = {
  exercise,
  prescription: {
    ...planned,
    ref: { kind: "planned", plannedExerciseId: planned.id },
  },
  priorPerformance: {
    weightKg: 77.5,
    reps: 6,
    rirActual: 2,
    date: "2024-01-01",
  },
}
export const run: SessionRun = {
  workoutLogId: "workout-1",
  source: {
    kind: "planned",
    sessionTemplateId: session.template.id,
    programId: program.id,
  },
  title: "Lower Body",
  programName: program.name,
  units: "kg",
  startedAt: new Date(),
  exercises: [sessionExercise],
  persistedSets: [],
}
