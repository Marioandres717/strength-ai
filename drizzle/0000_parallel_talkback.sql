CREATE TABLE `exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`movement` text NOT NULL,
	`primary_muscles` text NOT NULL,
	`equipment` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `planned_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`session_template_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`sets` integer NOT NULL,
	`rep_range` text NOT NULL,
	`load_kg` real NOT NULL,
	`rir_target` integer NOT NULL,
	`rest_seconds` integer NOT NULL,
	`coach_note` text,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`session_template_id`) REFERENCES `session_template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`weeks_total` integer NOT NULL,
	`sessions_per_week` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`ai_rationale` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_template` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`day_label` text NOT NULL,
	`focus` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `set_log` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_log_id` text NOT NULL,
	`planned_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`rir_actual` integer,
	`logged_at` integer NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workout_log_id`) REFERENCES `workout_log`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planned_exercise_id`) REFERENCES `planned_exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`goal` text NOT NULL,
	`experience` text NOT NULL,
	`equipment` text NOT NULL,
	`sessions_per_week` integer NOT NULL,
	`session_length_min` integer NOT NULL,
	`custom_directives` text,
	`units` text DEFAULT 'kg' NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_template_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`fatigue_rating` integer,
	`notes` text,
	`user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`session_template_id`) REFERENCES `session_template`(`id`) ON UPDATE no action ON DELETE no action
);
