# Strength AI

AI-powered personal strength training coach built for a single user. Generates structured multi-week programs and adapts them based on real performance data.

**Core loop**: Generate → Execute → Log → Adapt → Repeat

---

## Quick Start

### Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm installed globally
- Anthropic API key

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Start development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

---

## Available Commands

```bash
# Development
pnpm dev              # Start dev server on port 3000
pnpm build            # Build for production
pnpm preview          # Preview production build

# Testing
pnpm test             # Run tests in watch mode
pnpm test:ui          # Run tests with UI
pnpm test:coverage    # Generate coverage report

# Code Quality
pnpm lint             # Check code for linting issues
pnpm lint:fix         # Auto-fix linting issues
pnpm format           # Format all files with Prettier
pnpm format:check     # Check if files are formatted
pnpm typecheck        # Type-check without building
pnpm validate         # Run all checks (types, lint, format, tests)
```

---

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | TanStack Start (Vite + TanStack Router) |
| Database   | Drizzle ORM + better-sqlite3            |
| AI         | Anthropic SDK (`claude-sonnet-4-6`)     |
| State      | Zustand (workout execution only)        |
| Testing    | Vitest + happy-dom                      |
| UI         | shadcn/ui + Tailwind CSS v4             |
| Deployment | Fly.io                                  |

---

## Project Structure

```
src/
  routes/              # File-based routing
    __root.tsx         # Root layout
    index.tsx          # Dashboard (Phase 3+)
    onboarding.tsx     # 5-screen onboarding (Phase 3+)
    session/$id.tsx    # Workout execution (Phase 5+)
    plan.tsx           # Program overview (Phase 4+)
    feedback/$id.tsx   # Post-workout feedback (Phase 5+)

  functions/           # Server functions (Phase 2+)
    generatePlan.ts    # AI plan generation
    logSet.ts          # Set logging
    completeSession.ts # Session completion
    adaptWeek.ts       # Weekly adaptation
    swapExercise.ts    # Exercise swapping

  components/
    ui/                # shadcn components (local source)

  lib/
    utils.ts           # Utility functions

  test/
    setup.ts           # Vitest setup
    utils.tsx          # Test utilities

lib/                   # Business logic (Phase 2+)
  db.ts                # Database setup
  schema.ts            # Drizzle schema
  ai.ts                # AI abstraction
  rules.ts             # Progression logic
  rules.test.ts        # Progression tests
  prompts.ts           # AI system prompts

data/                  # Static data (Phase 2+)
  exercises.ts         # Exercise library (~35 entries)
```

---

## Development Phases

### ✅ Phase 1 — Foundation (Complete)

- TanStack Start initialized with TypeScript
- Tailwind CSS v4 configured
- shadcn/ui components: Button, Input, Card, Slider, Tabs, Progress
- Vitest testing infrastructure with happy-dom
- Core dependencies installed (Drizzle, better-sqlite3, Anthropic SDK, Zustand)
- Directory structure created

### 🚧 Phase 2 — Database Setup (Next)

- Drizzle schema definition
- Database initialization
- Exercise library seeding (~35 exercises)
- Database migrations

### 📋 Phase 3 — Onboarding UI

- 5-screen onboarding flow
- User profile capture
- Equipment selection
- Schedule configuration

### 📋 Phase 4 — AI Plan Generation

- System prompt design
- JSON schema definition
- `generatePlan` server function
- Plan preview screen

### 📋 Phase 5 — Workout Execution

- Exercise-by-exercise flow
- Set logging inputs
- Rest timer (Zustand state)
- Post-workout feedback

### 📋 Phase 6 — Real Usage

- Mobile polish
- UX refinements
- Fly.io deployment

### 📋 Phase 7 — Rule-based Progression

- Load increment logic
- Deload detection
- Progression feedback

### 📋 Phase 8 — Weekly Adaptation

- Adaptation AI call
- Diff preview
- Manual approval flow

---

## Key Features

### What AI Does

- **Plan Generation**: Creates complete 4-week programs at onboarding
- **Weekly Adaptation**: Adjusts next week based on logged performance
- **Exercise Swaps**: Suggests alternatives on demand

**Important**: AI is never called live during a workout. All coaching shown in-session is pre-generated.

### What's Rule-Based

- Rest timer countdown
- Load increment calculations (rep ranges + RIR)
- Deload detection (fatigue thresholds)
- Exercise ordering (compounds before isolations)
- Set/rep counting

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Anthropic API Key for AI-powered workout plan generation
ANTHROPIC_API_KEY=your_api_key_here
```

---

## Testing

Vitest is configured with happy-dom as the test environment.

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Generate coverage
pnpm test:coverage
```

Test files live next to the code they test (e.g., `lib/rules.test.ts` alongside `lib/rules.ts`).

Focus testing on rule-based progression logic. AI calls and DB interactions use integration tests, not mocks.

---

## Code Quality

### Linting & Formatting

This project uses **ESLint** for code quality and **Prettier** for formatting.

#### Quick Commands

```bash
# Fix all linting and formatting issues
pnpm lint:fix && pnpm format

# Check everything before committing
pnpm validate
```

#### Editor Setup

**VS Code** (Recommended):

1. Install recommended extensions (prompted on project open)
2. Format-on-save is enabled by default
3. ESLint auto-fixes issues on save

#### Pre-commit Hooks

**Husky + lint-staged** automatically:

- Lints and formats staged files before commit
- Prevents committing code that doesn't meet standards
- Only runs on changed files for speed

#### Configuration Files

- `eslint.config.js` — ESLint flat config (React 19, TypeScript strict, Tailwind)
- `.prettierrc` — Prettier rules (double quotes, no semicolons, 2-space indent)
- `.vscode/settings.json` — Editor formatting settings

#### CI Integration

The `validate` script is designed for CI pipelines:

```bash
pnpm validate
```

Runs: TypeScript compilation → ESLint → Prettier check → Vitest

---

## Design Philosophy

- **Performance tool** — authoritative, decisive, low-friction
- **Single-user** — no social features, no multi-tenancy (yet)
- **Mid-workout usable** — large inputs, minimal typing, no waiting
- **Transparent AI** — always show reasoning, never hide decisions
- **Rule-based first** — use AI only where judgment genuinely matters

---

## MVP Scope

### In Scope

- Onboarding (5 screens) → AI-generated 4-week program
- Dashboard: current week, next session
- Workout execution: exercise-by-exercise with set logging
- Post-workout: fatigue rating + notes
- Plan view: read-only program overview
- Rule-based load progression

### Out of Scope (v1)

- Progress charts or history graphs
- Soreness mapping
- Exercise library UI
- Program management (archive, regenerate)
- Settings screen
- Authentication or multi-user
- Native mobile app

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — Full system architecture and conventions
- **[.claude/docs/design.md](./.claude/docs/design.md)** — Complete design rationale
- **[.claude/docs/phase1-completion-summary.md](./.claude/docs/phase1-completion-summary.md)** — Phase 1 summary

---

## Contributing

This is a personal project. Contributions are not currently accepted.

---

## License

Private project. All rights reserved.
