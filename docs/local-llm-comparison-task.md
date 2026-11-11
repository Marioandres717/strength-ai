# Task: choose a local LLM for Strength AI

## Objective

Compare local models on this Windows PC (RTX 4090, 24 GB VRAM) and select the best fit for reliable workout generation, acceptable latency, and low recurring cost. A model must pass correctness checks before speed becomes a deciding factor. If none qualifies, say so.

This document is a task brief for a future evaluation. Do not download models, run evaluations, change prompts, or switch providers merely by creating this file.

## Evaluation instructions

Follow AGENTS.md and matching repository skills. Start by reading:

- `docs/ollama-evaluation.md`
- `docs/local-ollama.md`
- `lib/ai.ts`
- `lib/prompts.ts`
- `lib/ai.ollama.live.test.ts`
- `data/exercises.ts`

The initial qwen3:14b run passed only 2 of 6 quality checks. Preserve its regressions: missing sessions in a four-week plan, an invented swap exercise, and feasible on-demand requests incorrectly rejected. Inspect raw responses and infeasible explanations before attributing failures to the model; distinguish prompt, schema, fixture, and runtime problems. Do not loosen checks to obtain a pass.

Verify installed models, exact quantizations/digests, runtime versions, free disk space, and available GPU memory. Use installed candidates first. Research additional candidates using primary sources and present exact tags, download sizes, and memory estimates before asking the user which to download. Account for context, output tokens, and other GPU applications.

Prefer the existing Ollama adapter. LM Studio may be compared if installed, but do not add a production adapter solely for this evaluation. Keep active provider settings unchanged. Use synthetic data only, no paid calls or automatic fallback, no personal workout history, and no application database writes. If database integration needs testing, use a temporary database.

## Fixed comparison prompts

For the authoritative comparison, use the application's existing system prompts, message builders, and Zod schemas unchanged. The following are fixed synthetic scenarios to serialize through those builders. Save the complete rendered messages and schema with each result so every model receives identical inputs.

Use a realistic library derived from `data/exercises.ts`, with stable synthetic IDs. Supply only equipment-compatible entries where the application normally filters the library. Save the exact fixture, including IDs and baselines. Keep the original small-library tests as separate regression cases; do not replace them with the expanded library.

### 1. Four-week plan

```text
Generate a complete four-week program for a beginner whose goal is both strength
and hypertrophy. Schedule exactly three sessions every week. Each session has
a 45-minute limit. Available equipment: barbell, rack, bench, dumbbell.
Use only the supplied exercise library, with exact exercise names. Put compounds
before isolations. Include conservative starting loads, exercise-specific cues,
and a plain-language explanation of the program and progression.
```

Map this to goal `both`, experience `beginner`, sessionsPerWeek `3`, sessionLengthMin `45`, and the listed equipment. Run a restricted variant with two 20-minute sessions and only a dumbbell. Verify all four weeks, not just week one.

### 2. Weekly adaptation

```text
Review week one. Three sessions were completed as prescribed. In each session,
Back Squat was programmed for 3 sets of 6-8 reps at 20 kg, RIR 2, with 120 seconds
rest. All three sets achieved 8 reps at RIR 2. Fatigue was 3/5 in every session.
There was no pain or equipment problem. Explain whether any adjustment is
warranted. Leave ordinary load progression to the deterministic rules engine.
```

Build three matching planned sessions and complete set logs. Expect no discretionary changes. Also run a fatigue variant: fatigue 5/5 in two sessions, declining reps 8/6/4, and RIR 0 in those sessions. Review whether proposed changes are justified by the supplied evidence and remain within the adaptation contract.

### 3. Exercise swap

```text
Replace Back Squat. Available equipment: barbell, rack, dumbbell, bench.
The session already contains Romanian Deadlift and Barbell Row.
Choose ranked alternatives only from the supplied library, prioritizing the
same movement pattern and overlapping muscles. Explain each choice.
```

Include Front Squat, Goblet Squat, and Bulgarian Split Squat as valid alternatives, alongside the other realistic library entries. Reject the original exercise, invented names, unavailable equipment, and redundant choices. Separately rerun the original five-exercise swap regression: limited alternatives never justify inventing an unavailable exercise. Note that the current swap schema has no infeasible response branch.

### 4. Normal on-demand workout

```text
A balanced 30 minute workout using my barbell and rack. I am a beginner.
```

Set authoritative controls to 30 minutes, equipment `["barbell", "rack"]`, mixed focus, energy 3, and no soreness. Use a beginner profile in kg with empty directives, no history, and no next planned session. Supply a 20 kg conservative baseline for loaded exercises and zero for bodyweight exercises. Expect a feasible workout within the exact duration formula and baseline limits.

### 5. Restricted but feasible on-demand workout

```text
One easy set of push-ups in 10 minutes, no equipment.
```

Set controls to 10 minutes and no equipment. Supply Push-Ups with a zero-load bodyweight baseline. Expect exactly one exercise and one set, zero external load, and a valid time estimate. This is a required regression: rejecting it as infeasible fails.

### 6. Deliberately infeasible on-demand workout

```text
Only heavy barbell back squats. Do not substitute. I have no equipment.
```

Set controls to 10 minutes, no equipment, and an empty eligible library. Expect an infeasible response with a specific, understandable explanation. Also test a time contradiction: request one set of push-ups with a one-minute limit, below the required five-minute warmup, using the same bodyweight fixture. Evaluate at the adapter level if the UI disallows that time input.

## Checks and scoring

For every response, separately record transport completion, schema validity, semantic correctness, and qualitative coaching review. A schema-valid response is not automatically a good workout.

- Exact library names/IDs, including raw output before any fuzzy name resolution.
- Exactly four weeks and the requested sessions in every week.
- Equipment compatibility, no duplicate exercises, and compounds before isolations.
- Time compliance using the application's deterministic duration calculation; for plans, clearly label any evaluation estimate because the plan schema has no duration field.
- On-demand resolved controls preserved, baseline load caps respected, and bodyweight loads zero.
- Feasible requests accepted and deliberately impossible requests rejected.
- Useful explanations and specific cues, with no invented history or unsupported claims.
- Adaptation respects the deterministic progression engine and only changes fields supported by evidence.

Review coaching separately for sensible volume, recovery, conservative loads, progression, and whether explanations match the actual prescription. Document ambiguous requirements or unsupported infeasibility handling instead of inventing new production behavior.

Run the initial suite once per candidate, then at least three independent trials of every case for promising candidates. Keep prompts, fixtures, schema, temperature, context, and output budgets fixed within a comparison. Record any thinking-mode experiment as a separate configuration. Preserve failed outputs; do not silently retry or discard them.

Use the existing output budgets as the baseline: plan 16,000 tokens, adaptation 2,048, swap 1,024, on-demand 4,096. Start with the supported 32,768-token context and thinking disabled; verify input plus output fits and GPU residency is practical. Explicitly report truncation, timeout, and CPU offload.

## Deliverable

Write a reproducible report with raw synthetic requests/responses and a table like this:

| Model, quantization, digest | Runtime | Context / thinking | GPU memory / residency | Cold latency | Warm latency by operation | Correct cases / trials | Failures |
| --------------------------- | ------- | ------------------ | ---------------------- | ------------ | ------------------------- | ---------------------- | -------- |
| To evaluate                 |         |                    |                        |              |                           |                        |          |

Measure cold loading separately from warm generation. Include token counts, output throughput, median and range for repeated trials, and concrete failure examples. Describe competing GPU use and whether runtime configurations differ.

Recommend a model only on observed correctness and latency. State the proposed runtime settings, limitations, and whether latency is acceptable for occasional plan generation versus interactive swaps/on-demand requests. If latency acceptance is unclear, present measured tradeoffs for the user to choose. Do not switch the active provider automatically.

Keep useful evaluation tests and artifacts in the repository. Format changed files and run appropriate checks, including `pnpm validate` for code changes. Do not commit or push unless asked.
