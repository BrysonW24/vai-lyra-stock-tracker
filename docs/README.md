# Lyra docs system

> **Purpose:** Master index of the Lyra (vdapp42 Stock Momentum Radar) documentation system - what each doc covers, where it lives, and the standards every doc must follow. | **Audience:** Engineers and agents working on Lyra. | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** 2026-06-14

Lyra is a research-first momentum console evolving into an AI-native, security-first, trading-bot-READY platform. Two invariants hold across every doc in this system:

1. **No live broker execution exists or may be implied to exist.** The only broker adapter is `NullBrokerAdapter` (`src/lib/trading/broker-adapter.interface.ts`), which refuses everything.
2. **LLMs never generate orders or originate decisions.** Deterministic code decides; AI only explains. Research, not advice.

## Doc standards (mandatory)

Every doc in this tree starts with a single metadata block, then content:

```markdown
> **Purpose:** ... | **Audience:** ... | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** YYYY-MM-DD
```

Rules:

- Ground every claim in the actual codebase - cite real paths (`src/lib/trading/risk-engine.ts`, `workers/stock_scanner/main.py`).
- Where a capability is future-only (live execution, WhatsApp sends, agents registry), say so plainly. Docs must never pretend something is built.
- Use Mermaid diagrams where they genuinely clarify, not as decoration.
- Plain hyphens "-" only. Never em dashes or en dashes. ASCII quotes.
- Include env vars, failure modes, and a checklist where the doc calls for one.
- Concise and operational beats long and vague.

## Index

Status legend: **Shipped** = exists on disk now. **Planned** = named here so links resolve to a known home, not yet written - if the file is missing, it has not shipped.

### architecture/ - how the system is built

| Doc | Purpose | Status |
|---|---|---|
| [`architecture/product-technical-story.md`](./architecture/product-technical-story.md) | New-user and founder-facing technical story: what the product does, what it solves, how the layers fit, what AI can and cannot do, and how the paper-bot path works | Shipped |
| [`architecture/system-overview.md`](./architecture/system-overview.md) | The 9-layer architecture mapped to actual code paths, current state vs target state per layer | Shipped |
| [`architecture/data-flow.md`](./architecture/data-flow.md) | End-to-end flows with sequence diagrams: scanner to dashboard, content pipeline, notification routing, future evidence-to-alert chain | Shipped |
| [`architecture/ai-native-architecture.md`](./architecture/ai-native-architecture.md) | AI layer design: gateway, agents registry, tools + permission gate, guardrails, ai_runs/ai_citations audit trail, AI_NEVER/AI_MAY policy, evals | Shipped |
| [`architecture/future-trading-bot.md`](./architecture/future-trading-bot.md) | How a bot eventually sits on top: OrderIntent lifecycle, pre-trade checks, kill switches, what is deliberately NOT built, hard gates before live | Shipped |

### security/ - threat model and secrets posture

| Doc | Purpose | Status |
|---|---|---|
| [`../SECURITY.md`](../SECURITY.md) | Repo-root security policy: key handling rules, what never ships to the frontend | Shipped (root) |
| `security/security-model.md` | Full threat model: trust boundaries, RLS posture, BYOK key flow, injection surfaces, secrets inventory | Planned |
| `security/secrets-and-keys.md` | Operational secrets handling: where each env var lives, rotation, what is server-side only | Planned |

### integrations/ - external systems

| Doc | Purpose | Status |
|---|---|---|
| `integrations/broker-adapter-spec.md` | Contract any future broker adapter must satisfy (referenced from `src/lib/trading/broker-adapter.interface.ts`) | Planned |
| `integrations/telegram.md` | Telegram bot: outbound alerts (live today from the worker), webhook security, future inbound commands | Planned |
| `integrations/whatsapp.md` | WhatsApp Cloud API: architecture only - env var names reserved in `.env.example`, no send path exists | Planned |
| `integrations/market-data-providers.md` | Provider abstraction (`workers/stock_scanner/market_data.py`), yfinance today, Finnhub optional, swap rules | Planned |

### runbooks/ - operating the system

| Doc | Purpose | Status |
|---|---|---|
| `runbooks/scanner-run.md` | Running, scheduling, and debugging the hourly scanner (`npm run worker:scan`, scheduler guard, GitHub Actions) | Planned |
| `runbooks/incident-response.md` | What to do when alerts misfire, data goes stale, or a kill switch trips | Planned |
| `runbooks/kill-switch-drill.md` | Exercising every kill switch and verifying the risk engine fails closed | Planned |

### testing/ - quality gates

| Doc | Purpose | Status |
|---|---|---|
| `testing/test-strategy.md` | Test posture: pytest worker suite (`tests/`), vitest frontend suite (`src/lib/__tests__/`), contract test register, future AI evals | Planned |

### product/ - what Lyra is and where it goes

| Doc | Purpose | Status |
|---|---|---|
| [`vision.md`](./vision.md) | Product vision | Shipped |
| [`horizons.md`](./horizons.md) | Delivery horizons | Shipped |
| [`onboarding.md`](./onboarding.md) | Onboarding flow design | Shipped |
| [`ai-engine-plan.md`](./ai-engine-plan.md) | AI engine delivery plan and backlog (honest current-state table) | Shipped |
| [`ai-notification-layer.md`](./ai-notification-layer.md) | AI notification layer contracts spec (companion to `contracts/notifications/`) | Shipped |
| [`PATH-TO-PRODUCTION.md`](./PATH-TO-PRODUCTION.md) | Path to production | Shipped |
| [`PRODUCTION-HARDENING.md`](./PRODUCTION-HARDENING.md) | Production hardening notes | Shipped |
| [`MULTI-USER-GO-LIVE.md`](./MULTI-USER-GO-LIVE.md) | Multi-user go-live plan | Shipped |
| [`integration-plan.md`](./integration-plan.md) | Integration plan | Shipped |
| [`mobile-packaging-research.md`](./mobile-packaging-research.md) | Mobile packaging research | Shipped |

### Root-level companions

| Doc | Purpose |
|---|---|
| [`../README.md`](../README.md) | App overview and getting started |
| [`../QUICKSTART.md`](../QUICKSTART.md) | Fast setup |
| [`../CLAUDE.md`](../CLAUDE.md) | Agent operating guide for this app |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Change history |
| [`../content/README.md`](../content/README.md) | The AI-native editorial content layer (JSONL to generated JSON) |

## Reading order for a new engineer or agent

1. `architecture/product-technical-story.md` - what the app is and what a new user can do.
2. `architecture/system-overview.md` - the engineering map.
3. `architecture/data-flow.md` - how data actually moves.
4. `../SECURITY.md` - what must never leak.
5. `architecture/ai-native-architecture.md` - what AI may and may never do.
6. `architecture/future-trading-bot.md` - why live trading is intentionally unreachable today.