# Workout app

AI-powered personal strength training coach built for a single user.
Generates structured multi-week programs and adapts them based on real
performance data. The core loop is: Generate → Execute → Log → Adapt → Repeat.

The product must feel like a performance tool — authoritative, decisive,
and low-friction. Not a social app, not a gamified tracker.

The workout execution screen is the heart of the app. It must be usable
mid-set: large inputs, minimal typing, no waiting, one primary action
at a time.

---

## What the AI does

- Generates a complete training program once at onboarding — result is stored in DB, not recomputed
- Adapts the next week after the last session of a week completes — one call, result stored as a diff
- Suggests exercise swaps on demand — lightweight, on request only

The AI is never called live during a workout session. The rest timer is
running and the user is between sets. All coaching shown in-session is
pre-generated (the `coach_note` field on `planned_exercise`) or triggered
manually outside the session screen.

All AI calls go through `lib/ai.ts`. Never call the Anthropic SDK directly
in routes or components.

---

## Stack

| Layer           | Choice                                  |
| --------------- | --------------------------------------- |
| Runtime         | Node.js                                 |
| Package manager | pnpm                                    |
| Framework       | TanStack Start (Vite + TanStack Router) |
| Database        | Drizzle ORM + better-sqlite3            |
| AI              | Anthropic SDK — `claude-sonnet-4-6`     |
| Client state    | Zustand (workout execution screen only) |
| Testing         | Vitest                                  |
| UI              | shadcn/ui + Tailwind CSS v4             |
| Deployment      | Fly.io                                  |

### Important UI notes

shadcn components live in `components/ui/` — they are local source copied
by the CLI, not an installable package. Do not import from a `shadcn`
package. Do not run `pnpm add shadcn`. Edit the files in `components/ui/`
directly when customisation is needed.

Tailwind CSS v4 is in use. Configuration lives in `src/styles.css` — there is no
`tailwind.config.js`. Use `@import "tailwindcss"` syntax, not `@tailwind` directives.
Theme customization uses CSS variables in `@theme` blocks, not JS config.

### Package manager

Use pnpm exclusively. Never suggest npm or yarn commands.

```bash
# Installation
pnpm install

# Adding dependencies
pnpm add <package>
pnpm add -D <package>

# Development commands
pnpm dev              # Start dev server on http://localhost:3000
pnpm build            # Build for production
pnpm preview          # Preview production build

# Testing
pnpm test             # Run tests in watch mode
pnpm test:ui          # Run tests with UI
pnpm test:coverage    # Run tests with coverage report
```

### Testing

Vitest is the test runner. Config lives in `vitest.config.ts` with happy-dom
as the test environment. Setup file is at `src/test/setup.ts`. Tests live next
to the files they test (`lib/rules.test.ts` alongside `lib/rules.ts`).

Test utilities are in `src/test/utils.tsx` for reusable render helpers.

Focus tests on the rule-based progression logic in `lib/rules.ts` — that
is the code most worth unit testing. AI calls and DB interactions are
tested with integration tests only, not mocked unit tests.

---

## Architecture rules

- All AI calls go through `lib/ai.ts` — never call the Anthropic SDK directly elsewhere
- All DB access goes through Drizzle — no raw SQL strings
- Server functions live in `src/functions/` — one file per operation
- Zustand is used for local transient state on the session screen only — not for server data
- Server functions are for mutations and data loading — not for managing UI state like timers
- Never put active session state (current exercise index, timer, logged sets) in the DB until a set is committed

### Code quality

- All code must pass ESLint checks before commit — run `pnpm lint` to verify
- Format all files with Prettier before commit — format-on-save is enabled in VS Code
- Pre-commit hooks automatically lint and format staged files
- TypeScript strict mode is enforced — no `@ts-ignore` or `any` without explicit justification
- Use `type` imports for types: `import type { Foo } from './foo'`
- Unused variables are warnings — prefix with underscore if intentional: `const _unused = foo()`

Run `pnpm validate` before pushing to verify: TypeScript compiles, ESLint passes, Prettier formatted, tests pass.

### Linting rules

- ESLint flat config (`eslint.config.js`) — not legacy `.eslintrc`
- React 19 rules enabled via `eslint-plugin-react` and `eslint-plugin-react-hooks`
- TanStack Query rules for data fetching patterns
- Tailwind CSS class ordering enforced by `eslint-plugin-tailwindcss`
- Testing Library and Vitest rules for test files
- Console statements (`console.log`) trigger warnings — use `console.warn` or `console.error` only
- TypeScript strict type-checking rules enabled

---

## Database rules

- `better-sqlite3` via Drizzle — synchronous, no connection pooling needed for single-user
- Do not suggest Postgres, Turso, or any other DB
- Every table has a `user_id` column — the app is single-user now but auth may be added later
- Schema is defined in `lib/schema.ts` via Drizzle

---

## File structure

```
src/
  routes/
    __root.tsx             — root layout with CSS import
    index.tsx              — dashboard (current week, next session)
    onboarding.tsx         — 5-screen onboarding flow (to be built)
    session/$id.tsx        — workout execution (heart of the app, to be built)
    plan.tsx               — program overview, read-only (to be built)
    feedback/$id.tsx       — post-workout feedback (to be built)
  functions/               — server functions (empty, Phase 2+)
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
    utils.tsx              — test utilities (custom render)
  router.tsx               — router configuration
  routeTree.gen.ts         — auto-generated route tree
  styles.css               — Tailwind v4 CSS (uses @import syntax)
lib/                       — business logic (empty, Phase 2+)
  db.ts                    — Drizzle + better-sqlite3 setup
  schema.ts                — Drizzle schema definitions
  ai.ts                    — Anthropic client abstraction
  rules.ts                 — rule-based progression logic (no AI)
  rules.test.ts            — Vitest unit tests for progression rules
  prompts.ts               — system prompts, one constant per AI call type
data/                      — static data (empty, Phase 2+)
  exercises.ts             — seeded exercise library (~35 entries, no UI to manage)
```

**Phase 1 Status**: ✅ Complete

- TanStack Start initialized with TypeScript
- Tailwind CSS v4 configured
- shadcn/ui components installed (Button, Input, Card, Slider, Tabs, Progress)
- Vitest configured with happy-dom
- Core dependencies installed (Drizzle, better-sqlite3, Anthropic SDK, Zustand)
- Directory structure created

---

## Data models

### user_profile

```
id                text PK
goal              text       -- strength | hypertrophy | both
experience        text       -- beginner | intermediate | advanced
equipment         text       -- JSON array of equipment keys
sessions_per_week integer
session_length_min integer
custom_directives text       -- verbatim from onboarding, passed to AI
units             text       -- kg | lbs
user_id           text
```

### program

```
id                text PK
name              text
weeks_total       integer
sessions_per_week integer
status            text       -- active | archived
ai_rationale      text       -- AI's explanation of program design, shown to user
created_at        integer    -- unix timestamp
user_id           text
```

### session_template

```
id                text PK
program_id        text FK
week_number       integer
day_label         text       -- e.g. "Upper A", "Lower B"
focus             text       -- strength | hypertrophy | mixed
user_id           text
```

### planned_exercise

```
id                   text PK
session_template_id  text FK
exercise_id          text FK
order_index          integer
sets                 integer
rep_range            text    -- e.g. "4–6", "8–12"
load_kg              real    -- AI-estimated starting load
rir_target           integer -- reps in reserve target
rest_seconds         integer
coach_note           text    -- pre-generated AI instruction shown in-session
user_id              text
```

### exercise

```
id               text PK
name             text
movement         text    -- squat | hinge | push | pull | carry | isolation
primary_muscles  text    -- JSON array
equipment        text    -- JSON array
```

### workout_log

```
id                   text PK
session_template_id  text FK
started_at           integer
completed_at         integer
fatigue_rating       integer  -- 1–5, collected post-workout
notes                text
user_id              text
```

### set_log

```
id                   text PK
workout_log_id       text FK
planned_exercise_id  text FK
set_number           integer
weight_kg            real
reps                 integer
rir_actual           integer
logged_at            integer
user_id              text
```

---

## Progression logic (rule-based, no AI)

Lives in `lib/rules.ts`. Runs after each session completes.

- If all reps in every set hit the upper bound of the rep range AND average RIR ≥ target → add 2.5 kg to `load_kg` for next session
- If fatigue rating ≥ 4 on two consecutive sessions → flag for deload
- Deload triggers at week 4 or 5 regardless of performance
- Exercise ordering: compounds always before isolations

These are rules, not AI judgments. Do not route these decisions through the AI.
Unit tests for all progression rules live in `lib/rules.test.ts`.

---

## AI system prompts

System prompts live as named constants in `lib/prompts.ts`. Treat changes
to these like changes to business logic — deliberate, not casual. Each
prompt is scoped to exactly one call type.

```
PLAN_GENERATION_PROMPT   — used in generatePlan.ts
ADAPTATION_PROMPT        — used in adaptWeek.ts
SWAP_PROMPT              — used in swapExercise.ts
```

Every AI response must include a `reasoning` field explaining the decisions
made. This is shown to the user — it is a product feature, not a debug tool.

---

## MVP scope

### In scope

- Onboarding (5 screens) → AI-generated 4-week program
- Dashboard: current week, next session
- Workout execution: one exercise at a time, set logging, rest timer
- Post-workout: fatigue rating + optional note
- Plan view: read-only week and session overview
- Rule-based load progression after each session

### Out of scope (do not build)

- Progress charts or history graphs
- Soreness mapping
- Exercise library UI or search
- Program management (archive, regenerate)
- Settings screen
- Any form of auth or multi-user support
- Native mobile — responsive web only

---

## Reference

Full design document with rationale for all decisions: `.claude/docs/design.md`
