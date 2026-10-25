# Local AI with Ollama

Install [Ollama for Windows](https://ollama.com/download/windows), start it, and explicitly download the initial model:

```powershell
ollama pull qwen3:14b
ollama list
```

Set these values in `.env`, then restart the app with `pnpm dev`:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:14b
OLLAMA_TIMEOUT_MS=300000
OLLAMA_NUM_CTX=32768
```

All four generation operations now use Ollama without cloud keys. The adapter sends one request, disables thinking, requests schema-constrained JSON, and validates the response with Zod. Alternative models must support those settings. Model weights plus context need more memory than the download size; reduce context or choose a smaller model if necessary, while leaving enough context for the full prompt and output.

During generation, run `ollama ps` to check GPU residency and `nvidia-smi` to check GPU memory use. Keep the PC awake. Cold requests include loading the model. The five-minute timeout applies to every local request; cloud on-demand requests retain their 90-second deadline. A timeout or invalid response does not trigger an automatic retry or paid fallback.

The on-demand daily cap remains five dispatched attempts by default, configurable through `ON_DEMAND_WORKOUT_DAILY_CAP`. Dispatched failures count; replaying a request ID does not dispatch again. An unavailable server or missing model produces an actionable error; models are never downloaded by the app.

Native `pnpm dev` on the same PC is the supported starting point. Inside Docker, `127.0.0.1` refers to the container. Host Ollama access requires a separate Docker host address and deliberate host binding/firewall configuration; do not expose an unauthenticated Ollama endpoint publicly. Hosted-to-PC networking is outside this setup.

To switch back, set `AI_PROVIDER=anthropic` or `openai`, configure that provider's key/model, and restart. Switching is always explicit.

## Verification

The [initial RTX 4090 evaluation](ollama-evaluation.md) found quality failures with `qwen3:14b`; treat it as an experimental starting model rather than a qualified coaching default.

Normal `pnpm validate` does not call live models. Run the local evaluation explicitly:

```powershell
$env:RUN_OLLAMA_AI_SMOKE = "1"
pnpm test run lib/ai.ollama.live.test.ts
Remove-Item Env:RUN_OLLAMA_AI_SMOKE
```

The evaluation uses synthetic inputs, runs no paid calls, writes no application data, and checks all four operations plus restricted and infeasible requests. It logs timing and quality checks. Review coaching quality separately from schema validity. The paid Anthropic smoke test remains separately gated by `RUN_ON_DEMAND_AI_SMOKE=1`.
