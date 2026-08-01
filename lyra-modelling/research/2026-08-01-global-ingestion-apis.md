# Global company ingestion — the free API stack for the dynamic pool

Date: 2026-08-01. Status: research + recommendation, grounded in the current code
(`workers/emerging_winner/universe_source.py`, `feature_source.py`, `DATA-ECONOMICS.md`)
and provider terms verified this week. Constraint honoured throughout: **$0/month cash
cost**, per the DATA-ECONOMICS doctrine.

---

## 1. Where the dynamic pool stands today

The pool (`universe_source.py`) is US-only:

| Layer | Source today | Coverage |
|---|---|---|
| Universe (who exists) | SEC `company_tickers.json` (~10k US filers, refetched daily, alpha-only tickers) | US (NASDAQ/NYSE/AMEX), micro→mega |
| Prices / OHLCV | yfinance (Yahoo, unofficial) | Whatever the pool feeds it |
| Fundamentals | yfinance `.info` + SEC EDGAR XBRL companyfacts (CIK-keyed) | US |
| Filings / insider / contracts | EDGAR (wired), USAspending (wired), SAM.gov / AusTender / FINRA short interest (roadmap) | US + AU roadmap |
| News / events / earnings | Finnhub free tier — **key currently unset in Actions** | US when enabled |
| Scan bound | `EW_UNIVERSE_LIMIT=300`, emergence-first ordering | ~300 of ~10k per run |

Two immediate observations before any new API:

1. **The Finnhub key is free and unset.** DATA-ECONOMICS section 5 already flags this as
   the $0 switch that lights up the events/fundamentals/intelligence workers. Flip it first.
2. **The pool already reaches US small caps** — the SEC listing includes every filer. The
   gap is (a) non-US markets and (b) the 300-name slice never rotating past the front of
   the list (see §5).

---

## 2. The free-tier reality check (verified 2026-08)

The commercial APIs' free tiers are almost all **US-only or too small to matter**. This is
the landscape the recommendation is built on:

| Provider | Free tier | Markets on free | Verdict for Lyra |
|---|---|---|---|
| **Finnhub** | 60 calls/min, no daily cap | US only (international is paid) | **Use** — US news/earnings/profiles enrichment. Key is free; set it. |
| **Twelve Data** | 800 credits/day, 8/min | Core markets on free; non-core trial-gated | **Use sparingly** — the one keyed API with some non-US room; good for a small daily ASX/LSE quota. |
| **Tiingo** | 1,000 req/day, 500 unique symbols/month | US (+ some China) | Optional US backup; the 500-symbol/month cap fights a rotating pool. |
| **FMP** | 250 req/day, EOD only, ~5y history | **US only** (UK/Canada at $59/mo, global at $149/mo) | Skip for global; marginal US supplement at best. |
| **Polygon** | 5 calls/min | US only | Skip on free. |
| **Alpha Vantage** | 25 req/day | Global nominally | Too small for a pool; only useful as a spot-check tool. |
| **Marketstack** | 100 req/**month** | Global (70+ exchanges) | Too small; ignore. |
| **EODHD** | ~20 calls/day demo | Global on paid only | Skip on free. |
| **yfinance (Yahoo)** | Unofficial, no key, informal throttling | **Global** — `.AX`, `.L`, `.TO`, `.DE`, `.PA`, `.T`, `.HK`, `.NS`, … | **Keep as the workhorse.** Already proven at ~13.6k fetches/mo. Never a commercial source (known, accepted risk). |
| **Stooq** | Free bulk EOD downloads (`stooq.com/db/h/`) + per-symbol CSV | Global (US, UK, DE, JP, HK, PL, …) | **Use** — bulk historical backfill and a second free price source when Yahoo throttles. |

The conclusion falls out directly: **going global for free means authoritative
exchange/regulator listings for the universe, Yahoo (+Stooq fallback) for the data, and
the keyed free APIs only as US enrichment.** No paid switch required.

---

## 3. Recommended stack, by layer

### Layer A — Universe: who exists in each market (the pool's source of truth)

Per-market authoritative, free, no-key listings — the same pattern as
`company_tickers.json`, one loader per market:

| Market | Source | Notes |
|---|---|---|
| **US** (keep) | SEC `company_tickers.json` | Already wired. Adds CIK for EDGAR — keep as primary. |
| **US** (add) | NasdaqTrader symbol directory (`nasdaqlisted.txt` / `otherlisted.txt`) | Free flat files, refreshed nightly; adds exchange + ETF/test-issue flags the SEC file lacks; catches non-filer listings. |
| **AU** | ASX company directory CSV (asx.com.au → Markets → Company directory) | Official full listing (~2,000 names) with GICS group; the unofficial `asx.com.au/asx/1/company/{code}` JSON adds per-company detail. Pairs with the AusTender roadmap ingester. |
| **Global seed** | **FinanceDatabase** (JerBouma, GitHub) | 300k+ symbols across ~100 exchanges with sector/industry/country and **market-cap bucket** per name, keyed by Yahoo-suffix tickers — i.e. it plugs straight into yfinance. `pip install financedatabase`; refresh on their release cadence. This is the fastest honest route to LSE/TSX/Xetra/Tokyo/HK/India pools without scraping each exchange. |
| **UK** (later, authoritative) | LSE issuer list (monthly download) / Companies House API (free key) | Only when the UK pool graduates from FinanceDatabase seed to first-class market. |
| **Identity resolution** (optional) | OpenFIGI (free key, batch mapping) + GLEIF LEI API (free, no key) | Cross-market dedupe (same company, multiple listings — e.g. BHP on ASX+LSE) and entity metadata. Add when multi-listing collisions actually appear in the pool. |

**Design rule that keeps this honest:** every market's loader has the same shape as
`load_sec_listing()` — fetch live, cache ~24h, fall back to last cache, log
"scanned N of M". New listings appear within a day; nothing is hardcoded.

### Layer B — Prices/OHLCV: unchanged engine, global symbols

- **yfinance stays primary.** It already covers every market above via Yahoo suffixes, and
  `feature_source.py` needs zero changes — the pool just starts emitting `XRO.AX`,
  `RR.L`-style symbols with a per-market suffix map. Same indicators, same maths.
- **Stooq as backfill + fallback**: free bulk historical EOD per exchange for training-era
  history, and a second live source when Yahoo throttles a region. Worth a
  `MARKET_DATA_PROVIDER=stooq` implementation of the existing provider protocol.
- **Twelve Data (800 credits/day)** as the keyed safety valve for a *small, prioritised*
  non-US quota (e.g. the AU emergence shortlist daily) — not for sweeping the pool.

### Layer C — Fundamentals: regulator-first, best-effort elsewhere

- **US:** EDGAR XBRL companyfacts (wired) — keep as the trend-quality source.
- **All markets:** yfinance `.info` (market cap, float, revenue growth, D/E, sector) works
  for non-US names exactly as it does today; domains stay honestly `partial` where it's thin.
- **AU:** no free EDGAR equivalent — ASX announcements (unofficial JSON per company) +
  yfinance fundamentals is the honest free ceiling. Deeper AU fundamentals are a paid
  switch to note in COSTS.md, not a blocker.
- **Cap-tier classification for the pool:** market cap in **native currency × free FX**
  (see Layer E) → USD buckets: mega ≥ \$200B, large ≥ \$10B, mid ≥ \$2B, small ≥ \$300M,
  micro < \$300M. FinanceDatabase's own bucket is the seed label before first live fetch.

### Layer D — Filings, contracts, events (evidence domains)

Unchanged from the small-cap-research roadmap, now with market symmetry: EDGAR + Form 4 +
13F and USAspending/SAM.gov (US); AusTender OCDS + ASX announcements (AU); FINRA short
interest files (US, free download). Finnhub free covers earnings calendar + IPOs + news
for US the day the key is set.

### Layer E — FX normalisation (new, required for a global pool)

One tiny free dependency makes cross-market cap tiers and dollar-volume liquidity gates
comparable: **Frankfurter API** (ECB reference rates, free, no key, no limit that matters
at one fetch/day). Cache daily; AUD/GBP/EUR/JPY→USD is all the pool needs.

---

## 4. What NOT to add (and why)

- **No paid switches**: Polygon/EODHD/FMP-global solve nothing the stack above doesn't,
  at \$50–150/mo. They become relevant only if Lyra needs *licensed, SLA-backed* data
  (commercialisation gate — same class as the Vercel licensing tripwire).
- **No multi-key rotation across free tiers** to fake a bigger quota — ToS-fragile,
  operationally noisy, and against the repo's "honest coverage" doctrine. The design
  scales by *rotating the pool through time* (§5), not by squeezing providers.
- **Marketstack / Alpha Vantage as pool feeds** — 100/mo and 25/day are decorative.

---

## 5. Making the dynamic pool actually cover small→mega, globally

The bound isn't the API list — it's `EW_UNIVERSE_LIMIT=300` always taking the *front* of
the list, so the back ~9,700 US names (and any new market) never get scanned. Three
mechanical changes complete the system:

1. **Stratified pool assembly.** Build the pool as interleaved strata rather than one
   ordered list: curated emergence names → micro/small (the engine's target class, so it
   gets the largest slice) → mid → large/mega (cheap to cover; few names). Per market.
2. **Rotating scan window.** Persist a per-market cursor (one row; Supabase cost ≈ zero)
   and advance it each run: 300 names/run × ~4.6 scans/day ≈ 1,380 name-scans/day →
   the full ~10k US listing every ~7 days, or US + ASX (~12k) every ~9 days, while the
   emergence shortlist still scans every run. Log "scanned N of M, window at K" so
   coverage stays stated, never implied.
3. **Freshness = the existing pattern.** Every listing loader refetches daily with cache
   fallback, so IPOs and new registrants enter the pool within a day, in every market —
   the property `universe_source.py` already has, generalised.

**Rate-limit sanity check** (vs measured usage in DATA-ECONOMICS): the rotation adds
~1.4k yfinance fetches/day ≈ 42k/mo vs ~13.6k/mo today — a 3× increase on an unofficial
source with no published limit. Mitigations already in-pattern: per-symbol tolerance of
missing bars, Stooq fallback, and the window cursor means a throttled run resumes, not
restarts. Zero new dollars; the only new spend is GitHub Actions minutes, which are free
on a public repo.

---

## 6. Rollout order (all free, in effort order)

1. **Set `FINNHUB_API_KEY`** in the Actions env — zero code, lights up three workers (US).
2. **Rotating window + stratified ordering** in `universe_source.py` — completes honest
   US small→mega coverage with no new dependency.
3. **ASX loader** (official directory CSV → `.AX` suffix map) + AUD via Frankfurter —
   first non-US market, aligned with the AusTender roadmap and the home market.
4. **FinanceDatabase seed** for LSE/TSX/Xetra/Tokyo/HK pools behind a per-market flag —
   global breadth, still yfinance-powered.
5. **Stooq provider** implementing the existing `MarketDataProvider` protocol — backfill
   + fallback resilience.
6. **OpenFIGI/GLEIF dedupe** once cross-listings measurably collide in the pool.

Each step keeps the standing invariants: coverage logged as "N of M", domains read
`unavailable` rather than fabricated, and the cash line in DATA-ECONOMICS stays **$0/mo**.

---

## Sources

- Free-tier landscape: [Grokipedia — free stock market APIs in 2026](https://grokipedia.com/page/Free_stock_market_APIs_in_2026); [Finnhub pricing](https://finnhub.io/pricing); [Twelve Data pricing](https://twelvedata.com/pricing) & [exchanges](https://twelvedata.com/exchanges); [FMP free-tier review](https://www.findmymoat.com/tools/financial-modeling-prep-fmp); [EODHD pricing](https://eodhd.com/pricing)
- Universe sources: [SEC company_tickers.json](https://www.sec.gov/files/company_tickers.json); [ASX company directory](https://www.asx.com.au/markets/trade-our-cash-market/directory); [pyasx (unofficial ASX JSON)](https://github.com/jericmac/pyasx); [FinanceDatabase](https://github.com/JerBouma/FinanceDatabase); [Stooq bulk historical data](https://stooq.com/db/h/)
