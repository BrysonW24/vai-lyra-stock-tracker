# 2026-08-14 honesty re-audit - remaining findings (next wave)

> **REGISTER CLOSED - all 35 findings fixed in v0.130.0 (2026-08-14).** Items 4 and 8
> were already dead at time of triage (their root cause, the data.ts signed-out
> demo-book substitution, shipped in v0.129.0); the other 33 were patched individually.
> Gates green: type-check, lint, check:chains, 1178/1178 tests, clean build. The one
> remaining item is the data-ops row at the bottom (prod `ipos` table content), which
> needs founder Supabase credentials and is NOT a code defect.

Source: 6-reviewer post-implementation audit (workflow wf_e33cd364-ee7) after v0.128.0 closed out all 47 original findings. The audit re-verified 45 prior fixes as holding, surfaced 42 new findings; the 3 P0s and 4 fix-regressions shipped immediately in v0.129.0/0.129.1. The items below were the still-open remainder, most-severe first. None was a fabricated number a trader could act on; all were provenance, formatting, or copy honesty.

## 1. [P1] src/components/paper-bot/PaperBotView.tsx:184 (fabricated-data)
- Issue: The tour mock-account overwrite is gated on the isTour URL param alone, not on an active tour. On /paper-bot?tour=true with the tour already dismissed (tourStep -1, the state every returning visitor from the dashboard 'Start your first trade' link lands in), a REAL executed fill (the call() body sends tour:false, so the server records it durably) triggers setAccount with a fabricated snapshot: equity and equityCurve reset to DEFAULT_PAPER_STARTING_CASH, all prior positions dropped, fillCount 1, winRate 0. The fabricated Buying Power / equity / curve stand in for the real account (labelled 'Session' by the chip, since dataSource 'demo' has no distinct rendering) until the next 15s poll replaces it.
- Evidence: if ((isTour || intent.reasonCode === 'tour_mode') && r.fill) { ... setAccount({ positions: [{ symbol: r.fill.symbol, ... }], totalInvested: r.fill.notional, ... startingEquity: DEFAULT_PAPER_STARTING_CASH, equity: DEFAULT_PAPER_STARTING_CASH, equityCurve: [DEFAULT_PAPER_STARTING_CASH, DEFAULT_PAPER_STARTING_CASH], ... dataSource: 'demo' });
- Fix: Gate the mock on the scripted fill only: `intent.reasonCode === 'tour_mode' && r.fill` (the server stamps that reasonCode only in the signed tour-propose branch), dropping the bare `isTour ||`. Real fills should always go through `await loadAccount()`. Optionally render a distinct 'Demo' chip when dataSource === 'demo' comes from the tour mock rather than reusing the 'Session' label.

## 2. [P1] src/components/paper-bot/PaperBotView.tsx:453 (overclaiming-copy)
- Issue: The tour step-3 tooltip promises a fill 'at the real price', but the signed tour branch fills at a hardcoded $150 placeholder (route.ts:181 `fillPrice: 150` - the server comment itself calls it 'a placeholder price'). The fill card then shows 'AAPL @ $150 ... fee $0 · slippage $0' on the same page as the live quote card showing AAPL's actual price, and beneath the HowItWorksPanel claim 'Simulated at the real price + fee + slippage'. The tour copy asserts real-price provenance for an authored number.
- Evidence: body="Push it through the risk engine one last time and simulate a fill at the real price."  (while src/app/api/trading/paper-bot/route.ts tour branch returns fillPrice: 150, simulatedFee: 0, simulatedSlippage: 0)
- Fix: Either change the tooltip (and the fill-card framing during the tour) to say the walkthrough uses a scripted illustrative price, or have the tour execute branch fill at the real fetched quote so the copy becomes true.

## 3. [P1] src/components/simulation/SimulationLab.tsx:430 (misleading-label)
- Issue: The 'EV per trade' stat tile always renders $0.00. calculateWinRate computes expectedValuePerTrade AT the breakeven win rate (simulation.ts:285-286: `avgWinDollar * requiredWinRate - avgLossDollar * (1 - requiredWinRate)` with requiredWinRate = avgLoss/(avgWin+avgLoss)), which is identically zero by construction - the user's winRateAssumption input is never used by the tile. A trader reads a permanent $0.00 labelled as their setup's expected value; the paragraph below the tiles computes the real assumption-based EV separately, contradicting the tile.
- Evidence: [`EV per trade (${activeCurrency})`, cur(winRateAnalysis.expectedValuePerTrade), toneClass(winRateAnalysis.expectedValuePerTrade)],  // fed by simulation.ts: const expectedValuePerTrade = avgWinDollar * requiredWinRate - avgLossDollar * (1 - requiredWinRate);
- Fix: Compute the tile from the user's assumption - (avgWin * winRateAssumption/100) - (avgLoss * (1 - winRateAssumption/100)) - exactly as the explanatory sentence at lines 439-441 already does, or remove the tile and keep only the sentence.

## 4. [P1] src/app/page.tsx:126 (unlabelled-sample-outside-demo)
- Issue: On a Supabase-configured deployment, a signed-out visitor gets data.mode === 'supabase' but data.portfolio/watchlist fall back to the bundled demo book (data.ts: `let portfolio = userId ? [] : demoDashboardData.portfolio`). page.tsx then labels that sample book 'Your book' in the ExecutiveStrip, renders it under 'Portfolio exposure / current holdings' ('Displays backend portfolio overlay values'), and GoalCockpit computes 'Your capital' equity from the sample holdings - all with NO sample chip, because the AppShell DEMO banner only keys on generatedFrom === 'demo'. Sample rows dressed as the user's book outside the demo tour.
- Evidence: page.tsx:126 `{ label: data.portfolio.length > 0 ? 'Your book' : 'Top signals', signals: bookSignals }` and :178 `Portfolio exposure / current holdings` with :72 `data.portfolio.reduce((sum, h) => sum + h.marketValue, 0)` feeding GoalCockpit; data.ts:~443 `let portfolio = userId ? ([] as PortfolioHolding[]) : demoDashboardData.portfolio;` while returning `mode: 'supabase'`; AppShell.tsx:328/422 banner gated on `data.generatedFrom === 'demo'` only.
- Fix: For mode === 'supabase' with no signed-in user, either return an empty portfolio/watchlist (honest empty states already exist for both sections) or explicitly chip those sections 'Sample' and relabel 'Your book' -> 'Sample book' so the demo preview never reads as the visitor's own positions.

## 5. [P1] src/components/TickerDetail.tsx:80 (placeholder-zero)
- Issue: The header "1H / 1D" tile renders signal.priceChange1h, but buildLiveSignal hardcodes `priceChange1h: 0` (its daily feed cannot measure an hourly change) and applyLiveSignals spreads that over every signal in BOTH solo and supabase modes - clobbering the hourly worker's real price_change_1h from the DB (data.ts:181) whenever the Yahoo fetch succeeds. The tile therefore shows a measured-looking "+0.0%" for the last hour on live pages when the hourly change is actually unmeasured - a placeholder zero rendering as a flat-hour reading.
- Evidence: TickerDetail.tsx:80 `{formatSignedPercent(signal.priceChange1h)} / {formatSignedPercent(signal.priceChange1d)}`; live-signals.ts:336 `priceChange1h: 0, // daily series - intraday change isn't available from this feed`; live-signals.ts:383 `out[index] = computed ? { ...signal, ...computed } : signal;`
- Fix: Omit priceChange1h from buildLiveSignal's Partial so the DB's real hourly value survives the merge in supabase mode, and make it null/NaN (not 0) in solo mode so formatSignedPercent's non-finite path renders '-'. Same treatment for the `?? 0` fallbacks on volumeRatio/distanceFromLow/priceVsSma* (live-signals.ts:349-353), where an unknown reads as "0.0% above the 60-day low".

## 6. [P1] src/components/charts/ChartsTabs.tsx:91 (sample-out-of-demo)
- Issue: The Economy / Markets / Commodities tabs render authored sample macro series, index prices, and rates in EVERY mode (demo, solo, and live supabase) - gated only by the build-time constant CHART_PACK_SAMPLE, never by data.mode. Tiles show precise values ("VIX 17.3", "S&P 500 5,482 +0.45%", "Gold $2,364") with sparklines and deltas that read as live market data; the only disclosure is one dim 10px footnote per tab, not a per-tile Sample chip, violating the rule that sample rows render only on the demo tour under a visible chip. Additionally the footnote gates on CHART_PACK_SAMPLE while the EXCHANGES_BOARD/RATES_BOARD/COMMODITIES_BOARD data carries its own never-read MARKET_BOARD_SAMPLE flag (market-board.ts:30), so wiring live FRED data (flipping CHART_PACK_SAMPLE false) would silently strip the disclosure from still-sample exchange prices.
- Evidence: ChartsTabs.tsx:91 `{ECONOMY.map((i) => (<MacroTile key={i.key} ind={i} />))}` rendered with no mode prop anywhere in the component; ChartsTabs.tsx:52 `if (!CHART_PACK_SAMPLE) return null;`; chart-pack.ts:23 `export const CHART_PACK_SAMPLE = true;` over authored rows like `{ key: 'vix', label: 'VIX', value: '17.3', ... series: [15.8, 16.2, ...] }`
- Fix: Thread data.mode into ChartsView/ChartsTabs and render the macro tabs' sample boards only when mode === 'demo', with a Sample chip on each tile; on live/solo show the honest empty state ("Live FRED / RBA / market feeds not connected"). Make the SampleNote (and any gate) read MARKET_BOARD_SAMPLE for the market-board-sourced grids.

## 7. [P1] src/components/charts/ChartsTabs.tsx:129 (false-provenance)
- Issue: The Policy rates tiles attribute AUTHORED sample values to real institutions: each tile shows "RBA cash rate 3.85% -0.25" / "US Fed funds 4.50%" with the institution's favicon, name, and a link to rba.gov.au / treasury.gov / federalreserve.gov as its source. The numbers come from the hardcoded RATES_BOARD sample array, so the tile claims RBA/Treasury/Fed provenance for values those sources never published - on live and solo pages, with only the tab-bottom footnote as disclosure.
- Evidence: ChartsTabs.tsx:129 `<SourceFavicon domain={new URL(rate.sourceUrl).hostname} sourceName={rate.source} /> {rate.source}` rendering market-board.ts:49 `{ key: 'rba', label: 'RBA cash rate', value: '3.85%', change: '-0.25', direction: 'down', ... source: 'RBA', sourceUrl: 'https://www.rba.gov.au/statistics/cash-rate/' }`
- Fix: While the values are authored, drop the source favicon/name attribution (keep the outbound link labelled "check the current rate at RBA") or put a Sample chip on each rate tile; restore source attribution only when the value is actually fetched from that source.

## 8. [P1] src/components/charts/ChartsView.tsx:107 (sample-as-personal-data)
- Issue: On a live (supabase-configured) deployment, a signed-out visitor's /charts page renders the DEMO portfolio and watchlist as "Your picture" - book value, P&L, composition donut, sector exposure, and per-holding factor cards - with no Sample chip and no demo banner (AppShell's banner only fires on generatedFrom === 'demo', and the live path stamps 'supabase'). getDashboardData substitutes demoDashboardData.portfolio/watchlist whenever userId is null (data.ts:441-442), and ChartsView only layers real local data in solo mode (`if (!soloMode) return;`), so supabase-mode signed-out users see a fabricated personal book dressed as their own outside the demo tour.
- Evidence: ChartsView.tsx:107 `const bookValue = activeData.portfolio.reduce((sum, h) => sum + h.marketValue, 0);` rendered under the header `Your picture` (line 135) with no mode check or chip; data.ts:441 `let portfolio = userId ? ([] as PortfolioHolding[]) : demoDashboardData.portfolio;`
- Fix: In supabase mode with no signed-in user, pass empty portfolio/watchlist (matching buildSoloMarketDashboard's "a seeded demo book must not impersonate a new user" contract) so ChartsView shows its honest "Add holdings" empty states - or chip the whole panel Sample when the demo book is substituted.

## 9. [P1] src/components/ipos/IpoExplorer.tsx:280 (unlabelled-sample-in-overlay)
- Issue: The explorer knows `source` but never passes it to IpoDrawer, and IpoDrawer has no source prop at all. On a sample deploy, tapping a row opens a full slide-over of specific figures (valuation, raised, offer price, TTM financials, key people, bear/base/bull model scenario) with zero sample tell - the only tell is the 9px toolbar footnote the overlay covers. This is the same defect class the 2026-08-11 calendar fix removed ('the one 9px footnote in the toolbar was the only sample tell on the whole board').
- Evidence: src/components/ipos/IpoExplorer.tsx:280: `<IpoDrawer ipo={selected} onClose={() => setSelected(null)} />` (source not passed) and src/components/ipos/IpoDrawer.tsx:10-13: `interface IpoDrawerProps { ipo: IpoCompany | null; onClose: () => void; }` - no provenance reaches the drawer; nothing in IpoDrawer.tsx renders a Sample chip.
- Fix: Pass `source` into IpoDrawer and render the same accent 'Sample' chip / banner used on the IPO detail page ([symbol]/page.tsx:36-41) at the top of the drawer when source === 'sample'.

## 10. [P1] src/components/onboarding/MarketUniverseSelector.tsx:53 (overclaiming-coverage)
- Issue: The onboarding universe step claims ASX equities and ETFs are hourly-scanned. The hourly scan universe is 100% US NASDAQ/NYSE common stock: workers/stock_scanner/universe.py NASDAQ_TECH_UNIVERSE has zero ASX rows and zero ETFs, the sql/001 + sql/006 ticker seeds are all exchange 'NASDAQ'/'NYSE', country 'US', currency 'USD', no API inserts watchlist tickers into the tickers table, and the Stooq fallback provider explicitly documents 'an unmapped market (e.g. ASX) returns []'. Line 85-86 repeats the claim as '~100 of the top US (NASDAQ) and ASX names are scanned hourly out of the box'. A user who adds CBA.AX is told it is continuously scanned when it only gets on-demand lookup.
- Evidence: Lyra continuously scans the top US &amp; ASX equities and ETFs - hourly. Next you&apos;ll add the names that are
        actually yours - any ticker, fetched live.
- Fix: State the true coverage: 'Lyra continuously scans ~100 top US (NASDAQ/NYSE) tech names hourly. Any other ticker you add - US or ASX - is fetched live on demand.' Apply the same correction to the 'How it works' paragraph at lines 85-87 (drop 'and ASX' from the hourly claim, and drop 'ETFs').

## 11. [P1] src/components/onboarding/SetupSummaryCard.tsx:43 (overclaiming-coverage)
- Issue: The setup summary presents 'US + ASX equities · hourly' as a fact row labelled Coverage, but the hourly scanned universe contains no ASX equities (see workers/stock_scanner/universe.py and the sql seeds - all US NASDAQ/NYSE). ASX symbols are only supported via on-demand lookup for watchlist/portfolio entry, not hourly scanning.
- Evidence: { label: 'Coverage', value: 'US + ASX equities · hourly' },
- Fix: Change the value to describe what actually happens, e.g. 'US tech universe · hourly (your tickers fetched live)' or 'US equities hourly · US/ASX lookup on demand'.

## 12. [P1] src/lib/data.ts:434 (demo-fallback-flagged-live)
- Issue: On the supabase path, an empty stock_signals table (fresh deploy, pre-first-scan, retention wipe) silently swaps in demoDashboardData.signals as the base under mode:'supabase'. Any symbol whose Yahoo fetch fails renders its fully-authored demo row (AMD score 82 'Strong setup', authored RSI/MACD/summaries) under the green LIVE badge with no sample flag; even successful merges keep the authored lastUpdated '2026-06-02T20:00:00Z' and lastAlert strings (buildLiveSignal never overwrites them), and deriveSignalChanges(liveSignals) then feeds the Live Wire with rows the wire flags as live ('Signal changes are live from the engine') because generatedFrom==='supabase'.
- Evidence: const liveSignals = await applyLiveSignals(signals.length > 0 ? signals : demoDashboardData.signals);  (and applyLiveSignals per-symbol fallback: out[index] = computed ? { ...signal, ...computed } : signal; live-signals.ts:377)
- Fix: In supabase mode never substitute the demo base: use the real (possibly empty) signals and render an honest 'no scans recorded yet' state; alternatively thread a per-row source:'live'|'sample' flag through the merge so surfaces and the wire can chip any demo-fallback row.

## 13. [P1] src/lib/data.ts:361 (placeholder-as-measurement)
- Issue: Account-mode watchlist rows for symbols with no overlay row yet and no fetched signal (newly added rule pre-scan, or a symbol permanently outside the scanner's signal set) render Current '$0.00', RSI '0.0', Hist '0.00', Vol '0.00x' on the watchlist page table and feed the home WatchlistTriggerBoard, which then reads '100.0% from your $X buy zone' off the zero price - placeholder zeros presented as measured market data on a live account surface.
- Evidence: currentPrice: overlay?.current_price ?? signal?.close ?? 0,
        distanceToTarget: overlay?.distance_to_target_price_pct ?? 0,  (and lines 368-370: rsi: signal?.rsi ?? 0, macdHistogram: signal?.macdHistogram ?? 0, volumeRatio: signal?.volumeRatio ?? 0)
- Fix: Same treatment as the Solo builder needs: mark rows without overlay/signal as unscanned (nullable price/metrics rendering '-') rather than defaulting to 0, so '$0.00' can never read as a quote.

## 14. [P1] src/lib/ipos-live.ts:86 (placeholder-zeros-as-measurements)
- Issue: mapIpoRow coerces missing/NULL numeric columns to 0, and the nightly Finnhub worker writes literal 0.0 placeholders (proceeds_usd_m=0.0 '# Calculated', valuation_usd_m=0.0, offer_price=0.0 when Finnhub omits price). Live IPO rows therefore render 'Raised $0.0B', 'Valuation $0.0B', 'Offer $0.00', 'Shares offered 0.0M' as measurements, the stat tiles sum/rank those zeros ('Top valuation $0.0B', 'Total raised $0.0B'), and buildEstimate seeds the 'deterministic research range' from ref=0 producing a $0.00 bear/base/bull scenario plus the rationale line 'Implied valuation at IPO ≈ $0.0B'.
- Evidence: src/lib/ipos-live.ts:85-87: `sharesOfferedM: num(row.shares_offered_m) ?? 0, proceedsUsdM: num(row.proceeds_usd_m) ?? 0, valuationUsdM: num(row.valuation_usd_m) ?? 0,` (and line 75 `if (offerPrice === undefined) return null;` lets offerPrice 0 through). Worker: workers/events_worker/events_provider.py:150-153 `offer_price=float(item.get("price", 0)) if item.get("price") else 0.0, ... proceeds_usd_m=0.0,  # Calculated / valuation_usd_m=0.0,  # Calculated`. Render: src/components/ipos/IpoExplorer.tsx:236-237 `{billions(ipo.proceedsUsdM)}` / `{billions(ipo.valuationUsdM)}` with no missing-value branch.
- Fix: Keep these fields optional through the pipeline: map 0/NULL raise, valuation, shares and offer price from live rows to undefined, render '-' (with the existing 'not tracked' pattern) instead of $0.0B/$0.00, exclude undefined values from the stat-tile sums/rankings, and skip or caveat the model scenario when the reference price is missing.

## 15. [P1] src/lib/ipos-live.ts:82 (misleading-label)
- Issue: Unknown categories are silently defaulted to 'software', and the live worker writes category='pending' for every Finnhub row ('Finnhub doesn't categorize'). So every live IPO renders Sector 'Software' in the explorer table, mobile cards, drawer chip, detail-page chip and the 'sectors covered' stat - an asserted classification the system does not have, for companies that may be biotech, energy, or anything else.
- Evidence: src/lib/ipos-live.ts:82: `category: (CATEGORIES.has(row.category ?? '') ? row.category : 'software') as IpoCategory,` combined with workers/events_worker/events_provider.py:148: `category="pending",  # Finnhub doesn't categorize` and src/components/ipos/IpoExplorer.tsx:242: `<td className="px-3 py-2 text-ink-2">{ipoCategoryLabel(ipo.category)}</td>`.
- Fix: Add an 'uncategorised' member (or make category optional) and render it honestly ('-' or 'Not categorised') instead of defaulting unknown live categories to 'software'; keep the software fallback only for the editorial seed where it is authored.

## 16. [P1] src/lib/local-dashboard.ts:84 (placeholder-as-measurement)
- Issue: For a Solo holding outside the scanned universe (e.g. an ASX symbol - displaySymbol() exists precisely for these), currentPrice falls back to the user's own averageBuyPrice, so PortfolioView renders 'Current' = buy price, 'Market Value' = cost, and 'Unrealised P/L' = $0.00 / 0.0% as if they were market measurements. The 2026-08-11 scanned-flag fix only guards the Signal and RSI columns (PortfolioView.tsx:224-239); the Current/Market Value/P&L columns (lines 201-205) always render these fabricated values with no 'not scanned' caveat, and they roll into the Total value / Unrealised P/L headline tiles.
- Evidence: const currentPrice =
      signal && signal.close > 0 ? signal.close : holding.averageBuyPrice;
- Fix: For scanned:false rows make currentPrice/marketValue/unrealisedPnl nullable and render '-' (formatCurrency already handles non-finite), excluding them from the P/L totals or footnoting the totals, instead of echoing cost basis as a live price.

## 17. [P1] src/lib/local-dashboard.ts:206 (placeholder-as-measurement)
- Issue: WatchlistRow has no scanned flag, so a Solo watch rule on a symbol outside the scanned universe renders structural zeros as measurements: WatchlistTriggerBoard.tsx:121 prints 'RSI 0 · MACD hist 0.00 · Vol 0.0x · score +0 since scan', the signal gate shows a measured-looking '0 / 60', and currentPrice falls back to the user's targetBuyPrice so the board shows the target as the live price with distance 0.0% and a full 'Price into zone' bar - the exact RSI-0.0-as-reading class the portfolio fix addressed, unfixed on the watchlist side.
- Evidence: rsi: signal?.rsi ?? 0,
        macdHistogram: signal?.macdHistogram ?? 0,
        volumeRatio: signal?.volumeRatio ?? 0,  (and line 177-178: const currentPrice = signal && signal.close > 0 ? signal.close : item.targetBuyPrice;)
- Fix: Add a scanned flag to WatchlistRow mirroring PortfolioHolding (types/scanner.ts), skip or clearly mark unscanned rows on WatchlistTriggerBoard ('not scanned', '-' metrics), and never substitute the user's target as the current price.

## 18. [P2] src/app/trading/page.tsx:61 (unlabelled-authored-data)
- Issue: Authored PreTradeContext numbers render as engine check details on the Bot Readiness page: quoteAgeSeconds 4, portfolioDrawdownPct 2.4, avgDailyDollarVolume 38B, spreadPct 0.02 surface via risk-engine detail strings ('Quote 4s old (max 30s).', 'Drawdown 2.4% vs max ...', 'ADV $38,000,000,000 vs floor $5,000,000.', 'Spread 0.02% vs max 0.50%.') in TradingReadiness's CheckRow. The section copy labels the INTENT as a sample run 'through the real deterministic engine' under a 'live demo' heading, but never says these context readings are invented - they present as measured quote-age/drawdown/liquidity data. Same fabricated-numbers class the 2026-08-11 fix emptied from the snapshots, except these ones actually render.
- Evidence: quoteAgeSeconds: 4,
    maxQuoteAgeSeconds: 30,
    portfolioValue: 50000,
    ...
    portfolioDrawdownPct: 2.4,
    avgDailyDollarVolume: 38_000_000_000,
    ...
    spreadPct: 0.02,
- Fix: Say so in the section copy ('run with illustrative context values - quote age, drawdown, liquidity and spread are authored inputs, not measurements'), or feed the context from real data (actual portfolio value, real ADV for NVDA) so the rendered details are true.

## 19. [P2] src/components/calculators/CalculatorsView.tsx:877 (misleading-colour)
- Issue: The Profit Target calculator's Risk:Reward value is hardcoded gain-green (text-positive) regardless of the ratio: a 0.1% target with a 20% stop renders '1:0.01' in the same green as a favourable setup. Colour does not encode the metric it tints - the same class of defect as the previously-fixed win-rate tint.
- Evidence: <p className="mt-1 text-lg font-semibold text-positive">1:{profitResult.riskRewardRatio.toFixed(2)}</p>
- Fix: Use a neutral tone (text-ink-title, as the Simulation Lab's R:R tile does), or tint by a stated threshold (e.g. positive at >= 1, negative below) so the colour carries the metric's meaning.

## 20. [P2] src/components/paper-bot/PaperBotStrip.tsx:67 (placeholder-zero)
- Issue: The dashboard Paper Bot strip renders 'Win rate 0%' whenever no trades have closed - computeTradeAnalytics returns a defined-zero placeholder for an empty set, and hasTraded (fillCount > 0 || openPositions > 0) shows the strip with only open positions. A '0%' reads as 'every trade lost' when nothing has been measured. PaperAccountPanel guards the identical stat behind closedTrades > 0; the strip does not.
- Evidence: <p className="font-mono text-[13px] font-semibold text-ink">{account.winRate}%</p>  (winRate = closedTrades ? ... : 0 in paper-account-store.ts computeTradeAnalytics)
- Fix: Render '-' (or 'n/a') for the win-rate cell when account.closedTrades === 0, matching the PaperAccountPanel guard.

## 21. [P2] src/components/simulation/SimulationLab.tsx:427 (misleading-label)
- Issue: 'Avg win' / 'Avg loss' (and the derived 'Breakeven win %') are the bull/bear SCENARIO P&Ls at the user's +20%/-15% moves, not the trade plan's exits: a planned trade exits at the 14% target and 6% stop, so both figures overshoot what the plan could actually realise, and the breakeven win rate is computed from the wrong trade. The labels claim averages of the plan while the numbers are scenario endpoints.
- Evidence: const avgWin = scenarios[0]?.pnlDollar ?? 0; // Bull scenario profit
    const avgLoss = Math.abs(scenarios[2]?.pnlDollar ?? 0); // Bear scenario loss (absolute)
- Fix: Derive avg win/loss from the plan's target and stop (shares * (targetPrice - entry) and shares * (entry - stopPrice), as the profit-target calculator does), or relabel the tiles 'Bull scenario P&L' / 'Bear scenario P&L' so the label matches the number.

## 22. [P2] src/components/TickerDetail.tsx:19 (misleading-scale)
- Issue: MetricBar draws the signed price-vs-MA percent as a plain left-anchored fill of width `50 + value` with no zero marker, so bar length inversely encodes loss magnitude: -2% vs 200MA draws a long (48%) red bar while -45% draws a short (5%) one - a glance ranks the mild dip as worse. The signed value is printed beside it, but the bar's visual encoding contradicts the number it illustrates (compare ComparisonLab's MetricBars, which correctly diverge from a marked zero baseline).
- Evidence: TickerDetail.tsx:19 `const width = Math.min(100, Math.max(0, 50 + value));` with line 28 `<div className={value >= 0 ? 'h-full bg-positive' : 'h-full bg-negative'} style={{ width: `${width}%` }} />`
- Fix: Render it as a diverging bar from a visible centre line (like ComparisonLab's signed MetricBars): centre tick at 50%, bar extending right for positive and left for negative with width proportional to |value|.

## 23. [P2] src/components/charts/ChartsView.tsx:109 (mislabeled-aggregate)
- Issue: The book P&L percent shown beside the dollar P&L is a market-value-weighted average of per-holding unrealisedPnlPercent, not the book's actual return. Because winners gain weight as they rise, this overstates the book: e.g. holding A cost 100 -> 200 (+100%, weight 2/3) and holding B cost 200 -> 100 (-50%, weight 1/3) shows "$0 +50.0%" - a +50% label on a flat book, in the P&L tone colour.
- Evidence: ChartsView.tsx:109 `const bookPnlPct = activeData.portfolio.reduce((sum, h) => sum + h.unrealisedPnlPercent * (h.portfolioWeight / 100), 0);` rendered at line 138 as `{formatCurrency(bookPnl)} {formatSignedPercent(bookPnlPct)}`
- Fix: Compute the true book return from cost basis: totalCost = sum(marketValue / (1 + unrealisedPnlPercent/100)); bookPnlPct = bookPnl / totalCost * 100 (guarding zero), so the % always agrees with the $ figure beside it.

## 24. [P2] src/components/community/ScoutProposals.tsx:41 (unlabelled-demo-content)
- Issue: The ideas API serves a fabricated demo scout proposal when the serving deployment has no Supabase (src/app/api/community/ideas/route.ts:114 returns { ok: true, demo: true, ideas: DEMO_SCOUT_IDEAS } - 'Emerging signal: Commercial Fusion', confidence 75, voteCount 9, example.com evidence links), but ScoutProposals' IdeasResponse omits the demo flag and the component never reads or badges it. Its siblings on the same tab handle exactly this payload shape honestly (IdeasBoard renders a 'Demo preview' chip; ScoutFeed badges its demo run). If the demo payload is ever served to this component (build-time/runtime NEXT_PUBLIC env mismatch, direct use of an unconfigured deployment's API, or future routing drift), the fabricated scout signal renders indistinguishable from a real filed proposal.
- Evidence: interface IdeasResponse {
  ok: boolean;
  ideas?: ScoutIdea[];
  maintainer?: boolean;
  error?: string;
}
- Fix: Mirror IdeasBoard: add `demo?: boolean` to IdeasResponse, `setDemo(Boolean(data.demo))` on load, and render the same 'Demo preview' chip in the panel header (or on each card) when set.

## 25. [P2] src/components/comparison/ComparisonLab.tsx:269 (color-honesty)
- Issue: Zero-change values are tinted gain-green: the comparison table and mobile cards use `>= 0 ? 'text-positive'` for scoreDelta, priceChange1d, and macdHistogram, so a 0 delta renders "+0" in green, claiming improvement that did not happen. The codebase's own convention (format.ts toneClass) maps exactly-zero to neutral grey, and TickerDetail uses toneClass for the same scoreDelta - so the same number is grey on the ticker page and green in the Comparison Lab. Same pattern in ChartsView's FactorCard (`const up = signal.scoreDelta >= 0`).
- Evidence: ComparisonLab.tsx:269 `<span className={s.scoreDelta >= 0 ? 'text-positive' : 'text-negative'}>{formatSignedNumber(s.scoreDelta, 0)}</span>` (also lines 271, 275, 298, 303); ChartsView.tsx:33 `const up = signal.scoreDelta >= 0;`
- Fix: Replace the `>= 0` ternaries with toneClass(value) (or an equivalent three-way) so zero renders neutral, matching the rest of the app.

## 26. [P2] src/components/onboarding/AlertPreferencePanel.tsx:259 (overclaiming-latency)
- Issue: The alert step claims setups, risk, triggers and invalidations 'fire in real time', but the entire pipeline is driven by the hourly GitHub Actions scan (CLAUDE.md: 'hourly-stock-scanner.yml (hourly scan)'; workers/stock_scanner/main.py runs once per cron tick). Alerts can lag the market by up to an hour - 'real time' overstates delivery latency, in the same sentence that correctly labels the digests.
- Evidence: Setups, risk, triggers &amp; invalidations fire in real time. Hourly digest is hourly; daily at your chosen time.
- Fix: Say what the cadence actually is: 'Setups, risk, triggers & invalidations fire with each hourly scan. Daily digest at your chosen time.'

## 27. [P2] src/components/onboarding/DemoCarryoverConfirm.tsx:16 (stale-label)
- Issue: STRATEGY_LABELS maps id 'momentum-recovery' to 'Momentum recovery', but that strategy's real name is 'Oversold Recovery' (src/lib/strategy.ts:98-99; StrategyPicker's own comment records the rename). The carryover confirm therefore shows the flagship default strategy under a name that no longer exists anywhere else in the product. The map's other three keys ('breakout', 'trend-follow', 'mean-reversion') match no real strategy id at all (real ids: oversold-bounce, trend-continuation, breakout-watch, overextended-risk, earnings-caution, high-hype-low-confirmation), so they are dead entries.
- Evidence: const STRATEGY_LABELS: Record<string, string> = {
  'momentum-recovery': 'Momentum recovery',
  'breakout': 'Breakout',
  'trend-follow': 'Trend following',
  'mean-reversion': 'Mean reversion',
};
- Fix: Delete the hardcoded map and resolve the label from the source of truth: `getStrategyById(id)?.name` from '@/lib/strategy' (falling back to the existing title-case transform), so the confirm screen always names the strategy the user actually selected.

## 28. [P2] src/components/portfolio/PortfolioView.tsx:127 (misleading-label)
- Issue: The stat tile labelled 'Last scan' renders the scan timeframe constant ('1H'), not when the last scan ran - it reads as permanent freshness ('scanned 1 hour ago') even if the scanner has been dead for a week; the label does not describe what the number is.
- Evidence: ['Last scan', data.latestRun.timeframe.toUpperCase(), 'text-ink-2'],
- Fix: Rename the tile 'Timeframe'/'Cadence', or show relativeTime(data.latestRun.finishedAt) like AppShell's honest freshness badge does.

## 29. [P2] src/components/portfolio/PortfolioView.tsx:155 (overclaimed-provenance)
- Issue: The table subtitle claims 'Values, risk states, and action states are middleware overlay outputs' unconditionally, but in Solo/demo mode the rendered rows are computed in the browser from local holdings by buildLocalPortfolioHoldings (and in demo mode are authored sample rows) - the copy overclaims engine provenance for locally computed / authored numbers.
- Evidence: <p className="mt-1 font-mono text-xs text-ink-3">Values, risk states, and action states are middleware overlay outputs.</p>
- Fix: Make the copy mode-aware: e.g. Solo -> 'computed on this device from the latest market snapshot using the same engine rules'; supabase -> current wording.

## 30. [P2] src/components/themes/ThemeRadar.tsx:155 (colour-not-encoding-metric)
- Issue: Top-company opportunity totals on the World Radar cards are always rendered in positive green regardless of value, while the theme dossier tones the same score by threshold (>=70 green, >=55 amber, else neutral). A total of 45 shown green on the radar card asserts strength the number does not have and contradicts the dossier one tap away.
- Evidence: src/components/themes/ThemeRadar.tsx:155: `<span className="font-mono text-[10px] text-positive">{c.total}</span>` vs src/components/themes/ThemeDossier.tsx:35-39: `function scoreTone(total: number): string { if (total >= 70) return 'text-positive'; if (total >= 55) return 'text-accent'; return 'text-ink-2'; }`.
- Fix: Reuse scoreTone() (export it from ThemeDossier or move it to world-radar.ts) for the radar-card totals so colour encodes the score band consistently.

## 31. [P2] src/components/tickers/ScanDeltaPanel.tsx:46 (wrong-timestamp)
- Issue: In solo mode the panel stamps freshly computed live values with the fixed demo timestamp: buildLiveSignal's Partial overrides every number but omits lastUpdated, so the demo signals' hardcoded '2026-06-02T20:00:00Z' survives the merge and the copy reads "the previous scan and now, 2 months ago" for reads computed from live prices seconds earlier. The same stale stamp feeds TickerDetail's "Last scan" tile (line 88). The stated measurement time is false for the values shown (conservatively so, but it tells a solo user their fresh data is months stale).
- Evidence: ScanDeltaPanel.tsx:46 `Two measured reads - the previous scan and now, {relativeTime(signal.lastUpdated)}.`; demo-data.ts:140 `lastUpdated: '2026-06-02T20:00:00Z',`; live-signals.ts buildLiveSignal return object (lines ~325-360) contains no lastUpdated field
- Fix: Have buildLiveSignal include lastUpdated (the fetch/render instant, or the last daily candle's time) in its Partial so the displayed scan time matches the values actually shown; keep the authored timestamp only on the pure demo tour.

## 32. [P2] src/lib/data.ts:367 (fabricated-target)
- Issue: The account-path watchlist mapping defaults a null target_signal_score to 0, which the repo's own doctrine (watchlist-rule.ts: 'A watch rule with target_signal_score = 0 reads triggered on EVERY hourly scan') forbids - if a DB row carries NULL (column is nullable; API-written rows avoid it) the trigger board narrates 'your 0 target' the user never set and renders the Signal-confirm gate permanently green ('N / 0', signalConfirmed always true). The Solo path was fixed to fall back to 60; this sibling path was not.
- Evidence: targetSignalScore: item.target_signal_score ?? 0,
- Fix: Use DEFAULT_TARGET_SIGNAL_SCORE (60) from src/lib/watchlist-rule.ts as the fallback, matching buildLocalWatchlistRows (local-dashboard.ts:164,176).

## 33. [P2] src/lib/data.ts:300 (inconsistent-cost-basis)
- Issue: The account-path fallback P/L excludes brokerage_fee (fetched at line 55, passed through at line 326) while the worker overlay and the Solo builder (local-dashboard.ts:86-87, 'fee-inclusive cost base... audit V4 fix') include it - so a holding with no overlay row yet shows a higher P/L that silently shifts once the overlay lands, and the same book reads differently in Solo vs account mode.
- Evidence: const cost = position.average_buy_price * position.quantity;
      const marketValue = overlay?.market_value ?? currentPrice * position.quantity;
      const unrealisedPnl = overlay?.unrealised_pl ?? marketValue - cost;
- Fix: Fold the fee into the fallback cost: const cost = position.average_buy_price * position.quantity + (position.brokerage_fee ?? 0); (and align PortfolioView's 'Cost basis' tile at line 112, which is also fee-exclusive).

## 34. [P2] src/lib/feed.ts:96 (sample-timestamps-gate-real-rows)
- Issue: nowRef (the 'now' used to drop upcoming calendar events) is computed AFTER SAMPLE_WIRE is pushed, so invented sample timestamps define the reference clock whenever they are the newest items in the stream. On solo, demo signal changes ('2026-06-02') plus SAMPLE_WIRE (max '2026-06-07') pin nowRef to June, so every re-anchored calendar event (dated near today) is treated as 'future' and silently dropped - the Events filter is permanently empty. On a live deployment with sample intel and zero signal changes, genuinely past LIVE calendar events are likewise hidden as 'future'.
- Evidence: feed.ts:91 `items.push(...SAMPLE_WIRE);` precedes :96 `const nowRef = items.reduce((max, it) => Math.max(max, new Date(it.time).getTime()), 0);` and :99 `if (time > nowRef + 86_400_000) return; // skip future events`.
- Fix: Use Date.now() as nowRef (or compute the max over non-sample items only) so invented sample timestamps never decide which real calendar rows the wire shows.

## 35. [P2] src/lib/intelligence-live.ts:182 (constant-presented-as-metric)
- Issue: Every live news item gets confidence hardcoded to 'medium', and the feed's expanded metadata grid renders it in a 'Confidence' stat cell as if it were a per-item measurement. A constant dressed as a metric tells the reader nothing and implies an assessment that never happened.
- Evidence: src/lib/intelligence-live.ts:182: `confidence: 'medium' as Confidence,` rendered at src/components/intelligence/IntelligenceFeed.tsx:359-360: `<p className="text-[10px] uppercase tracking-[0.1em] text-ink-3">Confidence</p><p className="mt-1 text-xs text-ink">{item.confidence}</p>`.
- Fix: Hide the Confidence cell for live items until a real per-item confidence exists (make the field optional), or label it as a default ('not scored').

## Data-ops item (needs founder credentials)
- The prod Supabase `ipos` table contains editorial speculative records for real private companies (verified live: /ipos/STRP serves 'Stripe', offer $70, IPO 2026-11-01 from the LIVE table, so no sample banner fires). The nightly worker only persists Finnhub rows, so these came from an earlier seed push. Fix: suffix company_name with ' (illustrative)' on the speculative symbols (DBRX STRP CNVA CBRS DISC CHYM REVO PLAI GENS NETS SPCX) or delete them so the detail page falls back to the properly-bannered seed. Blocked locally: SUPABASE_SERVICE_ROLE_KEY is Vercel-sensitive (pulls empty) and the Vivacity SUPABASE_ACCESS_TOKEN got 403 on the Management API for this project.