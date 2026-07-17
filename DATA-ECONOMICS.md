# DATA-ECONOMICS.md - measured usage and free-tier runway

[`COSTS.md`](./COSTS.md) answers "what does each service cost?" (list prices). This file answers
"what does THIS deployment actually consume, and when does a free tier run out?" - measured from
the live database and CI history, not estimated from vibes. Every number below is either
**measured** (queried from prod / workflow logs) or **est** (derived, marked as such).

**Measured 2026-07-17 UTC.** Numbers drift - the [Refresh](#7-refresh-these-numbers) section at
the bottom regenerates every measurement in this file.

---

## TL;DR

| Question | Answer |
|---|---|
| Cash cost today | **$0/mo** - every dependency is on a free tier; the repo is public so GitHub Actions is unconditionally free |
| Database used | **87 MB of 500 MB** Supabase free tier (17%), 89 public tables |
| Database growth | **~1.1 MB/day ≈ 33 MB/mo** measured - free tier lasts **~11-13 more months** with zero intervention |
| Biggest grower | `stock_candles` - ~45% of all growth; a 180-day candle retention policy is the single biggest runway lever |
| Biggest compute consumer | Hourly scanner: ~4.6 executed scans/day (measured), 5-8 min each, all free (public repo) |
| AI spend ceiling | Hosted budget hard-capped at 250k tokens/day = **~US$1.13/day worst case** at gpt-5.4-mini prices; real spend ≈ $0 (BYOK-first) |
| Dormant paid switches | Firecrawl ~US$16/mo, X API ~US$200/mo, WhatsApp templates, Supabase Pro US$25/mo - all OFF today |

---

## 1. The metronome - every scheduled job we run

| Job | Schedule | Measured cadence | Duration | External calls per run | Rows written per run |
|---|---|---|---|---|---|
| Hourly stock scanner (GHA) | cron `:17` + `:47` hourly | **32 executed scans / 7 days** (~4.6/day - market-hours gated; off-hours fires exit early) | 5-8 min (measured) | ~99 yfinance symbol fetches | ~282 candles, ~22 alerts, ~15 signals + scores + indicators (measured avg) |
| Nightly maintenance (GHA) | `22:05` UTC Mon-Fri | ~22 runs/mo | ~10 min full pass (est) | ~36 RSS fetches (scout), Finnhub 0 while key unset, 1 sweep POST to Vercel | scout items (~434 first night, est 50-150/night steady), ~70 outcomes, efficacy rebuild, digest events |
| RBA decision alert (GHA) | `03:31`/`04:31` UTC weekdays, seasonal months | ~22 runs/mo | 1-2 min | 1-2 RBA page fetches | 0-2 notification events (decision days only) |
| gov-awards ingestion (Vercel cron) | `13:00` UTC daily | 30/mo | seconds | 1 USASpending API call | small upserts |
| CI + Deploy Smoke (GHA) | per push | ~6-10 pushes/day lately (two live sessions) | ~3 min + ~3-4 min | npm/pip registries | none |

**GitHub Actions minutes, all-in (est):** scanner full scans ~27 min/day + off-hours gate exits
(~48 cron fires/day at ~1 min) + nightly ~10 min + CI/smoke ~50 min/day ≈ **3,500-4,500 min/mo**.
Cost: **$0** (public repo, standard runners). If the repo ever went private: 2,000 free min/mo,
then ~US$0.008/min ≈ **US$12-20/mo** at current cadence. Going private is the only way the
scanner starts costing money.

---

## 2. Everything we depend on - call volume vs the provider's gate

One row per external dependency. "Headroom" is how far current usage sits from the free gate.

| Dependency | Used by | Volume (measured/est) | Free-tier gate | Headroom | When the gate hits |
|---|---|---|---|---|---|
| **Supabase** (Postgres + REST + Auth) | everything | 87 MB DB; API requests uncapped on free | 500 MB DB, 5 GB egress/mo, 50k MAU, pauses after 7 idle days | ~11-13 mo on DB (section 4); MAU ~2 of 50k; idle-pause impossible while nightly crons live | project restricted (no paid overage on free) -> Supabase Pro US$25/mo |
| **yfinance** (Yahoo, unofficial) | scanner, market data | ~99 symbols x 137 scans/mo ≈ **~13.6k fetches/mo** (est) | none published - informal throttling, no SLA | unknowable by design | scans degrade / miss candles; scanner logs the misses. Never a commercial data source |
| **Finnhub** | events, fundamentals, intelligence workers | **0 calls/mo - key unset in Actions env** (measured from run logs) | 30 calls/sec (verified; see COSTS.md) | infinite while unset; ~100-300 calls/night when enabled - trivially inside the gate | n/a at our scale |
| **USASpending API** | gov-awards Vercel cron | 30 calls/mo | public API, no key | effectively unlimited | n/a |
| **RBA website** | rate-decision alert | ~44 fetches/mo, seasonal | none (public pages) | fetch from GHA runner works; Vercel datacenter IPs are blocked (known gotcha) | fetch fails -> degraded no-number alert path |
| **Telegram Bot API** | alert delivery | 162 deliveries lifetime (measured, all channels combined) | free; ~1 msg/sec per chat | vast | n/a at our scale |
| **Slack** (incoming webhook) | alert delivery | trivial | free; ~1 msg/sec per webhook | vast | n/a |
| **Web Push (VAPID)** | alert delivery | 2 subscriptions (measured) | free by W3C design | n/a | n/a |
| **WhatsApp Cloud API** | architecture-only | 0 | service replies free; business-initiated templates billed per message | $0 until templates are wired | Meta conversation pricing the day we wire it |
| **Vercel Hobby** | web app + 1 cron | single-digit users; 1 of 2 Hobby cron slots used | 100 GB transfer/mo, 1M invocations/mo, **personal/non-commercial only** | vast on volume | the real gate is the licence, not volume: charging users -> Pro US$20/mo or Coolify (~US$13/mo, see COSTS.md) |
| **GitHub Actions** | all scheduled compute | ~3,500-4,500 min/mo (est above) | unconditionally free (public repo) | infinite while public | private repo -> ~US$12-20/mo |
| **Sentry** | error tracking (`lyra-observability-sentry`) | near zero | Developer plan ~5k errors/mo | vast | error storm during an incident could clip the month's quota |
| **OpenAI / Anthropic / Google** (BYOK or hosted key) | copilot, scout briefs, paper-bot | hosted budget: 2,000 tokens/run, **250,000 tokens/day hard ceiling** (`LYRA_HOSTED_TOKENS_PER_*`); per-scope rate limits (scout_brief 6/min, paper-bot, signals 30/min...) | user's own key = user pays; hosted key = our ceiling | ceiling worst case ≈ US$1.13/day (mini) / US$0.31/day (nano) ≈ **US$7-25/mo if hammered every day**; real spend ≈ $0 | budget verdict blocks the call - template/deterministic fallback stands, nothing errors |
| **Firecrawl** | 22 of 100 scout sources | 0 - key unset | ~500 one-time free credits | 22 sources/night would burn free credits in ~1 month -> effectively a paid switch | Hobby ~US$16/mo when we want those sources |
| **X API** | 41 of 100 scout sources | 0 - key unset | free tier has no meaningful read access | n/a | Basic ~US$200/mo - the only expensive switch on the board |
| **Upstash Redis** (optional) | shared cache | not provisioned - in-process fallback active | command-metered free tier | n/a | n/a |

**The scout today runs on the 36 open RSS sources + 1 API source of its 100-source registry**
(measured: 36 rss / 22 crawl / 41 x / 1 api). 63 sources stay dark until the two paid switches flip.

---

## 3. Supabase table economics (measured from prod)

Top tables by size, with measured growth. `bytes/row` includes indexes (total relation size / live rows).

| Table | Rows | Size | bytes/row | Growth (measured) | Retention | 12-mo projection |
|---|---|---|---|---|---|---|
| `stock_candles` | 139,445 | 51 MB | ~380 B | **1,287 rows/day** (9,009/7d) ≈ 0.49 MB/day | none | **+177 MB -> ~228 MB** |
| `stock_alerts` | 4,311 | 9.0 MB | ~2.1 kB | **102 rows/day** (716/7d) ≈ 0.22 MB/day | none | +79 MB -> ~88 MB |
| `stock_signals` | 2,080 | 5.0 MB | ~2.4 kB | ~69 rows/day (30d avg) | none | +61 MB -> ~66 MB |
| `stock_signal_scores` | 2,080 | 2.2 MB | ~1.1 kB | ~69 rows/day | none | +27 MB |
| `stock_indicators` | 2,080 | 1.2 MB | ~0.6 kB | ~69 rows/day | none | +15 MB |
| `signal_outcomes` | 647 | 0.7 MB | ~1.1 kB | ~69 rows/day at steady state | none | +27 MB |
| `scout_items` | 434 | 1.1 MB | ~2.5 kB | est 50-150/night after first-night backfill | **90 days** (pruned nightly) | plateaus ~10-30 MB by October, then ~flat |
| `notification_events` + `notification_deliveries` | 81 + 162 | 0.4 MB | ~2-2.5 kB | low single digits/day | none | +1-2 MB |
| everything else (80 tables) | small | ~16 MB | - | < 1 MB/mo combined | varies | +5-10 MB |
| **whole database** | - | **87 MB** | - | **~1.1 MB/day ≈ 33 MB/mo** | - | **~480 MB in 12 mo without intervention** |

Notes:
- The five learning ledgers shipped in v0.59.0 (`notification_engagements`, `component_efficacy`,
  `scout_attach_exceptions`, plus the two repo JSONL files) are at **0 rows** - they start
  accumulating with tonight's nightly and are all either bounded (efficacy is a full rebuild,
  ~hundreds of rows max) or human-paced. Not a growth concern.
- `news_items` currently persists **0 rows/night** - every write is rejected by a legacy `title`
  not-null constraint (known bug, intelligence worker lane). Its growth is counted at zero until fixed;
  when fixed it adds ~25 tiny rows/night.
- `ai_runs` is metrics-only (1 row) and `chat_turns` is consent-gated (0 rows) - neither moves the needle.

---

## 4. Runway and tripwires

| Resource | Today | Burn rate | Runs out | Tripwire -> action |
|---|---|---|---|---|
| Supabase 500 MB DB | 87 MB | ~33 MB/mo | **~mid-2027** | At **300 MB**: add 180-day retention on `stock_candles` (caps it at ~88 MB and cuts total burn ~45%); consider archiving closed alerts/signals older than 1 year. At 450 MB: Supabase Pro US$25/mo |
| Supabase 5 GB egress/mo | well under 1 GB (est - not SQL-measurable; read the Supabase dashboard Reports -> Egress) | scales with page views, not crons (workers mostly write) | not soon | At 3 GB/mo: cache candle/chart reads (Upstash free tier is pre-wired as an optional dependency) |
| Supabase idle pause (7 days) | impossible - nightly + hourly crons write continuously | - | never while crons live | GHA keepalive steps already reset the 60-day workflow auto-disable clock |
| Vercel Hobby | tiny fraction of 100 GB / 1M invocations | scales with audience | volume: not soon | The binding constraint is **licensing**: first paying user -> Vercel Pro (US$20/mo) or Coolify (~US$13/mo) |
| GitHub Actions | $0 (public) | ~4,000 min/mo | never while public | Going private -> ~US$12-20/mo at current cadence |
| Hosted AI budget | ≈ $0 | hard ceiling 250k tokens/day | can't overrun - budget verdict blocks, fallback stands | Raise `LYRA_HOSTED_TOKENS_PER_DAY` only with a costed reason |

The honest summary: **nothing needs money for about a year**, the first real invoice is either
Supabase Pro (US$25/mo, mid-2027, avoidable with one retention policy) or a licensing-driven
Vercel Pro / droplet the day Lyra charges users.

---

## 5. The cost switchboard - what each dormant key would add

| Switch | Cost | What it unlocks | Worth it when |
|---|---|---|---|
| `FINNHUB_API_KEY` | **$0** (free tier covers us ~100x over) | events/fundamentals/intelligence workers fetch real data nightly | immediately - it is free and currently unset |
| `FIRECRAWL_API_KEY` | ~US$16/mo (free credits last ~1 month at 22 sources/night) | 22 crawl-only scout sources (e.g. DoD daily contracts) | when scout cards start driving decisions |
| X API key | ~US$200/mo (Basic) | 41 voice/insider scout sources | the expensive one - only with clear signal value |
| WhatsApp templates | per-message (Meta pricing) | business-initiated WhatsApp alerts | probably never - Telegram covers it free |
| Hosted AI key funded higher | linear with ceiling | more copilot/brief calls per day for anonymous users | if hosted-beta usage actually hits the 250k/day ceiling |
| Supabase Pro | US$25/mo | 8 GB disk, 250 GB egress, no pause | at the 450 MB tripwire, or first real multi-user load |

---

## 6. Method - where each number came from

- **Table sizes/rows:** `pg_stat_user_tables` + `pg_total_relation_size` on prod via the pooler.
- **Growth rates:** `count(*) filter (where created_at > now() - interval '7 days')` on the hot
  tables; 30-day lifetime averages where a table is younger than 7 days of steady state.
- **Scan cadence + writes/run:** `stock_scanner_runs` count over 7 days, divided into the same
  window's candle/alert counts.
- **Workflow durations:** `gh run list` timestamps (startedAt -> updatedAt).
- **Scout source mix:** `src/lib/generated/scout-sources.json` method counts.
- **Provider prices/limits:** [`COSTS.md`](./COSTS.md) - list prices live there, not here; where
  COSTS.md marks a limit "indicative", so is the headroom math built on it.

## 7. Refresh these numbers

```bash
# DB size + top tables (run against prod pooler)
psql "$SUPABASE_POOLER_URL" -c "select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname))) from pg_stat_user_tables where schemaname='public' order by pg_total_relation_size(format('%I.%I', schemaname, relname)) desc limit 15;" \
  -c "select pg_size_pretty(pg_database_size(current_database()));"

# 7-day growth on the hot tables
psql "$SUPABASE_POOLER_URL" -c "select (select count(*) from stock_candles where created_at > now() - interval '7 days') candles_7d, (select count(*) from stock_alerts where created_at > now() - interval '7 days') alerts_7d, (select count(*) from stock_scanner_runs where created_at > now() - interval '7 days') scans_7d;"

# Workflow minutes
for wf in hourly-stock-scanner nightly-maintenance ci deploy-smoke; do gh run list --workflow=$wf.yml --limit 5 --json startedAt,updatedAt,conclusion -q '.[] | "\(.conclusion) \(((.updatedAt|fromdate) - (.startedAt|fromdate))/60|floor)m"'; done
```

Re-measure quarterly, or whenever a new writer joins the nightly (a new accumulator, a new worker) -
then update the measured-at date at the top. If a number in this file and a fresh measurement
disagree, the measurement wins and this file gets corrected.
