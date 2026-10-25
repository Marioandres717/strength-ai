# Strength AI

Single-user strength training coach. Core loop: Generate → Execute → Log → Adapt → Repeat.
The product should feel authoritative, decisive, and low-friction.
The workout screen must work mid-set: large inputs, minimal typing, no waiting,
and one primary action at a time.

## Project guidance

- Read matching skills in `.claude/skills/` before applying general guidance.
  Prefer the closest match; skills are local instructions, not dependencies.
- Use the source code for current implementation and schema details,
  `package.json` for commands, and `.claude/docs/design.md` for design rationale.
- Keep this file focused on durable instructions; do not add roadmap status,
  file inventories, or copies of data models.
- Keep changes within the requested scope. The target is responsive web for a
  single user; do not add auth, multi-user support, or native mobile unasked.

## Stack and UI

- Node.js, pnpm, TypeScript, React, TanStack Start (Vite + TanStack Router).
- Drizzle + better-sqlite3; retain SQLite rather than introducing another database.
- Zod for AI response validation; Vitest for tests; Fly.io for deployment.
- Use pnpm exclusively, including dependency installation and scripts.
- shadcn/ui components are local source in `src/components/ui/`. Edit them
  directly; do not import from a `shadcn` package or run `pnpm add shadcn`.
- Tailwind CSS v4 configuration lives in `src/styles.css`. Use
  `@import "tailwindcss"`, CSS variables, and `@theme`; no JavaScript Tailwind
  config or legacy `@tailwind` directives.

## Architecture

- All AI calls go through `lib/ai.ts`; never call provider SDKs in routes or
  components. Validate AI output with Zod before persisting it.
- Persist generated results rather than recomputing them on page loads.
- Never call AI live during workout execution. In-session coaching is
  pre-generated in `planned_exercise.coach_note`.
- Prompts live in `lib/prompts.ts`, scoped by call type. Treat prompt changes
  as business logic changes and preserve user-facing explanations of AI decisions.
- All database access goes through Drizzle, with schema in `lib/schema.ts`;
  no raw SQL strings.
- Server functions live in `src/functions/`, one file per operation, for data
  loading and mutations. Keep timers and other UI state on the client.
- Use Zustand only for transient workout execution state, not server data.
  Keep uncommitted set input, exercise position, and timers out of the database;
  persist sets when committed.
- Progression, fatigue/deload rules, and exercise ordering are deterministic
  logic in `lib/rules.ts`, not AI judgments. Keep compounds before isolations.

## Quality and verification

- Keep TypeScript strict. No `@ts-ignore` or `any` without explicit justification.
  Use `import type` for type-only imports.
- Follow ESLint and Prettier. Use `console.warn` or `console.error` instead of
  `console.log`; prefix intentionally unused variables with `_`.
- Keep tests beside the code they cover. Shared React test helpers live in
  `src/test/utils.tsx`.
- Prioritize unit tests for progression rules in `lib/rules.test.ts`. Test AI
  calls and database interactions with integration tests, not mocked unit tests.
- Run checks appropriate to the change. Before committing code, run `pnpm lint`
  and format changed files with Prettier. Run `pnpm validate` before pushing
  (typecheck, lint, formatting, and tests).
