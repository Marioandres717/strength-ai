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

# Database
pnpm db:push          # Apply schema changes to strength.db (dev workflow)
pnpm db:generate      # Generate SQL migration files (for production/Fly.io)
pnpm db:studio        # Open Drizzle Studio to inspect the database
pnpm db:seed          # Seed the exercise library (idempotent, safe to re-run)

```

---

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | TanStack Start (Vite + TanStack Router) |
| Database   | Drizzle ORM + better-sqlite3            |
| AI         | Anthropic SDK (`claude-sonnet-4-6`)     |
| Validation | Zod (AI output schemas)                 |
| State      | Zustand (workout execution only)        |
| Testing    | Vitest + happy-dom                      |
| UI         | shadcn/ui + Tailwind CSS v4             |
| Deployment | Fly.io                                  |

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — Full system architecture and conventions
- **[.claude/docs/design.md](./.claude/docs/design.md)** — Complete design rationale

---

## Contributing

This is a personal project. Contributions are not currently accepted.

---

## License

Private project. All rights reserved.
