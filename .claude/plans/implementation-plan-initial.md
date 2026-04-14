# Strength AI - Implementation Plan

AI-powered personal strength training coach. Greenfield project - all code to be built from scratch.

---

## Phase 1: Project Foundation

### 1.1 Initialize TanStack Start Project

- Initialize with `pnpm create @tanstack/start`
- Configure `app.config.ts` with Node.js server preset
- Set up TypeScript configuration
- Configure Tailwind CSS v4 in `app.css` (no tailwind.config.js)

### 1.2 Install Dependencies

```bash
pnpm add drizzle-orm better-sqlite3 @anthropic-ai/sdk zustand
pnpm add -D drizzle-kit @types/better-sqlite3 vitest
```

### 1.3 Set up shadcn/ui

- Initialize shadcn with CLI
- Add core components: Button, Input, Card, Slider, Tabs, Progress

### 1.4 Create Directory Structure

```
app/
  routes/
  functions/
lib/
data/
components/ui/
```

**Files to create:**

- `app.config.ts` - TanStack Start config (node-server preset)
- `app.css` - Tailwind v4 config
- `.env.example` - Environment template (ANTHROPIC_API_KEY)

---

## Phase 2: Database Layer

### 2.1 Create Schema (`lib/schema.ts`)

8 tables with `user_id` column on each:

- `user_profile` - goal, experience, equipment, schedule, custom_directives, units
- `program` - name, weeks_total, sessions_per_week, status, ai_rationale
- `session_template` - program_id, week_number, day_label, focus
- `planned_exercise` - session_template_id, exercise_id, order_index, sets, rep_range, load_kg, rir_target, rest_seconds, coach_note
- `exercise` - name, movement, primary_muscles (JSON), equipment (JSON)
- `workout_log` - session_template_id, started_at, completed_at, fatigue_rating, notes
- `set_log` - workout_log_id, planned_exercise_id, set_number, weight_kg, reps, rir_actual, logged_at

### 2.2 Database Setup (`lib/db.ts`)

- Initialize Drizzle with better-sqlite3
- Synchronous, no connection pooling needed

### 2.3 Seed Exercise Library (`data/exercises.ts`)

~35 exercises covering all movement patterns:

- Squat: Back squat, Front squat, Goblet squat, Leg press, Bulgarian split squat
- Hinge: Deadlift, Romanian deadlift, Hip thrust, Good morning
- Push: Bench press, Incline press, OHP, Dumbbell press, Dips, Push-ups
- Pull: Pull-ups, Barbell row, Cable row, Lat pulldown, Face pulls
- Isolation: Curls, Tricep extensions, Lateral raises, Leg curls, Leg extensions

---

## Phase 3: AI Integration

### 3.1 AI Abstraction (`lib/ai.ts`)

- Initialize Anthropic client
- Export typed functions for each AI call type
- Never call Anthropic SDK directly elsewhere

### 3.2 System Prompts (`lib/prompts.ts`)

Three prompt constants:

- `PLAN_GENERATION_PROMPT` - Full program generation with JSON schema
- `ADAPTATION_PROMPT` - Weekly adaptation with diff output
- `SWAP_PROMPT` - Exercise alternatives

### 3.3 JSON Schema for Plan Generation

Define strict schema for AI output:

- Program metadata (name, rationale)
- Weeks array with sessions
- Sessions with exercises (including coach_note per exercise)

---

## Phase 4: Onboarding Flow

### 4.1 Route: `app/routes/onboarding.tsx`

5-screen wizard (target: under 90 seconds):

**Screen 1 - Goal:**

- Build strength (1-5 reps, heavy compounds)
- Build muscle (6-15 reps, higher volume)
- Both (periodized mix)

**Screen 2 - Experience:**

- Under 1 year (beginner)
- 1-3 years (intermediate)
- 3+ years (advanced)

**Screen 3 - Equipment:**

- Multi-select chips (pre-checked common setup)
- Barbell+rack, Dumbbells, Bench, Cable machine, Leg press, Bodyweight

**Screen 4 - Schedule:**

- Days per week: 3/4/5/6
- Session length: 45/60/90 min

**Screen 5 - Custom Directives:**

- Optional textarea (injuries, preferences)
- Skip button prominent

### 4.2 Server Function: `app/functions/generatePlan.ts`

- Receives user profile
- Calls AI with PLAN_GENERATION_PROMPT
- Validates JSON response against schema
- Writes user_profile, program, session_templates, planned_exercises to DB
- Returns program ID

### 4.3 Post-Onboarding Plan Preview

- Full-screen loading ("Building your program...")
- Show week structure, key lifts, AI rationale
- CTA: "Start training"
- Secondary: "Regenerate" (allowed once)

---

## Phase 5: Dashboard ✅ COMPLETE

### 5.1 Route: `src/routes/index.tsx` ✅

- Current week overview
- Next session card (prominent)
- Session list for the week with completion status
- Link to plan view

### 5.2 Dashboard Components ✅

**Main Orchestrator:**
- `src/components/DashboardPage.tsx` — handles three states (no_profile, no_program, active) with conditional UI

**Sub-components:**
- `src/components/dashboard/ProgramHeader.tsx` — program name, AI rationale, week progress
- `src/components/dashboard/NextSessionCard.tsx` — next session details, exercise preview, focus label
- `src/components/dashboard/WeekGrid.tsx` — session status grid (completed, next, missed, upcoming) with focus labels
- `src/components/dashboard/WeekProgressBar.tsx` — visual progress indicator
- `src/components/dashboard/ProgramFooter.tsx` — program completion state and call-to-action

### 5.3 Server Function ✅

- `src/functions/getDashboardData.ts` — fetches active program, current week, sessions, and computes dashboard state

### 5.4 Test Coverage ✅

- 46 unit tests across all dashboard components
- All 169 tests passing
- Focus labels replace 3-char abbreviations for improved clarity

---

## Phase 6: Workout Execution (Critical Path)

### 6.1 Route: `app/routes/session/$id.tsx`

The heart of the app. Must be usable mid-set.

**State Management (Zustand):**

- Current exercise index
- Current set number
- Rest timer state (active/resting)
- Logged sets (transient until committed)
- Rest phase vs active phase

**UI Requirements:**

- One exercise at a time
- Large number inputs (no tiny fields)
- Minimal typing
- Rest timer (CSS countdown)
- Coach note display (pre-generated)
- "Next set" / "Finish exercise" progression

### 6.2 Server Function: `app/functions/logSet.ts`

- Receives: planned_exercise_id, set_number, weight_kg, reps, rir_actual
- Creates set_log row (only when committed, not during active session)

### 6.3 Server Function: `app/functions/completeSession.ts`

- Creates workout_log row
- Writes all set_log rows
- Triggers progression check (calls rules.ts)
- Returns next session ID or redirects to feedback

---

## Phase 7: Post-Workout Feedback

### 7.1 Route: `app/routes/feedback/$id.tsx`

- Fatigue slider (1-5)
- Optional notes textarea
- Updates workout_log with fatigue_rating and notes

---

## Phase 8: Plan View

### 8.1 Route: `app/routes/plan.tsx`

- Read-only week and session overview
- Week tabs
- Session cards with exercises listed
- Shows AI rationale for program

---

## Phase 9: Progression Logic

### 9.1 Rule Engine (`lib/rules.ts`)

Pure functions, no AI:

- `shouldIncrementLoad()` - If all reps hit upper bound AND avg RIR >= target -> +2.5kg
- `shouldDeload()` - Fatigue >= 4 on 2 consecutive sessions OR week 4/5
- `computeNextSessionLoads()` - Apply progression to next session

### 9.2 Tests (`lib/rules.test.ts`)

Comprehensive unit tests for:

- Load increment thresholds
- Deload detection
- Edge cases (partial sets, missed reps)

---

## Phase 10: Adaptation (Manual Trigger for MVP)

### 10.1 Server Function: `app/functions/adaptWeek.ts`

- Manual trigger via button on dashboard
- Collects: planned week, all set_logs, fatigue ratings, notes
- Calls AI with ADAPTATION_PROMPT
- Returns diff preview with reasoning

### 10.2 Diff Preview UI

- Show proposed changes before applying
- Allow manual override
- Apply changes to next week's session_templates

---

## Verification Plan

### Local Development

```bash
pnpm dev
```

### Testing

```bash
pnpm test        # Run Vitest
pnpm test:watch  # Watch mode
```

### End-to-End Verification

1. Complete onboarding flow -> verify program in DB
2. Start a session -> log sets -> complete -> verify progression
3. Complete multiple sessions -> verify fatigue tracking
4. Trigger manual adaptation -> verify diff output

### Mobile Testing

- Test on phone browser via local network
- Verify tap targets, safe area insets
- Test workout execution with timer running

---

## Files to Create (Summary)

**Configuration:**

- `app.config.ts`
- `vite.config.ts`
- `tsconfig.json`
- `app.css`
- `.env.example`

**Library:**

- `lib/db.ts`
- `lib/schema.ts`
- `lib/ai.ts`
- `lib/prompts.ts`
- `lib/rules.ts`
- `lib/rules.test.ts`

**Data:**

- `data/exercises.ts`

**Routes:**

- `app/routes/index.tsx`
- `app/routes/onboarding.tsx`
- `app/routes/session/$id.tsx`
- `app/routes/plan.tsx`
- `app/routes/feedback/$id.tsx`
- `app/routes/__root.tsx`

**Server Functions:**

- `app/functions/generatePlan.ts`
- `app/functions/logSet.ts`
- `app/functions/completeSession.ts`
- `app/functions/adaptWeek.ts`
- `app/functions/swapExercise.ts`

**Components:**

- `components/ui/` - shadcn components (Button, Input, Card, Slider, etc.)
- Custom components for onboarding, session execution, etc.
