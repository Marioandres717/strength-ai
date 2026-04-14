---
name: strength-ai-design
description: >
  Design UI/UX screens and mockups for the strength-ai app. Use this skill
  whenever the user asks to design, mockup, wireframe, or plan a new screen,
  route, or page for this project — even if they just say "what should the
  session screen look like?" or "I need a plan for the feedback page". Also
  use it when the user says "we are on phase N" of the implementation plan and
  the phase involves a new route. This skill produces an ASCII wireframe, a
  component breakdown, and a ready-to-implement plan that follows the app's
  established dark design system and gym-first UX principles.
---

# Strength-AI Screen Design Skill

You are designing a screen for a **mobile-first AI-powered strength training coach**.
The user's goal is a polished, consistent UI they can implement straight away.
Your output is: (1) an ASCII wireframe, (2) an implementation plan.

---

## Step 1 — Read before you design

Before drawing anything, read the key source files to understand current patterns.
Always read at minimum:

- `src/styles.css` — Tailwind theme tokens (colors, fonts)
- `src/routes/onboarding.tsx` — the canonical style reference for all screens
- The most relevant existing route (e.g. `src/routes/index.tsx` for dashboard patterns)
- `lib/schema.ts` — what data is available from the DB

If the screen involves server data, also read `src/functions/generatePlan.ts` for the
`createServerFn` pattern to follow.

---

## Step 2 — Apply the design system

Every screen must follow these conventions exactly. Deviating breaks consistency.

### Layout

```
<div className="bg-bg min-h-screen">
  <div className="mx-auto max-w-md px-6 pt-8 pb-16">
    {/* content */}
  </div>
</div>
```

### Colors (Tailwind classes from @theme tokens)

| Purpose               | Class                       | Value   |
| --------------------- | --------------------------- | ------- |
| Page background       | `bg-bg`                     | #0d0d0d |
| Card background       | `bg-surface`                | #1c1c1e |
| Card border           | `border-border`             | #2a2a2a |
| Selected/active state | `bg-surface-selected`       | #0a1f1c |
| Accent (teal)         | `bg-accent` / `text-accent` | #00c9a7 |
| Primary text          | `text-white`                | —       |
| Secondary text        | `text-muted`                | #6b7280 |
| Dim text              | `text-muted-dim`            | #4a4a4a |

### Typography

- **Kicker labels** (section headings): `text-xs font-semibold tracking-widest uppercase text-muted`
- **Page title**: `text-3xl font-bold leading-tight text-white`
- **Body**: `text-sm text-muted`

### Cards

```
<div className="rounded-2xl border border-border bg-surface p-5">
```

### Primary CTA button

```
<button className="w-full rounded-2xl bg-accent py-4 text-base font-bold text-black">
```

### Sticky bottom CTA (for action-focused screens like session / feedback)

Reuse the onboarding pattern exactly — a fixed gradient overlay so the button floats above content:

```tsx
<div className="from-bg via-bg pointer-events-none fixed right-0 bottom-0 left-0 bg-gradient-to-t to-transparent px-6 pt-6 pb-8">
  <div className="pointer-events-auto mx-auto max-w-md">
    <button className="w-full rounded-2xl bg-accent py-4 text-base font-bold text-black">
      …
    </button>
  </div>
</div>
```

### Bare layout (strip the root header/footer)

Screens that are focused flows (onboarding, session execution, feedback) should hide the site header/footer. Register the route in `src/routes/__root.tsx` in the `bare` check:

```tsx
const bare =
  pathname === "/onboarding" ||
  pathname.startsWith("/session/") ||
  pathname.startsWith("/feedback/");
```

### Section dividers

```
<div className="my-8 border-t border-border" />
```

### Input fields

```
<input className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-sm text-white placeholder:text-muted-dim focus:border-accent focus:outline-none" />
```

---

## Step 3 — Apply gym-first UX principles

These three principles must visibly shape every design decision you make:

### 1. Minimal Distractions

One primary action per screen. No nav clutter visible during a workout.
The user's hands are full — literally. Strip everything non-essential.
Ask: "Could someone miss a set because this screen confused them?" If yes, simplify.

### 2. Sweaty-Hands UX

- All tap targets **≥ 44px tall** (use `py-4` or `h-11` minimum)
- Numeric inputs must be large: `text-4xl font-bold text-white text-center`
- Avoid text inputs mid-workout — use steppers (+/−) or pre-filled values instead
- Prefer vertical scrolling over horizontal navigation
- Destructive/skip actions should require 2 taps or be visually small

### 3. Real-time Feedback

- Show current set / total sets prominently (e.g. "Set 2 of 4")
- Highlight state changes immediately (rest timer starts, set logged)
- Use `text-accent` or a teal glow to signal success/active states
- Progress should be visible at a glance without scrolling

---

## Step 4 — Produce the wireframe

Draw an ASCII wireframe at ~40-char width (phone viewport). Use these symbols:

- `[KICKER]` — uppercase label in muted text
- `[H1]` — large white heading
- `[card]` — a rounded-2xl surface card
- `[●]` / `[○]` — filled / empty indicator dots
- `[btn: TEXT]` — a CTA button (full-width, accent bg)
- `[btn-sm: TEXT]` — a secondary/smaller button
- `[──────]` — a border-t divider
- `[input: placeholder]` — a text or numeric input
- `[+] [−]` — stepper controls

Keep it narrow enough to be readable. Always draw **at least two wireframe variants**:

1. The default/empty state (nothing selected, first load)
2. The primary active state (user mid-task — e.g., rating selected, set logged, rest timer running)

If the screen has a third distinct state (e.g., saving/success flash, error), add a third.
Annotate each variant with a heading like `### Default state` and `### Active state`.

---

## Step 5 — Write the implementation plan

Structure the plan as follows. Be specific — use actual file paths, actual Tailwind classes.

### Files

List every file to create or modify.

### Component breakdown

For each component: props interface, what it renders, which design-system classes it uses.

### Verification

How to test the screen works end-to-end in the browser.

---

## Output format

Always deliver in this order:

1. **Wireframe** — the ASCII mockup (with state variants if needed)
2. **Design notes** — 3–5 bullet points calling out key UX decisions and why
3. **Implementation plan** — the structured plan from Step 5

---

## Reference: existing screen inventory

| Screen                | Route           | Status            |
| --------------------- | --------------- | ----------------- |
| Onboarding wizard     | `/onboarding`   | Complete          |
| Dashboard             | `/` (index)     | Complete          |
| Workout session       | `/session/$id`  | Planned (Phase 6) |
| Post-workout feedback | `/feedback/$id` | Planned (Phase 7) |
| Plan view             | `/plan`         | Planned (Phase 8) |

Read `AGENTS.md` in the project root for the full phase-by-phase plan if you need more context about what's coming next.
