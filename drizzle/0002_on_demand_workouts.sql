CREATE TABLE `on_demand_workout` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_request_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`deleted_at` integer,
	`user_id` text,
	FOREIGN KEY (`generation_request_id`) REFERENCES `on_demand_workout_generation_request`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `on_demand_workout_request` ON `on_demand_workout` (`generation_request_id`);--> statement-breakpoint
CREATE INDEX `on_demand_workout_library` ON `on_demand_workout` (`user_id`,`deleted_at`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `on_demand_workout_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`on_demand_workout_revision_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`sets` integer NOT NULL,
	`rep_range` text NOT NULL,
	`load_kg` real NOT NULL,
	`load_basis` text NOT NULL,
	`load_history_at` integer,
	`rir_target` integer NOT NULL,
	`rest_seconds` integer NOT NULL,
	`coach_note` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`user_id` text,
	FOREIGN KEY (`on_demand_workout_revision_id`) REFERENCES `on_demand_workout_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "on_demand_order" CHECK("on_demand_workout_exercise"."order_index" >= 0),
	CONSTRAINT "on_demand_sets" CHECK("on_demand_workout_exercise"."sets" between 1 and 10),
	CONSTRAINT "on_demand_load" CHECK("on_demand_workout_exercise"."load_kg" between 0 and 500),
	CONSTRAINT "on_demand_rir" CHECK("on_demand_workout_exercise"."rir_target" between 0 and 5),
	CONSTRAINT "on_demand_rest" CHECK("on_demand_workout_exercise"."rest_seconds" between 30 and 600),
	CONSTRAINT "on_demand_load_basis" CHECK("on_demand_workout_exercise"."load_basis" in ('history','conservative_estimate','bodyweight'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `on_demand_exercise_order` ON `on_demand_workout_exercise` (`on_demand_workout_revision_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `on_demand_exercise_history` ON `on_demand_workout_exercise` (`exercise_id`,`on_demand_workout_revision_id`);--> statement-breakpoint
CREATE TABLE `on_demand_workout_generation_request` (
	`id` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`input` text NOT NULL,
	`context` text NOT NULL,
	`status` text NOT NULL,
	`quota_day` text NOT NULL,
	`call_started_at` integer,
	`error_code` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text,
	CONSTRAINT "on_demand_request_status" CHECK("on_demand_workout_generation_request"."status" in ('reserved','calling','save_pending','saved','failed','unknown'))
);
--> statement-breakpoint
CREATE INDEX `on_demand_request_quota` ON `on_demand_workout_generation_request` (`user_id`,`quota_day`,`created_at`);--> statement-breakpoint
CREATE TABLE `on_demand_workout_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`on_demand_workout_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`constraints` text NOT NULL,
	`focus` text NOT NULL,
	`estimated_duration_seconds` integer NOT NULL,
	`reasoning` text NOT NULL,
	`edit_kind` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`user_id` text,
	FOREIGN KEY (`on_demand_workout_id`) REFERENCES `on_demand_workout`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "on_demand_revision_positive" CHECK("on_demand_workout_revision"."revision_number" >= 1),
	CONSTRAINT "on_demand_duration_positive" CHECK("on_demand_workout_revision"."estimated_duration_seconds" > 0),
	CONSTRAINT "on_demand_focus" CHECK("on_demand_workout_revision"."focus" in ('strength','hypertrophy','mixed')),
	CONSTRAINT "on_demand_edit_kind" CHECK("on_demand_workout_revision"."edit_kind" in ('generated','preview_edit'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `on_demand_revision_number` ON `on_demand_workout_revision` (`on_demand_workout_id`,`revision_number`);--> statement-breakpoint
CREATE TABLE `__new_set_log` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_log_id` text NOT NULL,
	`planned_exercise_id` text,
	`on_demand_workout_exercise_id` text,
	`set_number` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`rir_actual` integer,
	`logged_at` integer NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workout_log_id`) REFERENCES `workout_log`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planned_exercise_id`) REFERENCES `planned_exercise`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`on_demand_workout_exercise_id`) REFERENCES `on_demand_workout_exercise`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "set_log_exactly_one_source" CHECK(("__new_set_log"."planned_exercise_id" is not null and "__new_set_log"."on_demand_workout_exercise_id" is null) or ("__new_set_log"."planned_exercise_id" is null and "__new_set_log"."on_demand_workout_exercise_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_set_log`("id", "workout_log_id", "planned_exercise_id", "on_demand_workout_exercise_id", "set_number", "weight_kg", "reps", "rir_actual", "logged_at", "user_id", "created_at") SELECT "id", "workout_log_id", "planned_exercise_id", NULL, "set_number", "weight_kg", "reps", "rir_actual", "logged_at", "user_id", "created_at" FROM `set_log`;--> statement-breakpoint
CREATE TABLE `__new_workout_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_template_id` text,
	`on_demand_workout_revision_id` text,
	`run_snapshot` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`fatigue_rating` integer,
	`notes` text,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`session_template_id`) REFERENCES `session_template`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`on_demand_workout_revision_id`) REFERENCES `on_demand_workout_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "workout_log_exactly_one_source" CHECK(("__new_workout_log"."session_template_id" is not null and "__new_workout_log"."on_demand_workout_revision_id" is null) or ("__new_workout_log"."session_template_id" is null and "__new_workout_log"."on_demand_workout_revision_id" is not null)),
	CONSTRAINT "workout_log_on_demand_workout_snapshot" CHECK(("__new_workout_log"."on_demand_workout_revision_id" is null and "__new_workout_log"."run_snapshot" is null) or ("__new_workout_log"."on_demand_workout_revision_id" is not null and "__new_workout_log"."run_snapshot" is not null and json_valid("__new_workout_log"."run_snapshot")))
);
--> statement-breakpoint
INSERT INTO `__new_workout_log`("id", "session_template_id", "on_demand_workout_revision_id", "run_snapshot", "started_at", "completed_at", "fatigue_rating", "notes", "user_id", "created_at") SELECT "id", "session_template_id", NULL, NULL, "started_at", "completed_at", "fatigue_rating", "notes", "user_id", "created_at" FROM `workout_log`;--> statement-breakpoint
DROP TABLE `set_log`;--> statement-breakpoint
DROP TABLE `workout_log`;--> statement-breakpoint
ALTER TABLE `__new_workout_log` RENAME TO `workout_log`;--> statement-breakpoint
ALTER TABLE `__new_set_log` RENAME TO `set_log`;--> statement-breakpoint
CREATE INDEX `set_log_workout` ON `set_log` (`workout_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `set_log_on_demand_key` ON `set_log` (`workout_log_id`,`on_demand_workout_exercise_id`,`set_number`) WHERE "set_log"."on_demand_workout_exercise_id" is not null;--> statement-breakpoint

CREATE INDEX `workout_planned_started` ON `workout_log` (`session_template_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `workout_on_demand_completed` ON `workout_log` (`on_demand_workout_revision_id`,`completed_at`);
--> statement-breakpoint
CREATE TABLE __migration_integrity_assertion (violations integer NOT NULL CHECK (violations = 0));
--> statement-breakpoint
INSERT INTO __migration_integrity_assertion SELECT count(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
INSERT INTO __migration_integrity_assertion SELECT count(*) FROM pragma_integrity_check WHERE integrity_check <> 'ok';
--> statement-breakpoint
DROP TABLE __migration_integrity_assertion;
