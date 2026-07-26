# DATA-FLOW.md - Where Lyra's numbers come from

How each deployment gets its signal data, grounded in the code. The scoring math is
identical everywhere - `src/lib/live-signals.ts` is a faithful TypeScript port of
`workers/stock_scanner/{indicators,signal_engine}.py` - so a given name scores the same
in Solo and Prod. What differs is *where the data comes from* and *what wraps around it*.

The one law holds in both: the deterministic engine computes the score, the frontend only
renders backend-owned truth, and the AI (when present) only explains - it never invents a
number and never touches the decision path.

---

## The two deployments at a glance

| | **Solo** (`solo.lyra.vivacityai.com.au`) | **Prod / Full** (`lyra.vivacityai.com.au`) |
|---|---|---|
| Database | None (no Supabase) | Supabase (accounts, RLS-scoped) |
| Where signals come from | Computed live, on page load | Read from a stored hourly scan, plus a live overlay |
| Universe | A fixed, curated ticker set | The full scanned universe (few hundred names) |
| Data cadence | Daily bars, recomputed each load (10-min cache) | True hourly scan accumulated as history + live overlay on read |
| History / trend | None (fresh snapshot each load) | Yes (score deltas, outcome labels, coaching) |
| Portfolio / watchlist | Device-local only (this browser) | Saved to your account, synced across devices |
| Notifications | None | Push, Telegram, Slack |
| AI | Bring-your-own-key only | Hosted free for 14 days, then bring-your-own-key |
| Sign-up | None | Required |

Same score model both sides. The account is what adds the memory, the reach, and the
personalisation around it.

---

## Solo - computed live, on the spot

Solo has no database, so it cannot read a pre-scanned signal table. Instead its own server
computes every signal on the fly when the page loads.

```
Solo page load
   |
   v
data.ts  getDashboardData()  ->  Supabase client is null  ->  Solo path
   |
   v
applyLiveSignals(demoDashboardData.signals)          (data.ts:403)   <- curated ticker set
   |
   v
fetch Yahoo Finance (public, no key)                 (live-signals.ts:61)
   https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1y&interval=1d
   - 1 year of DAILY candles
   - cached 10 min per symbol (next: { revalidate: 600 })
   |
   v
recompute server-side (TS port of the Python worker):
   Wilder RSI(14) . MACD(12,26,9) . SMA 20/50/200 . volume ratio .
   distance-from-60-low . the weighted score . thresholds (strong >= 75, watch >= 60)
   |
   v
overlay onto the ticker rows  ->  buildSoloMarketDashboard()          (data.ts:404)
   |
   v
render
   |
   +-- any symbol's fetch/parse fails  ->  keep that symbol's static demo number (fail-soft)
```

**One line:** Solo's server pulls a year of daily OHLCV straight from Yahoo Finance
(`live-signals.ts:61`), recomputes the exact same RSI/MACD/score in TypeScript, and renders
it. No database, no account, no API key. The frontend still never does the math - here the
"backend" is Solo's own server render calling Yahoo.

**Honest limits:** fixed universe, daily (not hourly) granularity, no stored history, no
notifications. It is a real, live, correctly-scored taste of the engine - just stateless
and on a fixed list.

---

## Prod / Full - a stored hourly scan, plus a live overlay, plus your account

Prod is a two-part system: a background loop that scans the whole universe and *stores* it,
and a read path that serves that stored truth with a live overlay and your own account data
layered on top.

### Part 1 - the background write loop (runs without anyone watching)

```
GitHub Actions . hourly     (.github/workflows/hourly-stock-scanner.yml)
   |
   v
Python worker               (workers/stock_scanner/)
   - load the FULL universe (few hundred names)
   - fetch market data via yfinance (Yahoo)
   - indicators.py    -> Wilder RSI(14), MACD(12,26,9), SMA 20/50/200, volume ratio
   - signal_engine.py  calculate_score()  -> the weighted score + status/lifecycle
   - overlays (portfolio / watchlist), alert payloads
   |
   v
PERSIST to Supabase:  stock_signals . stock_tickers . stock_scanner_runs . stock_alerts
   |
   +-- accumulates HISTORY hour after hour (the thing Solo throws away)
```

### Part 2 - the read path (each page load)

```
Prod page load
   |
   v
data.ts  getDashboardData()  ->  createSupabaseServerClient()          (data.ts:398)
   cookie-aware; RLS scopes private rows to the signed-in user
   |
   v
read latest stored rows in parallel                                    (data.ts:411-418)
   stock_tickers <=500 . stock_signals latest 80 .
   stock_scanner_runs latest 1 . stock_alerts latest 20
   |
   v
applyLiveSignals(...)                                                  (data.ts:433)
   the SAME Yahoo daily-OHLCV overlay Solo uses, re-run ONCE so the on-screen
   score matches the live chart, not the hour-old stored row
   |
   v
layer YOUR account data, scoped to your user_id via RLS               (data.ts:447-455)
   portfolio_positions . portfolio_signal_overlay .
   watchlist_items . watchlist_signal_overlay
   |
   v
render  ->  generatedFrom: 'supabase'                                  (data.ts:483)
   |
   +-- any table errors, or signed out  ->  per-field fall back to demo (data.ts:421,476,495)
```

**One line:** Prod reads the deterministic signals a Python worker scanned across the full
universe every hour and stored in Supabase (`data.ts:411`), re-applies the exact same live
Yahoo overlay Solo uses so the number is current (`data.ts:433`), then layers your own
portfolio and watchlist on top (`data.ts:447`), all row-level-scoped to you by RLS.

**What the stored loop buys over Solo:**

1. **The full universe, not a fixed list.** The worker sweeps a few hundred names hourly.
2. **History and learning.** Every hour is stored, so Prod has trend-over-time, score
   deltas (improving / weakening), and a nightly maintenance worker that labels outcomes
   and sends coaching follow-ups.
3. **Resilience.** A stored baseline means a momentary Yahoo failure still shows the last
   good scan, instead of failing soft to demo numbers.
4. **Everything account-shaped:** notifications (push, Telegram, Slack), saved portfolio
   and watchlist synced across devices, and hosted AI free for 14 days then BYOK.

---

## Code reference index

Line numbers are accurate as of this writing; if they drift, the function names are stable.

| What | File | Anchor |
|---|---|---|
| Dashboard data entry point (branches Solo vs Prod) | `src/lib/data.ts` | `getDashboardData()` (line 395) |
| Solo path (no Supabase) | `src/lib/data.ts` | lines 399-404 |
| Prod stored-signal reads | `src/lib/data.ts` | lines 411-418 |
| Live Yahoo overlay applied (both sides) | `src/lib/data.ts` | line 433 |
| Account portfolio / watchlist reads (RLS-scoped) | `src/lib/data.ts` | lines 447-455 |
| Live signal recompute (TS port of the worker) | `src/lib/live-signals.ts` | `applyLiveSignals()` (line 364) |
| Yahoo fetch (daily OHLCV, public, cached) | `src/lib/live-signals.ts` | `fetchOhlcv()` (line 61) |
| Thresholds (strong 75 / watch 60 / change 8) | `src/lib/live-signals.ts` | lines 25-27 |
| Solo dashboard assembly | `src/lib/local-dashboard.ts` | `buildSoloMarketDashboard()` |
| Indicators (source of truth) | `workers/stock_scanner/indicators.py` | RSI / MACD / SMA / volume |
| Score (source of truth) | `workers/stock_scanner/signal_engine.py` | `calculate_score()` |
| Hourly scan schedule | `.github/workflows/hourly-stock-scanner.yml` | cron |

For the wider system (scoring weights, notification router, scout, AI copilot, paper bot,
release loop), see `HOW-LYRA-WORKS.md` and `LOOPS.md`.
