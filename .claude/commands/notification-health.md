# /notification-health - keep every alert channel delivering and every template complete

You are Claude Code running in the Lyra repo. Run the notification upkeep loop: measure
delivery, sweep the stuck, keep the contract surface complete across every channel, and
keep coaching content (digests, follow-ups, voice presets) engine-owned. This chain owns
`src/lib/notifications/`, `src/lib/push/`, `contracts/notifications/`,
`src/app/api/notifications|push|webhooks/`, `src/lib/alert-prefs.ts`, and the worker
dispatch seam (`workers/stock_scanner/notification_dispatch.py`, `digest_job.py`).
Doctrine: **personality rewords the framing line ONLY - every number in a notification is
engine-owned; quiet hours defer, they never drop.**

## What already exists (build WITH it)

- **The spine** - event -> `router.ts` (pure: prefs, quiet-hours hold/release, dedupe) ->
  `dispatch.ts` -> channel adapters (`telegram.ts`, `slack.ts` SSRF-fenced to
  hooks.slack.com, `whatsapp.ts` template-gated, Web Push via `src/lib/push/`).
- **The sweep** - `sweepNotifications` in `dispatch.ts`: releases held events for all
  users + retries failed sends once (`:retry1` idempotency suffix). Runs nightly via
  `.github/workflows/nightly-maintenance.yml` posting `{"sweep":true}` to
  `/api/notifications/dispatch` with the dispatch secret.
- **Contracts** - `contracts/notifications/` (schema, templates, test register) enforced
  by `src/lib/notifications/__tests__/contracts.test.ts`.
- **Voice presets** - `voice.ts` (Analyst/Coach/Minimal/Narrator), persisted in
  `user_alert_preferences.voice_preset`.
- **Coaching content** - daily digest / Friday weekly report (`digest_job.py`,
  `npm run worker:digest`), outcome follow-ups (`signal_followup` type; content owned by
  /signal-quality, delivery owned here).

## Stage 1 - Measure delivery

1. Pull dispatch results for the window (notification audit rows, sweep results from the
   last nightly runs, GitHub Actions logs for the sweep step).
2. Report per channel: sent, failed, retried, released-from-hold, still-stuck.

**Gate:** a per-channel delivery table with real counts, or an explicit "no data because X".

## Stage 2 - The completeness sweep (the classic drift)

A new `NotificationType` must appear in ALL of: `types.ts`, `templates.ts`
(`TYPE_LABELS`), `voice.ts` (`FAMILY_BY_TYPE`), `slack-templates.ts` (`TYPE_STYLE` +
`SIGNAL_LIKE_TYPES`), `whatsapp-templates.ts`, `contracts/notifications/`, and
`VALID_TYPES` in `src/app/api/notifications/dispatch/route.ts`. The contracts test pins
most of this - if you add a type, run it first and fix every hole it finds.

**Gate:** `npm run test -- notifications` green, contracts test included.

## Stage 3 - Fix root causes

- Stuck holds / failed sends: fix the adapter or the router, never hand-clear rows.
- Dedupe/idempotency: keys must make a retry safe (`:retry1` suffix pattern) - a fix that
  double-sends on retry is worse than the failure.
- Secrets: webhook URLs are user secrets - SSRF-fenced, redacted in every log line.

## Stage 4 - Verify + ship

1. `npm run type-check && npm run test && npm run worker:test && npm run build`.
2. Send one real probe through a configured channel if credentials exist locally.
3. Version bump via `RELEASES`, `npm run release`, commit, push, `npm run announce`.

**Done means:** delivery measured and reported, template surface hole-free across all
channels, sweeps green in Actions, shipped under a version. Explainability: the report
names which channels are healthy with counts - "notifications work" is not a status.
