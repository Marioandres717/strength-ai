import type { OnDemandWorkoutRunSnapshotV1 } from "../src/types/session"
import type {
  ResolvedOnDemandWorkoutConstraints,
  GenerateOnDemandWorkoutInput,
  OnDemandWorkoutGenerationContext,
} from "../src/types/on-demand-workout"
import { sql } from "drizzle-orm"
import {
  check,
  index,
  uniqueIndex,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

// ---------------------------------------------------------------------------
// exercise — shared static data, no user_id
// ---------------------------------------------------------------------------

export const exercise = sqliteTable("exercise", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  movement: text("movement", {
    enum: ["squat", "hinge", "push", "pull", "carry", "isolation"],
  }).notNull(),
  primaryMuscles: text("primary_muscles", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull(),
})

// ---------------------------------------------------------------------------
// user_profile
// ---------------------------------------------------------------------------

export const userProfile = sqliteTable("user_profile", {
  id: text("id").primaryKey(),
  goal: text("goal", {
    enum: ["strength", "hypertrophy", "both", "recomp", "fat_loss"],
  }).notNull(),
  experience: text("experience", {
    enum: ["beginner", "intermediate", "advanced"],
  }).notNull(),
  equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull(),
  sessionsPerWeek: integer("sessions_per_week").notNull(),
  sessionLengthMin: integer("session_length_min").notNull(),
  customDirectives: text("custom_directives"),
  units: text("units", { enum: ["kg", "lbs"] })
    .notNull()
    .default("kg"),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})

// ---------------------------------------------------------------------------
// program
// ---------------------------------------------------------------------------

export const program = sqliteTable("program", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  weeksTotal: integer("weeks_total").notNull(),
  sessionsPerWeek: integer("sessions_per_week").notNull(),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  aiRationale: text("ai_rationale").notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})

// ---------------------------------------------------------------------------
// session_template
// ---------------------------------------------------------------------------

export const sessionTemplate = sqliteTable("session_template", {
  id: text("id").primaryKey(),
  programId: text("program_id")
    .notNull()
    .references(() => program.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  dayLabel: text("day_label").notNull(),
  focus: text("focus", {
    enum: ["strength", "hypertrophy", "mixed"],
  }).notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})

// ---------------------------------------------------------------------------
// planned_exercise
// ---------------------------------------------------------------------------

export const plannedExercise = sqliteTable("planned_exercise", {
  id: text("id").primaryKey(),
  sessionTemplateId: text("session_template_id")
    .notNull()
    .references(() => sessionTemplate.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercise.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  sets: integer("sets").notNull(),
  repRange: text("rep_range").notNull(),
  loadKg: real("load_kg").notNull(),
  rirTarget: integer("rir_target").notNull(),
  restSeconds: integer("rest_seconds").notNull(),
  coachNote: text("coach_note"),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})

// ---------------------------------------------------------------------------
// workout_log
// ---------------------------------------------------------------------------

const createdTimestamp = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`)

export const onDemandWorkoutGenerationRequest = sqliteTable(
  "on_demand_workout_generation_request",
  {
    id: text("id").primaryKey(),
    requestHash: text("request_hash").notNull(),
    input: text("input", { mode: "json" })
      .$type<GenerateOnDemandWorkoutInput>()
      .notNull(),
    context: text("context", { mode: "json" })
      .$type<OnDemandWorkoutGenerationContext>()
      .notNull(),
    status: text("status", {
      enum: [
        "reserved",
        "calling",
        "save_pending",
        "saved",
        "failed",
        "unknown",
      ],
    }).notNull(),
    quotaDay: text("quota_day").notNull(),
    callStartedAt: integer("call_started_at", { mode: "timestamp" }),
    errorCode: text("error_code"),
    createdAt: createdTimestamp(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    userId: text("user_id"),
  },
  (t) => [
    index("on_demand_request_quota").on(t.userId, t.quotaDay, t.createdAt),
    check(
      "on_demand_request_status",
      sql`${t.status} in ('reserved','calling','save_pending','saved','failed','unknown')`
    ),
  ]
)

export const onDemandWorkout = sqliteTable(
  "on_demand_workout",
  {
    id: text("id").primaryKey(),
    generationRequestId: text("generation_request_id")
      .notNull()
      .references(() => onDemandWorkoutGenerationRequest.id, {
        onDelete: "restrict",
      }),
    createdAt: createdTimestamp(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    userId: text("user_id"),
  },
  (t) => [
    uniqueIndex("on_demand_workout_request").on(t.generationRequestId),
    index("on_demand_workout_library").on(
      t.userId,
      t.deletedAt,
      t.createdAt,
      t.id
    ),
  ]
)

export const onDemandWorkoutRevision = sqliteTable(
  "on_demand_workout_revision",
  {
    id: text("id").primaryKey(),
    onDemandWorkoutId: text("on_demand_workout_id")
      .notNull()
      .references(() => onDemandWorkout.id, { onDelete: "restrict" }),
    revisionNumber: integer("revision_number").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    constraints: text("constraints", { mode: "json" })
      .$type<ResolvedOnDemandWorkoutConstraints>()
      .notNull(),
    focus: text("focus", {
      enum: ["strength", "hypertrophy", "mixed"],
    }).notNull(),
    estimatedDurationSeconds: integer("estimated_duration_seconds").notNull(),
    reasoning: text("reasoning").notNull(),
    editKind: text("edit_kind", {
      enum: ["generated", "preview_edit"],
    }).notNull(),
    createdAt: createdTimestamp(),
    userId: text("user_id"),
  },
  (t) => [
    uniqueIndex("on_demand_revision_number").on(
      t.onDemandWorkoutId,
      t.revisionNumber
    ),
    check("on_demand_revision_positive", sql`${t.revisionNumber} >= 1`),
    check(
      "on_demand_duration_positive",
      sql`${t.estimatedDurationSeconds} > 0`
    ),
    check(
      "on_demand_focus",
      sql`${t.focus} in ('strength','hypertrophy','mixed')`
    ),
    check(
      "on_demand_edit_kind",
      sql`${t.editKind} in ('generated','preview_edit')`
    ),
  ]
)

export const onDemandWorkoutExercise = sqliteTable(
  "on_demand_workout_exercise",
  {
    id: text("id").primaryKey(),
    onDemandWorkoutRevisionId: text("on_demand_workout_revision_id")
      .notNull()
      .references(() => onDemandWorkoutRevision.id, { onDelete: "restrict" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull(),
    sets: integer("sets").notNull(),
    repRange: text("rep_range").notNull(),
    loadKg: real("load_kg").notNull(),
    loadBasis: text("load_basis", {
      enum: ["history", "conservative_estimate", "bodyweight"],
    }).notNull(),
    loadHistoryAt: integer("load_history_at", { mode: "timestamp" }),
    rirTarget: integer("rir_target").notNull(),
    restSeconds: integer("rest_seconds").notNull(),
    coachNote: text("coach_note").notNull(),
    createdAt: createdTimestamp(),
    userId: text("user_id"),
  },
  (t) => [
    uniqueIndex("on_demand_exercise_order").on(
      t.onDemandWorkoutRevisionId,
      t.orderIndex
    ),
    index("on_demand_exercise_history").on(
      t.exerciseId,
      t.onDemandWorkoutRevisionId
    ),
    check("on_demand_order", sql`${t.orderIndex} >= 0`),
    check("on_demand_sets", sql`${t.sets} between 1 and 10`),
    check("on_demand_load", sql`${t.loadKg} between 0 and 500`),
    check("on_demand_rir", sql`${t.rirTarget} between 0 and 5`),
    check("on_demand_rest", sql`${t.restSeconds} between 30 and 600`),
    check(
      "on_demand_load_basis",
      sql`${t.loadBasis} in ('history','conservative_estimate','bodyweight')`
    ),
  ]
)

export const workoutLog = sqliteTable(
  "workout_log",
  {
    id: text("id").primaryKey(),
    sessionTemplateId: text("session_template_id").references(
      () => sessionTemplate.id
    ),
    onDemandWorkoutRevisionId: text("on_demand_workout_revision_id").references(
      () => onDemandWorkoutRevision.id,
      { onDelete: "restrict" }
    ),
    runSnapshot: text("run_snapshot", {
      mode: "json",
    }).$type<OnDemandWorkoutRunSnapshotV1>(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    fatigueRating: integer("fatigue_rating"),
    notes: text("notes"),
    userId: text("user_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    check(
      "workout_log_exactly_one_source",
      sql`(${t.sessionTemplateId} is not null and ${t.onDemandWorkoutRevisionId} is null) or (${t.sessionTemplateId} is null and ${t.onDemandWorkoutRevisionId} is not null)`
    ),
    check(
      "workout_log_on_demand_workout_snapshot",
      sql`(${t.onDemandWorkoutRevisionId} is null and ${t.runSnapshot} is null) or (${t.onDemandWorkoutRevisionId} is not null and ${t.runSnapshot} is not null and json_valid(${t.runSnapshot}))`
    ),
    index("workout_planned_started").on(t.sessionTemplateId, t.startedAt),
    index("workout_on_demand_completed").on(
      t.onDemandWorkoutRevisionId,
      t.completedAt
    ),
  ]
)

// ---------------------------------------------------------------------------
// set_log
// ---------------------------------------------------------------------------

export const setLog = sqliteTable(
  "set_log",
  {
    id: text("id").primaryKey(),
    workoutLogId: text("workout_log_id")
      .notNull()
      .references(() => workoutLog.id, { onDelete: "cascade" }),
    plannedExerciseId: text("planned_exercise_id").references(
      () => plannedExercise.id
    ),
    onDemandWorkoutExerciseId: text("on_demand_workout_exercise_id").references(
      () => onDemandWorkoutExercise.id,
      { onDelete: "restrict" }
    ),
    setNumber: integer("set_number").notNull(),
    weightKg: real("weight_kg").notNull(),
    reps: integer("reps").notNull(),
    rirActual: integer("rir_actual"),
    loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
    userId: text("user_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    check(
      "set_log_exactly_one_source",
      sql`(${t.plannedExerciseId} is not null and ${t.onDemandWorkoutExerciseId} is null) or (${t.plannedExerciseId} is null and ${t.onDemandWorkoutExerciseId} is not null)`
    ),
    index("set_log_workout").on(t.workoutLogId),
    uniqueIndex("set_log_on_demand_key")
      .on(t.workoutLogId, t.onDemandWorkoutExerciseId, t.setNumber)
      .where(sql`${t.onDemandWorkoutExerciseId} is not null`),
  ]
)

// ---------------------------------------------------------------------------
// Schema object for drizzle relational API
// ---------------------------------------------------------------------------

export const schema = {
  onDemandWorkout,
  onDemandWorkoutRevision,
  onDemandWorkoutExercise,
  onDemandWorkoutGenerationRequest,
  exercise,
  userProfile,
  program,
  sessionTemplate,
  plannedExercise,
  workoutLog,
  setLog,
}

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type InsertExercise = typeof exercise.$inferInsert
export type SelectExercise = typeof exercise.$inferSelect

export type Goal = "strength" | "hypertrophy" | "both" | "recomp" | "fat_loss"

export type InsertUserProfile = typeof userProfile.$inferInsert
export type SelectUserProfile = typeof userProfile.$inferSelect

export type InsertProgram = typeof program.$inferInsert
export type SelectProgram = typeof program.$inferSelect

export type InsertSessionTemplate = typeof sessionTemplate.$inferInsert
export type SelectSessionTemplate = typeof sessionTemplate.$inferSelect

export type InsertPlannedExercise = typeof plannedExercise.$inferInsert
export type SelectPlannedExercise = typeof plannedExercise.$inferSelect

export type InsertWorkoutLog = typeof workoutLog.$inferInsert
export type SelectWorkoutLog = typeof workoutLog.$inferSelect

export type InsertSetLog = typeof setLog.$inferInsert
export type SelectSetLog = typeof setLog.$inferSelect

export type SelectOnDemandWorkoutExercise =
  typeof onDemandWorkoutExercise.$inferSelect
export type SelectOnDemandWorkoutRevision =
  typeof onDemandWorkoutRevision.$inferSelect
