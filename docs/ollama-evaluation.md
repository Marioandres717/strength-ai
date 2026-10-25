# Local model evaluation — October 24, 2026

Environment: RTX 4090 (24 GB), Ollama 0.40.10, `qwen3:14b` Q4_K_M, digest `bdbd181c33f2ed1b31c972991882db3cf4d192569092138a7d29e973cd9debe8`. Context 32,768 tokens, temperature zero, thinking disabled. `ollama ps` reported 100% GPU residency and approximately 14 GB model/runtime memory.

Six synthetic cases ran through the actual adapter with cloud credentials disabled. The first request explicitly unloaded the evaluation model beforehand; subsequent requests reused it. No application records were written and no paid calls were made.

| Case                                      | Latency | Schema/adapter result                     | Quality result                                                       |
| ----------------------------------------- | ------: | ----------------------------------------- | -------------------------------------------------------------------- |
| Four-week plan, cold                      | 133.8 s | Valid schema and exercise-name resolution | Failed: a week contained two sessions instead of the requested three |
| Weekly adaptation, warm                   |   1.3 s | Valid schema                              | Passed the fixture's reasoning and exercise checks                   |
| Exercise swap, warm                       |   2.1 s | Rejected by library validation            | Failed: proposed Front Squat, absent from the supplied library       |
| Normal on-demand workout, warm            |   1.0 s | Valid infeasible response                 | Failed: feasible request classified as infeasible                    |
| One set of push-ups, no equipment, warm   |   1.0 s | Valid infeasible response                 | Failed: feasible request classified as infeasible                    |
| Heavy back squats with no equipment, warm |   0.7 s | Valid infeasible response                 | Passed                                                               |

Result: **2 of 6 quality checks passed**. Transport, schema-constrained output, and validation worked, but this model/configuration is not qualified as the everyday coaching default. These are single trials with a deliberately small library, not a broad model benchmark. The swap fixture offered limited movement-equivalent alternatives; inventing an unavailable exercise still correctly fails validation. Successful adaptation does not establish the quality of its training advice.

The four-week schema does not enforce the requested number of sessions per week. That existing semantic-validation limitation applies to all providers; the evaluation detects it without changing business rules or prompts in this adapter task.

Reproduce with the opt-in command in [local setup](local-ollama.md). Normal validation skips these live quality tests; they intentionally remain strict and may fail until a model/configuration meets the checks. Switching models or changing prompts requires a fresh evaluation. No provider configuration was automatically changed after this run.
