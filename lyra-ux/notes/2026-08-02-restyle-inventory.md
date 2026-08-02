# Restyle inventory - 2026-08-02

Source: read-only estate sweep (273 tsx files, ~56 routes, ~40k view lines). Key facts driving
the app-wide restyle plan; full package map lives with the workflow run.

## Findings

- **Two dialects at war**: dominant "hex + terminal-panel" glass (158 files) vs newer
  "white/opacity + rounded-xl" (22 files, incl. the Model Lab reference target). Ruling in
  TOKENS.md v1.0.0: converge BOTH onto named tokens; keep the glass panel primitives.
- **No component library layer**: no shadcn, no cn(), no src/components/ui/ - all hand-rolled
  Tailwind strings. The restyle is find-and-replace-with-judgement, guided by PATTERNS.md.
- **Dead palette removed**: tailwind.config.ts carried a zero-usage light "warm paper" palette;
  deleted at tokens v1.0.0 (names `ink`/`line` repurposed for the real dark palette).
- **Font conflict**: config says SF-first sans, globals.css body overrode with Inter. P0 decides
  one (recommendation: keep the config's SF-first stack, drop the Inter override).
- **12 work packages, disjoint file ownership** (P0 foundation first; P8 onboarding + P9
  activation ship together; P1 command -> P2 signals -> P3 trading in order; P4-P7, P10, P11
  parallel). Models package is FROZEN until the Model Lab agent lands, then reconciled to tokens.
- **Priority polish targets**: P8 onboarding (worst internal inconsistency), P11 legal/marketing
  (near-plain prose pages), TradeLogView / TrackRecordView / EmergingWinnerView (dialect
  stragglers inside otherwise-polished packages).
- **Orphans to confirm before styling** (no importers found): ChatWidget, LandingShowcase,
  FeedbackWidget, InvestigationDrawerStack, FindingCard, HoldingChartCarousel.

## Guardrails for the sweep

- Never touch: src/lib/generated/*, test files (except legitimately-changed markup assertions),
  the parallel session's files (READMEs, ci.yml, MODEL-REGISTRY*, testflight/).
- Provenance banners survive every restyle (PATTERNS.md honesty rules).
- Each package agent writes a dated note here (what changed, deferred items).
- Verify stage runs type-check + build + full vitest before any ship.
