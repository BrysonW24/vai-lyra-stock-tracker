# Lyra Digital Trading Twin - A Pitch Worth Falling Back To

> Date: 2026-07-16
> Status: Strategy / pitch. Forward-looking, **not committed scope**. No metrics here are real - they are illustrative. This doc exists so the idea is captured and we can fall back to it.
> Author: founder dogfooding session.
> Contract: everything below stays inside Lyra's doctrine - the deterministic engine owns every number and every decision, the AI only explains, and nothing here becomes advice. See `docs/product/product-principles.md`.

## The one-sentence pitch

A **digital trading twin** is a private, per-user model of *what you pay attention to, how you weigh risk, and which setups you actually act on* - learned quietly from how you use Lyra - that (a) reflects your own habits back to you so you can trade more deliberately, and (b) lets Lyra compose the screen for *you* instead of for everyone. Later, a twin becomes portable: a new user can be **onboarded into** an existing twin (your own, across devices, or a mentor's) as a starting posture rather than a blank slate.

The twin is a **preference and attention model, never a decision model.** It learns *where you look* and *how you frame risk* - it never learns "what to buy," never places an order, and never gives advice. The deterministic score still decides what is a signal; the twin only decides what to *show you first* and how to *frame it for your risk posture*.

---

## Why this is the right bet for Lyra

Lyra today is a dense, deterministic, research-first console. Its weakness is the same as its strength: **it is fixed.** Every user sees the same panels, in the same order, framed the same way. The work of "what does this mean *for me*, given how *I* trade" happens entirely in the user's head.

Two things follow:

1. **Lyra can't yet help you understand your own trading.** It shows you the market. It does not show you *you* - that you keep opening late-stage "crowded" names and skipping the "funded/contracted" early ones the flagship is built to surface, or that your dwell time spikes on space/defence but you never act, or that you size up right after a loss. A twin makes that legible.
2. **Personalisation, done wrong, breaks the contract.** The temptation is to let an LLM "learn what you like and recommend it." That is an advice engine wearing a personalisation costume, and it is exactly what Lyra must never ship. The twin threads the needle: it personalises *attention and framing*, deterministically, while the engine keeps owning numbers and decisions and the AI keeps only explaining.

This pairs directly with the two forward bets already in the repo (`2026-06-18-lyra-forward-bets.md`): **GenUI** composes a view for a moment; the **twin** is the standing model of the person that GenUI composes *for*. GenUI is the "what could this look like"; the twin is the "for whom."

---

## What the twin learns (signals in)

Every input is a **first-class interaction signal** captured from surfaces Lyra already has. Nothing here needs a broker, a bank link, or PII. All of it is deterministic, observable behaviour.

### 1. Interests - what you look at

- Which **themes** and **tickers** you open, and how often (World Radar, ticker detail, `/themes`, `/supply-chain`).
- Which **convergence names** you expand on the Signal Intelligence board (`read_convergence` / `SignalIntelligenceBoard`) - and which signal *kinds* (gov-award, big-tech-backing, smart-money, bottleneck, momentum) make you lean in.
- Which **lifecycle stages** you inspect on the Emergence shortlist - do you gravitate to `concept`/`funded` (early) or `scaling`/`crowded` (late)?
- **Dwell time** and **drawer opens** on the dense StoryDrawer - depth of attention, not just clicks.
- Search and filter choices, calendar/IPO views, time-of-day and session cadence.

### 2. Habits - how you behave

- **Watchlist adds/removes** and the state a name was in when you added it (score, stage, backing strength).
- Whether you act on a **"Buy Review"** signal or let it pass; how long between a signal firing and you engaging.
- **Paper-bot** behaviour (the only place Lyra sees "action," and it is fake money by design): position sizes relative to `maxPositionSizePct`, whether you size up after a loss, how you treat a `trade_readiness` verdict, hold vs cut behaviour on `thesisSnapshot` drift.
- Which **notifications** you open vs mute, per channel and per trigger type.

### 3. Risk posture - how you weigh

- Revealed risk appetite from paper sizing + which stages you engage (early = higher variance tolerance).
- Concentration tendency (do you cluster in one theme?), chase tendency (late-stage entries), and reaction-to-drawdown pattern.
- Stated posture (`cashAvailable`, `maxPositionSizePct`, risk comfort from onboarding) reconciled against *revealed* posture - the gap between the two is itself the most useful thing the twin knows.

---

## What the twin gives back (value out)

### A. Reflection - Lyra shows you *you*

A standing, private "Your trading twin" surface, written as **research about your own behaviour**, never as advice:

- *"You inspect early-stage funded names often, but 8 of your last 10 watchlist adds were `scaling`/`crowded`. The flagship is built to find them earlier - here is where you were early vs late."*
- *"Your paper position sizes rise ~30% in the session after a losing close."* (Revealed pattern, stated neutrally. No "you should stop." Research, not advice.)
- *"You dwell longest on defence/space, but rarely act. Attention without action - worth naming."*

This is the part that "helps inform me going forward in terms of my preferences for trading, taking risk." It is a mirror, not a coach that tells you what to do.

### B. Composition - Lyra composes for you

The twin becomes a **deterministic ranking prior** the surfaces read (never a hidden filter that removes things):

- The command centre and Emergence shortlist **order** by twin-affinity *as a tiebreaker on top of the deterministic score* - your attention rises, but the score still gates what qualifies as a signal.
- GenUI (Bet 1) composes its on-the-spot view using the twin: framed to *your* `maxPositionSizePct`, foregrounding the signal kinds you trust, in the density you prefer.
- The AI copilot reads the twin as **read-only grounding** (a new read-only tool, sibling to `read_convergence`) so its explanations meet you where you are - "you usually care about the bottleneck signal here, and it is firing" - while still only explaining what is on screen.

### C. Anti-bubble guarantee (non-negotiable)

A preference model that only shows you what you already like is a filter bubble, and in markets a filter bubble is a *risk-hiding machine*. So the twin ships with an inverted duty: **it must always surface the disconfirming view.** If your twin loves a name, the twin-aware surface is *required* to show the falsifier and the risks at least as prominently. Personalisation raises attention; it may never lower the visibility of risk or disconfirming evidence. This is enforced, not aspirational.

---

## The onboarding future - a portable twin

Once a twin exists as a **portable preference profile** (a versioned, exportable object - not raw event logs), new experiences open up. This is the "down the line we have an onboarding to someone's digital trading twin" idea:

- **Cross-device / re-onboarding:** a returning user resumes their posture instantly instead of a cold start.
- **Inherit-a-posture onboarding:** a brand-new user picks a starting twin ("early-stage emerging-markets hunter," "conservative income," or *the founder's own twin*) and Lyra begins composed-for-them on day one, then diverges as it learns *them*. The blank-slate onboarding becomes a *chosen* slate.
- **Mentor / team twins:** a desk lead's twin becomes an onboarding artifact - a junior can be onboarded *into* how the lead pays attention, with Lyra narrating the difference between the mentor's posture and their own as they diverge.
- **Twin marketplace (far future, gated):** portable twins as shareable "attention presets." Strictly research posture presets - never signals, never a track record, never advice. This only ships if it can stay inside the no-advice contract; if it cannot, it does not ship.

---

## Architecture that keeps the contract

```
Interaction events  ->  Event taxonomy      ->  Preference model      ->  Twin profile (versioned)
(clicks, dwell,         (typed, tenant-         (DETERMINISTIC:            |
 watchlist, paper)       scoped, RLS)            weighted affinities,      +-> Reflection surface (research about you)
                                                 revealed-risk stats)      +-> Ranking prior (tiebreaker on score)
                                                                           +-> AI read-only grounding (explain, not decide)
```

Design rules, each a direct extension of an existing Lyra guarantee:

- **Deterministic model, not an LLM.** The twin's affinities and risk stats are computed by deterministic code (like the score, the lifecycle engine, and `signal-intelligence.ts`). The LLM never *is* the twin; it only *reads* the twin to explain. This keeps "AI explains, deterministic decides" intact.
- **Tenant-scoped + RLS, private by default.** Twin data is per-user, never cross-user, never sold, and follows the same row-level-security fence as every other user surface (`AI_NEVER`: "never read another user's data"). Portability is an explicit **export by the user**, never a background share.
- **Opt-in and inspectable.** The user can see everything the twin believes about them, correct it, pause capture, or delete it. A twin you cannot read back is a twin you cannot trust.
- **Read-only into the AI layer.** A `read_trading_twin` tool would join the existing read-only tool surface (`src/lib/ai/policy.ts` / `tools/runtime.ts`) under the same fail-closed gate - the twin is evidence the AI may cite, never a control it may action.
- **Guardrailed like every other AI output.** Any twin-informed AI text runs the same `evaluateGuardrails` verdict (advice/injection/overclaim/grounding) already wired into the run path. A reflection that drifts into "you should buy" is blocked exactly as any other advice is.
- **Demo-safe.** With no history, the twin is empty and every surface degrades to today's fixed, deterministic layout. The twin is always additive.

### Where it plugs into what exists today

| Twin needs | Already in the repo |
|---|---|
| Behavioural signals | watchlist, paper-bot, notifications open/mute, World Radar / convergence inspection |
| Deterministic modelling pattern | `src/lib/signal-intelligence.ts`, `src/lib/small-cap-lifecycle.ts` (scored, pure, tested) |
| Read-only AI access under a gate | `src/lib/ai/policy.ts`, `src/lib/ai/tools/runtime.ts` (fail-closed tool gate) |
| Output safety | `src/lib/ai/guardrails/engine.ts` (`evaluateGuardrails`) + eval-gate golden set |
| Per-user isolation | Supabase RLS multi-user auth (already the app's fence) |
| Composition target | GenUI bet (`2026-06-18-lyra-forward-bets.md`), Emergence shortlist ordering |

---

## Phased roadmap (illustrative, not committed)

- **Phase 0 - Capture.** A typed, tenant-scoped interaction-event taxonomy + write path. No modelling yet. Ships dark; proves we can see attention without touching the render. (Mirrors the platform-intelligence event-taxonomy pattern from the wider Vivacity estate.)
- **Phase 1 - Reflection.** The deterministic preference model + a private "Your trading twin" read-only surface. Pure mirror. This alone delivers the founder's core ask ("help inform me going forward").
- **Phase 2 - Composition.** Twin becomes a ranking *tiebreaker* on the deterministic score, feeds GenUI, and becomes read-only AI grounding - with the anti-bubble guarantee enforced.
- **Phase 3 - Portability + onboarding.** Export/import a versioned twin; inherit-a-posture onboarding; mentor twins. Marketplace only if it can stay research-only.

## What would make us NOT build this

Named honestly, so the fallback is a real decision and not a hype doc:

- If capture cannot be made genuinely private + inspectable + deletable, it does not ship.
- If personalisation cannot guarantee the anti-bubble duty (risk always at least as visible), it does not ship.
- If a "twin" ever needs to become a decision/advice engine to be useful, that is the signal to stop - it would break the one contract Lyra does not break.

The twin is worth building only for as long as it stays a **mirror and a lens** - never a hand on the wheel.
