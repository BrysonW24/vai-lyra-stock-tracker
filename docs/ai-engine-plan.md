# Lyra — AI Engine: Plan to Professional-Grade AI Usage

> **Captured 2026-06-07.** The roadmap from today's partial BYOK to a professional,
> provider-and-model-agnostic AI layer that composes real alert/notification messages.
> Companion to [`ai-notification-layer.md`](./ai-notification-layer.md) (the contracts) — this
> doc is the *delivery plan + backlog*.

## Product doctrine (unchanged, load-bearing)

**The deterministic engine decides; the AI only composes.** Every number in every AI message is
passed verbatim from a deterministic field — the AI never invents a number and never gives advice.
This is the compliance guarantee that keeps Lyra "research, not advice." Every ticket below
preserves it: AI output is always validated against the contract and **falls back to the
deterministic render** if it fails.

---

## 1. Where we are today (honest state)

| Capability | Status | Evidence |
|---|---|---|
| BYOK for the **Daily Brief** | ✅ Live | [`api/ai/brief/route.ts`](../src/app/api/ai/brief/route.ts) — forwards user key to Anthropic/OpenAI, never logged/persisted |
| Account AI settings (mode/provider/key) | ✅ Live | [`lib/account.ts`](../src/lib/account.ts) — `off / byo / hosted`, stored browser-local |
| **Choose your own model** | ❌ | Model hardcoded per provider (`claude-3-5-haiku-latest`, `gpt-4o-mini`) |
| **AI alert/notification messages** | ❌ | No composer — `AlertEvent` → `NotificationMessage` is unwired |
| Provider breadth | ⚠️ 2 | Anthropic + OpenAI only; no OpenRouter / Gemini / local |
| Hosted (managed) mode | ❌ | Placeholder — route returns `hosted_not_configured` |
| Runtime guardrails / evals | ⚠️ | `test-register.json` exists but is not enforced at runtime or in CI |
| Usage / cost metering | ❌ | No token/cost/latency logging |
| Backend hourly composer | ❌ | `change_register.py` / `message_composer.py` not built |

**Bottom line:** a user who brings their own key gets an AI-phrased *brief* — not the alert
messages, and cannot select their own model. The contracts ([`contracts/notifications/`](../contracts/notifications/))
are defined and validated, but nothing consumes them yet.

---

## 2. Target architecture (professional)

```
                          ┌─────────────────────────────────────────┐
                          │  AI Gateway  (src/lib/ai/gateway.ts)      │
  Account AI settings ───▶│  provider + model + key  →  complete()    │◀── server-only
  (off / byo / hosted)    │  anthropic · openai · openrouter · gemini │
                          └───────────────┬───────────────────────────┘
                                          │ one interface
            ┌─────────────────────────────┼──────────────────────────────┐
            ▼                             ▼                                ▼
   Daily Brief (live)          Notification Composer (new)         Ask Lyra (future)
                                          │
                          deterministic render (always)  ──fallback──┐
                                          │                          │
                          AI rephrase (behind toggle) ──validate──▶ contract guard
                                          │                          │
                                          ▼                          │
                          NotificationMessage / HourlyDigest ◀───────┘
                                          │
                          Telegram · WhatsApp · in-app feed
```

Key decisions:

1. **One gateway, many providers.** A single `complete({provider, model, apiKey, system, prompt})`
   used by *every* AI surface. Adding a provider/model never touches a feature again.
2. **OpenRouter is the "any model" escape hatch.** One OpenRouter key → hundreds of models
   (Claude, GPT, Llama, Mistral, Gemini, local-proxied). This is what makes "bring your own model"
   real without us integrating every vendor.
3. **Model is a field, not a constant.** Curated defaults per provider, free-text override for
   power users.
4. **Composer is contract-first.** Deterministic render is the source of truth; AI rephrase is an
   optional warmer pass that must pass the same contract or it's discarded.
5. **Two runtimes, one contract.** TS composer for in-app/edge; Python composer for the hourly
   worker. Both validated by the same `test-register.json`.
6. **BYOK key never leaves the trust boundary.** Browser → server route → provider. Never logged,
   never persisted. Hosted mode uses a central key with metering.

---

## 3. Backlog — AI-01 … AI-17

Phased so each ticket ships value and the doctrine holds at every step. IDs are stable.

### Phase 0 — Foundation (start now)

- **AI-01 · Provider/model-agnostic AI Gateway** *(in progress)*
  `src/lib/ai/gateway.ts` exposing `complete()` for anthropic + openai + openrouter + gemini, with
  `DEFAULT_MODELS` and `resolveModel()`. Refactor the brief route to use it. **AC:** brief still
  works via gateway; provider+model are parameters; adding a provider is one adapter.

- **AI-02 · Model selection in Account**
  Extend `AiSettings` with `model?: string`; Account UI adds a provider dropdown (4 providers) +
  model field with curated presets and free-text override. **AC:** a user can pick OpenRouter +
  any model string and the brief uses it.

### Phase 1 — The message composer (TypeScript, in-app)

- **AI-03 · Deterministic composer**
  `src/lib/ai/composer.ts` — render `NotificationMessage` / `HourlyDigest` from
  `message-templates.json` + an `AlertEvent`. Pure, no AI. **AC:** every `test-register` case
  passes deterministically.

- **AI-04 · AI rephrase path**
  Behind the Account AI toggle, route the deterministic message + `facts{}` through the gateway
  using the template's `ai_rephrase` instruction. **AC:** AI output is warmer prose, same facts.

- **AI-05 · Runtime contract guard + eval suite**
  Validator: `facts_used ⊆ facts`, char limits, no-advice lexicon (`buy/sell/target/recommend`),
  ticker-inclusion, dedup. Fail → fall back to deterministic. Wire `test-register.json` as a Vitest
  suite. **AC:** an AI message that invents a number or gives advice is rejected and the
  deterministic render is sent instead.

### Phase 2 — Backend worker (Python, the hourly driver)

- **AI-06 · `change_register.py`** — build `ChangeSnapshot` (this run vs prior via
  `stock_scanner_runs` lookback).
- **AI-07 · `message_composer.py`** — Python mirror of AI-03/04/05 (deterministic + AI rephrase +
  guard), sharing the JSON contracts.
- **AI-08 · `stock_messages` table + persistence** — store messages/digests for the in-app feed +
  delivery audit (new `sql/0XX_messages.sql`).
- **AI-09 · Hourly delivery wiring** — GitHub Actions workflow: composer → Telegram/WhatsApp
  (channels already live), honoring gating/quiet-hours/cooldowns.
- **AI-10 · CI parity gate** — `test-register.json` run in *both* pytest and Vitest; a prompt or
  template change can't merge unless both pass.

### Phase 3 — Professional hardening

- **AI-11 · Usage + cost metering** — log tokens/cost/latency/provider/model per call
  (`api_usage_logs`); surface a usage panel.
- **AI-12 · Budget caps + rate limiting** — per-user monthly cap (esp. hosted), graceful
  degradation to deterministic when exceeded.
- **AI-13 · Response caching** — cache AI rephrase keyed by `(event-hash, model)`; re-renders are
  free and deterministic.
- **AI-14 · Hosted mode (managed tier)** — central key + metering; the paid "we run the AI" option.
- **AI-15 · Prompt-injection hardening** — `news[]` is untrusted input; fence it, strip
  instructions, never let headlines steer the model. Add adversarial cases to the register.
- **AI-16 · Eval harness + regression gate** — score prompt/model changes against the golden
  register before promotion; track pass-rate over time.
- **AI-17 · "Ask Lyra" (stretch)** — streaming conversational surface over the same gateway +
  grounded facts.

---

## 4. Sequencing & "begin the build"

Build order: **AI-01 → AI-02 → AI-03 → AI-05 → AI-04** gets a *user-visible, model-of-your-choice,
guardrailed AI message in-app*. Phase 2 then makes it fire hourly to the phone. Phase 3 makes it
safe to charge for.

Starting with **AI-01** now: the gateway is the spine everything else hangs off, and it's the
ticket that makes "their own model" possible.
