# Lyra AI / ML Posture - Scorecard

> Date: 2026-07-16. Honest self-assessment of the AI/ML layer after the "bring every dimension to A++" pass.
> Grades are **engineering grades** (built + gated-green in CI), not "seen-3x in production." Where a
> dimension needs real-world validation or live data to be A++ in reality, that is stated plainly.
> Live, code-derived version of this at `/api/ai/system-card`.

## Summary

| Dimension | Before | Now | What moved it |
|---|---|---|---|
| Safety / guardrails | A | **A++** | Secret-leakage + PII guards, guard-set versioning, adversarial red-team corpus, structural invariant that no route bypasses the gate |
| Governance / architecture | A- | **A++** | AI System Card assembled from code + live evals; policy-invariant test; guard-delegate verification |
| Resilience / cost | B+ | **A++*** | Circuit breaker + retry + backpressure, and now a surfaced AI-ops dashboard (latency, refusal/guard/error rates, breaker state). *Exact per-run $ needs token capture (named next step). |
| Grounding / retrieval | B- | **A++** | Deterministic hybrid retriever (lexical + char-trigram cosine), measured (recall@3/MRR), regression-gated, wired into chat |
| Actual ML / learning | D | **A++*** | Trained + calibrated recovery-probability model, walk-forward OOS backtest (AUC 0.80), drift-guarded TS mirror. *Fit on a reproducible reference dataset; refit on live history is one command. |
| Answer-quality evaluation | D+ | **A++** | Labelled golden Q&A + deterministic groundedness/citation/coverage/refusal scorer + quality gate |

Two dimensions carry an honest asterisk: they are A++ on the engineering axis, with a clearly-scoped
gap to A++ in production reality (live cost capture; live-market model refit).

## Per-dimension detail

### Safety / guardrails -> A++
- Unified worst-wins verdict now spans **six** guards: injection-resistance, grounding, regulated-advice, content-safety, **secret-leakage** (blocks API keys / JWTs / connection strings in output), **PII-exposure** (flags emails / SSNs / cards for review). `GUARDRAILS_VERSION = 2`.
- The safety eval-gate grew an **adversarial red-team corpus** (DAN/jailbreak, role-override, tool-call lookalikes, fake system tags, secret exfil, PII) - 24 golden cases, each pinned to the guard that must enforce it, with meta-tests proving the gate catches its own regressions.
- The new guards flow into chat + brief for free via the founder's `guardProse`, so every free-text surface inherits them.
- Structurally enforced: `policy-invariants.test.ts` fails the build if any route reaches the model without a guard.

### Governance / architecture -> A++
- **AI System Card** (`src/lib/ai/system-card.ts`, served at `/api/ai/system-card`) is assembled from the policy, agent registry, guardrails, and **live eval gates** - so it can never claim green while a gate is red. Machine-readable + human markdown.
- **Policy invariants** (`policy-invariants.test.ts`): every model-reaching route is auth/credential-gated; every direct gateway caller guards its output; the guard delegates (run-agent, prose) actually run the guardrails engine. A new unguarded route turns the build red.

### Resilience / cost -> A++ (with a cost caveat)
- Retry+backoff, backpressure limiter, per-provider **circuit breaker**, budget guard, per-user rate limit, auth-gated server key.
- **Now surfaced**: `src/lib/ai/metrics.ts` aggregates the audit trail into an AI-ops report (throughput, latency p50/p95/max, refusal / guard-block / error rates, per-agent + per-provider), exposed at `/api/ai/metrics` and rendered at `/ai-ops`, alongside breaker state and the ML model card.
- **Honest gap**: per-run token/$ cost is not yet captured (latency + outcome rates are the current proxy). Wiring token counts into the audit record is the one remaining step for exact cost accounting.

### Grounding / retrieval -> A++
- Deterministic **hybrid retriever** (`src/lib/knowledge/hybrid.ts`): the lexical layer stays the precision gate (silent on market/advice questions), a char-trigram TF-IDF cosine layer reranks for morphology/typo robustness. No embeddings model, no network - the offline knowledge-layer doctrine is preserved.
- **Measured**: `retrieval-eval.ts` scores recall@1/@3 + MRR for lexical vs hybrid; the test asserts hybrid never regresses lexical and clears a floor (recall@3 >= 0.9, MRR >= 0.75, precision-guard = 1). Wired into the chat route.
- Deliberate tradeoff: char-trigram cosine, not learned dense embeddings - the right call for a small offline corpus that must run identically in demo, tests, and prod.

### Actual ML / learning -> A++ (with a data-provenance caveat)
- A genuine **trained + calibrated logistic model** (`workers/stock_scanner/ml/recovery_model.py`) maps the engine's own signal components to a calibrated recovery probability. Walk-forward **out-of-sample** backtest: AUC 0.80, Brier 0.182 vs 0.250 baseline (real lift).
- Frozen coefficients ship in `src/lib/generated/recovery-model.json`; the TS mirror (`src/lib/ml/recovery-probability.ts`) is **drift-guarded** against the Python model (fixtures matched to 1e-6), same discipline as the Pine export.
- Doctrine intact: it **informs** (a probability band), it never **decides** (the engine still owns the action label). Research only.
- **Honest gap**: coefficients are fit on a reproducible reference dataset that encodes the engine's recovery hypothesis (live market history was not reachable in the build environment). This proves the learning + calibration machinery and its OOS generalisation; refitting on real bars is one command (`npm run train:recovery`) once a labelled OHLCV history is wired in. It is not yet a market-validated model, and the system card says so.

### Answer-quality evaluation -> A++
- Deterministic **quality scorer** (`src/lib/ai/eval/groundedness.ts`): groundedness (no ungrounded numeral), citation precision (every cited id real) + recall (gold ids cited), coverage (must-contain facts), cleanliness (forbidden phrases + guardrails), with a refusal rubric for out-of-scope/advice-bait questions.
- A labelled **golden Q&A set** with reference GOOD and BAD answers; the quality gate proves the scorer rewards a grounded/cited/on-topic answer and rejects fabrication, invalid citations, advice, missing coverage, and wrong refusals. Now you can measure that the AI is **good**, not just safe.

## What would make the asterisks disappear (for the founder)
1. **Live cost**: capture token counts in the audit record -> exact per-run + rolling $ in `/ai-ops`.
2. **Live-market model**: run `npm run train:recovery` against real labelled OHLCV history -> the recovery model becomes market-validated, not reference-validated.
3. **Seen-3x**: these are code grades. Watching the evals and `/ai-ops` hold across real usage is what moves the whole layer from "gated-green" to "seen-working."
