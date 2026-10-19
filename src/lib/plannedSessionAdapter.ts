import type { GetSessionDataResult } from "../functions/getSessionData"
import type { SessionRun } from "../types/session"

export function plannedSessionAdapter(data: GetSessionDataResult): SessionRun {
  return {
    workoutLogId: data.workoutLogId,
    source: {
      kind: "planned",
      sessionTemplateId: data.sessionTemplate.id,
      programId: data.program.id,
    },
    title: data.sessionTemplate.dayLabel,
    programName: data.program.name,
    units: data.units,
    startedAt: data.startedAt,
    persistedSets: data.persistedSets.map(({ plannedExerciseId, ...set }) => ({
      ...set,
      prescriptionRef: { kind: "planned", plannedExerciseId },
    })),
    exercises: data.exercises.map(({ planned, ...entry }) => ({
      ...entry,
      prescription: {
        ...planned,
        ref: { kind: "planned", plannedExerciseId: planned.id },
      },
    })),
  }
}
