# On-demand workout operation

The library is at `/on-demand-workouts`. Generation uses AI_PROVIDER and its configured model: Anthropic/OpenAI require their respective key; Ollama requires no cloud key. See [local setup](local-ollama.md). The default is five dispatched attempts per server application day, controlled by `ON_DEMAND_WORKOUT_DAILY_CAP` and `APP_TIMEZONE` (default `America/Regina`). Dispatched failures count; polling and retrying a save do not. Repeating a request ID never dispatches another model call. Regeneration creates another library entry.

## Prepare a device for offline training

Open the library or a workout preview online over the existing HTTPS Tailscale origin (localhost also works). Wait for **Available offline on this device**. This requires both the full workout definition and the service worker's complete application shell; a library title alone is insufficient. The first visit requires a connection.

Start, set logging, completion, feedback, and library deletion are saved locally first. **Saved on this device; sync pending** means SQLite has not acknowledged all commands. Keep the app open after reconnecting, or use **Retry sync**, until it says **All workouts synced**. A conflicting run remains stored for retry; correct the device clock if indicated. Offline edits and generation require reconnecting; generation is never queued to run later.

Browser storage is per origin. Sync every device before switching host URLs or handing the database to another computer. Clearing site data or browser eviction can remove unsynced workouts. The app requests persistent storage where supported. Available updates wait for a later launch; finish the run, sync, then close all tabs to apply one. Existing shell caches and IndexedDB commands are retained through upgrades.

## Generation recovery

Requests are retained on the server and shown under **Recent requests**, so a lost browser response does not require another paid attempt. A valid response is flushed to a private UUID-named recovery receipt beside `DATABASE_PATH`, in `on-demand-workout-recovery/`, before database finalization. **Retry save without generating** revalidates that receipt and retries only the database transaction. Startup reconciles receipts before resolving interrupted requests. Invalid or over-duration output is never published as a runnable workout.

An interrupted provider call with no durable receipt becomes **unknown** after restart. It is never dispatched again automatically. The provider-to-first-durable-write crash window cannot be made atomic with local SQLite; simultaneous database/recovery-volume failure can still lose output.

## Upgrade and rollback

Stop application writers. Make a verified backup with `pnpm db:backup`, and rehearse `pnpm db:migrate` on a copy configured through `DATABASE_PATH`. Migration `0002_on_demand_workouts.sql` rebuilds only the two log tables, preserving original identifiers, business values, timestamps, ownership nulls, and duplicate planned-set rows. The production runner disables foreign keys outside Drizzle's migration transaction, performs transactional integrity assertions, rechecks integrity, and restores enforcement before serving requests. A failed assertion rolls back the migration and its ledger entry.

Deploy schema and application together. Do not run an old binary against a database containing on-demand workouts. To roll back, stop writers and restore the verified pre-upgrade database before restarting the old application.

Backups now copy recovery receipts into `<backup>.db.recovery/` alongside the database and checksum. Include that directory in encrypted backups and computer handoffs; a database-only copy omits unfinalized paid output. With the destination stopped, restore it as `runtime-data/on-demand-workout-recovery/` beside `strength.db`. Keep only one active database host. Sync phone/browser outboxes before the final source backup.

## Verification

`pnpm validate` runs type checking, lint, formatting and Vitest. Migration tests use file-backed databases and verify preservation, integrity, rollback, and repeated startup. Generation integrations mock the Anthropic client while using real migrated SQLite. Browser coverage in `e2e/on-demand-workouts.spec.ts` exercises production-shell cold offline launch, rest/resume, completion/feedback, tombstone replay, source isolation and failed device writes. Run `pnpm build` and `pnpm exec playwright test --grep-invert @visual` for production regression coverage.

`RUN_ON_DEMAND_AI_SMOKE=1` enables the separate opt-in live schema smoke test in `lib/onDemandWorkout.live.test.ts`; it makes one paid Anthropic call using ANTHROPIC_MODEL (Sonnet by default). Normal tests do not call a live provider.
