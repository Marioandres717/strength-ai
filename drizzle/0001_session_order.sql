ALTER TABLE `session_template` ADD `order_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `session_template` SET `order_index` = (
  SELECT count(*) FROM `session_template` AS earlier
  WHERE earlier.`program_id` = `session_template`.`program_id`
    AND earlier.`week_number` = `session_template`.`week_number`
    AND (earlier.`created_at` < `session_template`.`created_at`
      OR (earlier.`created_at` = `session_template`.`created_at` AND earlier.rowid < `session_template`.rowid))
);
