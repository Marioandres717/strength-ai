import { sql } from "drizzle-orm"
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

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

export const workoutLog = sqliteTable("workout_log", {
  id: text("id").primaryKey(),
  sessionTemplateId: text("session_template_id")
    .notNull()
    .references(() => sessionTemplate.id),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  fatigueRating: integer("fatigue_rating"),
  notes: text("notes"),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})

// ---------------------------------------------------------------------------
// set_log
// ---------------------------------------------------------------------------

export const setLog = sqliteTable("set_log", {
  id: text("id").primaryKey(),
  workoutLogId: text("workout_log_id")
    .notNull()
    .references(() => workoutLog.id, { onDelete: "cascade" }),
  plannedExerciseId: text("planned_exercise_id")
    .notNull()
    .references(() => plannedExercise.id),
  setNumber: integer("set_number").notNull(),
  weightKg: real("weight_kg").notNull(),
  reps: integer("reps").notNull(),
  rirActual: integer("rir_actual"),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})

// ---------------------------------------------------------------------------
// Schema object for drizzle relational API
// ---------------------------------------------------------------------------

export const schema = {
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
