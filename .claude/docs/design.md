# AI-powered personal workout app — design document

## Overview

A single-user, web-based strength training coach that generates and adapts structured programs based on goal, equipment, experience, and real performance data. The core loop is: **Generate → Execute → Log → Adapt → Repeat**.

The product should feel like a performance tool — authoritative, decisive, low-friction during workouts. Not a social app, not a gamified tracker.

---

## 1. System architecture

### Stack

| Layer           | Choice                                                    |
| --------------- | --------------------------------------------------------- |
| Runtime         | Node.js                                                   |
| Package manager | pnpm                                                      |
| Framework       | TanStack Start (Vite + TanStack Router)                   |
| Database        | Drizzle ORM + `better-sqlite3`                            |
| AI calls        | Anthropic SDK (Claude), called from server functions only |
| Client state    | Zustand (workout execution screen)                        |
| Testing         | Vitest                                                    |
| UI              | shadcn/ui + Tailwind CSS v4                               |
| Deployment      | Fly.io                                                    |

### Why this stack

TanStack Start runs on Vite and uses TanStack Router as its foundation — fully type-safe routes, type-safe search params, type-safe loaders. For navigation between onboarding → plan → session → feedback, that end-to-end type safety is genuinely useful and catches real bugs.

Server functions (`createServerFn`) replace a separate API layer for most calls. You define a function, call it directly from your component, and Start handles the client/server boundary. Because server functions run on the same server as the database, the AI orchestration path is: `DB → server function → LLM → DB` with no HTTP hop between.

`better-sqlite3` is synchronous, zero-config, and fast. For a single-user app with no concurrent writes there is no reason to reach for an async driver or a separate database process. Drizzle sits on top and keeps all queries type-safe.

Vitest has its own `vitest.config.ts` using happy-dom as the test environment. Setup file at `src/test/setup.ts` configures jest-dom matchers. Tests live next to the files they cover. The rule-based progression logic in `lib/rules.ts` is the code most worth unit testing; AI calls and DB interactions are covered with integration tests only.

shadcn/ui components are copied into `src/components/ui/` by the CLI — they are local source, not a package dependency. Tailwind CSS v4 is in use, with configuration in `src/styles.css` using `@import "tailwindcss"` syntax rather than `@tailwind` directives. Theme customization via CSS variables in `@theme` blocks, not `tailwind.config.js`.

### Configuration

TanStack Start uses `vite.config.ts` for configuration. Key plugins required:

```ts
// vite.config.ts
import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    tailwindcss(), // Tailwind CSS v4 support
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.test\\.", // Ignore test files
      },
    }),
    viteReact(),
  ],
})
```

**Critical**: Remove `verbatimModuleSyntax: true` from `tsconfig.json` to prevent server bundles from leaking into client builds.

### Data flow

```
Browser
  └── TanStack Router (file-based, type-safe routes)
        └── Server functions (createServerFn)
              ├── Drizzle + better-sqlite3  ← reads/writes
              └── ai.ts abstraction
                    └── Anthropic API (Claude)
```

The workout execution screen is the exception — it runs entirely in local Zustand state while a session is active. A server function is only called when committing a completed set to the database.

### File structure

```
src/
  routes/
    __root.tsx             — root layout with CSS import
    index.tsx              — dashboard (current week, next session)
    onboarding.tsx         — 5-screen onboarding flow (Phase 3+)
    session/$id.tsx        — workout execution (Phase 5+)
    plan.tsx               — program overview (read-only, Phase 4+)
    feedback/$id.tsx       — post-workout feedback (Phase 5+)
  functions/               — server functions (Phase 2+)
    generatePlan.ts        — server fn: calls AI, writes program to DB
    logSet.ts              — server fn: writes set_log row
    completeSession.ts     — server fn: writes workout_log, triggers progression check
    adaptWeek.ts           — server fn: weekly AI adaptation call
    swapExercise.ts        — server fn: on-demand exercise swap via AI
  components/
    ui/                    — shadcn components (6 installed: Button, Input, Card, Slider, Tabs, Progress)
  lib/
    utils.ts               — cn() helper for classnames
  test/
    setup.ts               — Vitest setup with jest-dom
    utils.tsx              — test utilities
  router.tsx               — router configuration
  routeTree.gen.ts         — auto-generated route tree
  styles.css               — Tailwind v4 CSS (uses @import "tailwindcss" syntax)
lib/                       — business logic (Phase 2+)
  db.ts                    — Drizzle + better-sqlite3 setup
  schema.ts                — Drizzle schema definitions
  ai.ts                    — Anthropic client abstraction (provider-swappable)
  rules.ts                 — rule-based progression logic (no AI)
  rules.test.ts            — Vitest unit tests for progression rules
  prompts.ts               — system prompts, one constant per AI call type
data/                      — static data (Phase 2+)
  exercises.ts             — seeded exercise library (~35 entries)
```

**Phase 1 Complete** (2026-04-06):

- TanStack Start initialized with TypeScript
- Tailwind CSS v4 configured with `@import` syntax
- shadcn/ui: Button, Input, Card, Slider, Tabs, Progress installed
- Vitest configured with happy-dom environment
- Core dependencies: Drizzle, better-sqlite3, Anthropic SDK, Zustand
- Directory structure created and ready for Phase 2

---

## 2. Core data models

Five tables for MVP. Everything else is v2.

### `user_profile`

One row, forever.

| Column               | Type        | Notes                                  |
| -------------------- | ----------- | -------------------------------------- |
| `id`                 | text PK     |                                        |
| `goal`               | text        | `strength \| hypertrophy \| both`      |
| `experience`         | text        | `beginner \| intermediate \| advanced` |
| `equipment`          | text (JSON) | array of equipment keys                |
| `sessions_per_week`  | integer     |                                        |
| `session_length_min` | integer     |                                        |
| `custom_directives`  | text        | verbatim from onboarding screen 5      |
| `units`              | text        | `kg \| lbs`                            |

### `program`

One active program at a time.

| Column              | Type    | Notes                              |
| ------------------- | ------- | ---------------------------------- |
| `id`                | text PK |                                    |
| `name`              | text    |                                    |
| `weeks_total`       | integer |                                    |
| `sessions_per_week` | integer |                                    |
| `status`            | text    | `active \| archived`               |
| `ai_rationale`      | text    | AI's explanation of program design |
| `created_at`        | integer | unix timestamp                     |

### `session_template`

A planned day within a week. Contains ordered `planned_exercises`.

| Column        | Type    | Notes                              |
| ------------- | ------- | ---------------------------------- |
| `id`          | text PK |                                    |
| `program_id`  | text FK |                                    |
| `week_number` | integer |                                    |
| `day_label`   | text    | e.g. "Upper A", "Lower B"          |
| `focus`       | text    | `strength \| hypertrophy \| mixed` |

### `planned_exercise`

The prescription for one exercise within a session.

| Column                | Type    | Notes                             |
| --------------------- | ------- | --------------------------------- |
| `id`                  | text PK |                                   |
| `session_template_id` | text FK |                                   |
| `exercise_id`         | text FK |                                   |
| `order_index`         | integer |                                   |
| `sets`                | integer |                                   |
| `rep_range`           | text    | e.g. "4–6", "8–12"                |
| `load_kg`             | real    | AI-estimated starting load        |
| `rir_target`          | integer | reps in reserve target            |
| `rest_seconds`        | integer |                                   |
| `coach_note`          | text    | AI's instruction shown in-session |

### `exercise`

Static library. Seeded at startup, no UI to manage in MVP.

| Column            | Type        | Notes                                                  |
| ----------------- | ----------- | ------------------------------------------------------ |
| `id`              | text PK     |                                                        |
| `name`            | text        |                                                        |
| `movement`        | text        | `squat \| hinge \| push \| pull \| carry \| isolation` |
| `primary_muscles` | text (JSON) |                                                        |
| `equipment`       | text (JSON) |                                                        |

Start with ~35 entries covering all movement patterns. No search UI, no category browser in MVP.

### `workout_log`

A completed session.

| Column                | Type    | Notes    |
| --------------------- | ------- | -------- |
| `id`                  | text PK |          |
| `session_template_id` | text FK |          |
| `started_at`          | integer |          |
| `completed_at`        | integer |          |
| `fatigue_rating`      | integer | 1–5      |
| `notes`               | text    | optional |

### `set_log`

The raw performance data. This table feeds the adaptation system.

| Column                | Type    | Notes |
| --------------------- | ------- | ----- |
| `id`                  | text PK |       |
| `workout_log_id`      | text FK |       |
| `planned_exercise_id` | text FK |       |
| `set_number`          | integer |       |
| `weight_kg`           | real    |       |
| `reps`                | integer |       |
| `rir_actual`          | integer |       |
| `logged_at`           | integer |       |

### Schema note

Include a `user_id` column on every table from day one, even though this is a single-user app. Adding auth later is trivial if the column exists. Migrating it in later is painful.

---

## 3. Onboarding flow

Five screens. Target completion under 90 seconds. No back-button anxiety, no walls of text.

### Screen 1 — Goal

Two or three large tap targets. This single answer shapes every downstream AI decision.

- **Build strength** — 1–5 rep focus, heavy compounds, longer rests
- **Build muscle** — 6–15 rep focus, moderate load, higher volume
- **Both** — periodized mix, alternating emphasis blocks

### Screen 2 — Experience

Three options with concrete descriptions, not just labels.

- **Under 1 year** — still learning movement patterns
- **1–3 years** — consistent training, know the basics
- **3+ years** — comfortable with RPE, understand progressive overload

### Screen 3 — Equipment

Chip multi-select, pre-grouped. Pre-check the most common setup and let the user uncheck — faster than starting empty.

- Barbell + rack
- Dumbbells
- Bench
- Cable machine
- Leg press
- Bodyweight only

This prevents the AI from prescribing exercises the user cannot do.

### Screen 4 — Schedule

Two pickers, displayed visually not as dropdowns.

- Days per week: 3 / 4 / 5 / 6 (shown as calendar dots)
- Session length: 45 / 60 / 90 min

### Screen 5 — Anything else?

Optional textarea. Placeholder: _"injuries, things you hate, preferences."_ Skip button is prominent. This text goes verbatim into the AI prompt as `custom_directives`.

### Post-onboarding

Full-screen loading state ("Building your program…") while the AI call runs. Then a **plan preview screen** showing:

- Week structure at a glance
- Key lifts for each session type
- The AI's rationale in 2–3 sentences

One primary CTA: "Looks good, start training." One secondary action: "Regenerate" (allowed once).

---

## 4. AI system design

The most important design decision is knowing when _not_ to call AI.

### What stays rule-based (always)

These are deterministic, fast, and explainable. Do not give AI the job of deciding them.

- **Rest timer** — just a countdown
- **Load increment logic** — if all reps hit the upper bound of the rep range AND RIR ≥ target, add 2.5 kg next session. This is a rule, not an AI judgment call.
- **Deload detection** — trigger at week 4 or 5, or if fatigue rating ≥ 4 on two consecutive sessions
- **Exercise ordering** — compounds before isolations, always
- **Set and rep counting** — purely mechanical
- **Pass/fail per set** — simple threshold math against the rep range and RIR target

### What AI handles (three calls only)

**1. Plan generation** — called once at onboarding. Input is the full user profile. Output is a complete JSON program: all weeks, sessions, exercises, sets, reps, loads, rest times, and a `coach_note` per exercise explaining why it was chosen and how to execute it. Use structured output with a JSON schema — the AI must return exactly the shape the database expects. If it fails validation, retry once with the error injected into the prompt. Store the raw output and the `ai_rationale` alongside the plan.

**2. Weekly adaptation** — called once per week, after the final session completes. Input is: the planned week, every `set_log` row from that week, fatigue ratings, any notes. Output is a diff — specific changes to the next week's sessions with a `reasoning` field per change. Store both the diff and the reasoning. Show the reasoning before the week begins: _"Coach adjusted: reduced squat volume because fatigue was high and reps dropped in sets 3–4."_ This call is deferred until week 2 — you need real data first.

**3. Exercise swap** — called on demand when tapping "swap this exercise." Input is the exercise being replaced, available equipment, and the session context. Output is 2–3 ranked alternatives. Fast, focused, and cheap.

### Keeping behavior predictable

- Always return `reasoning` alongside every AI decision
- Log every AI call with its full input and output to an `ai_call_log` table
- Version system prompts as constants in the codebase — change them deliberately
- Never stream AI responses directly into the UI without validating JSON first
- For adaptation, show a diff preview before applying — allow manual override
- Pre-generate `coach_note` per exercise at plan creation time. Never make a live AI call between sets while the rest timer is running.

### On provider choice

Use `claude-sonnet-4-6` for plan generation and adaptation — it handles the nuanced reasoning about periodization, exercise selection, and fatigue interpretation well. For the exercise swap call, either Claude or GPT-4o works.

Keep all AI calls behind a single `ai.ts` abstraction so the provider can be swapped per call type without touching business logic.

```ts
// lib/ai.ts
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function generatePlan(prompt: string) {
  return client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  })
}
```

---

## 5. MVP scope

Cut everything that doesn't support a complete training session.

### In MVP

- Onboarding (5 screens) → AI-generated 4-week program
- Dashboard: current week's sessions, which is next
- Workout execution: one exercise at a time, current set highlighted, weight/reps/RIR input, rest timer, next set preview
- Set logging: large number inputs, minimal typing
- Post-workout: fatigue slider (1–5) + optional text note
- Plan view: read-only week and session overview
- Rule-based load progression (computed after each session)

### Explicitly deferred

- Adaptation system (log for 2 weeks first, then build)
- Exercise swap UI
- Progress charts and history graphs
- Soreness mapping
- Program management (archive, regenerate after initial)
- Any settings UI beyond onboarding

The adaptation loop in MVP is a manual "Suggest adjustments for next week" button. You tap it, it runs the AI call, you see the diff and approve it. Automated triggering comes in v2 once the logic is trusted.

---

## 6. Development plan

### Phase 1 — Foundation ✅ COMPLETE

TanStack Start project initialized. pnpm as package manager. Vitest configured with happy-dom. shadcn/ui components installed (Button, Input, Card, Slider, Tabs, Progress). Tailwind CSS v4 configured with `@import` syntax. Core dependencies installed (Drizzle, better-sqlite3, Anthropic SDK, Zustand). Directory structure created. TypeScript optimized (removed `verbatimModuleSyntax`). Tests passing.

Status: ✅ Ready for Phase 2

### Phase 2 — Database Setup (Next)

Drizzle schema definition in `lib/schema.ts`. Database initialization in `lib/db.ts`. Exercise library seeded from `data/exercises.ts` (~35 exercises). Database migrations. Basic routing structure. No AI yet.

### Phase 3 — Onboarding UI

5-screen onboarding flow that saves to DB. Form validation. Equipment multi-select. Schedule pickers. Custom directives textarea. Plan preview screen with hardcoded dummy data to validate the layout.

### Phase 4 — AI plan generation

Write the system prompt. Define the JSON output schema. Build the `generatePlan` server function that calls Claude and stores the parsed plan. Connect onboarding to real plan generation. Add the plan view screen pulling from DB.

### Phase 5 — Workout execution

The hardest screen. Session page with exercise-by-exercise flow, set logging inputs, rest timer (CSS countdown, Zustand state), "finish workout" that writes `workout_log` and all `set_log` rows. Post-workout feedback screen.

### Phase 6 — Real usage

Go train. Identify the three most annoying UX friction points. Fix those. Mobile polish: safe area insets, large tap targets, no tiny inputs. Deploy to Fly.io so it works on your phone.

### Phase 7 — Rule-based progression

After each session, compute which exercises passed the progression threshold and flag the load for next session. Show: _"Based on today — next session: Squat → 102.5 kg."_

### Phase 8 — Adaptation

Now there is real data. Build the weekly adaptation AI call. Start with a manual trigger button. Evaluate the output quality against actual training experience. Tune the prompt. Only automate once the output is trusted.

---

## 7. Pitfalls and overengineering risks

**Building adaptation before having data.** The adaptation system is useless without several weeks of real logs. If built in week 1 it will be tested with fake data and will not behave as expected with real fatigue and real missed reps. Log first, adapt later.

**Over-designing the exercise library.** You don't need 200 exercises, category trees, muscle diagrams, or a search UI. You need 35 well-chosen exercises that cover every movement pattern. Put them in a seed file. Build a library UI in v3, if ever.

**AI in the hot path during a set.** Never make a live AI call between sets. The rest timer is running. Any AI coaching shown in-session must be pre-generated (the `coach_note` field from plan generation) or triggered manually. Pre-generating it at plan creation time is the correct approach.

**Complex state management for workout execution.** The session screen has a lot of state — current exercise index, current set number, timer state, logged sets, rest phase vs active phase. All of this is local and transient. Use Zustand with a clear state machine shape. Do not put it in the DB until a set is logged. Do not use server state for something that should be purely local.

**Skipping the `user_id` column.** For a personal tool, no auth is correct for now. But design the schema with a `user_id` on every table from day one. Adding auth later is trivial if the column exists — it is a painful migration if it doesn't.

**Hiding the AI's reasoning.** The temptation is to surface only the output ("Your program is ready"). Showing 2–3 sentences of rationale per decision — why this exercise, why this rep range, why the volume changed — is what makes the tool feel like a coach rather than a random number generator. That transparency is a feature, not a technical footnote.

**Scope-creeping into a native app before the core loop works.** The responsive web version works fine in the gym. Don't start thinking about native mobile until you have completed the Generate → Execute → Log loop at least 8–10 times with real workouts and identified what actually needs to improve.
