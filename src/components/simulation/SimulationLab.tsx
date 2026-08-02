'use client';

import { useEffect, useState, useMemo } from 'react';
import type { PortfolioHolding, SignalRow } from '@/types/scanner';
import {
  calculateScenarioOutcomes,
  calculateCompoundingProjection,
  calculateWinRate,
  fullSimulationAnalysis,
  type TradeInputs,
} from '@/lib/simulation';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent, toneClass } from '@/lib/format';
import { buildLocalPortfolioHoldings } from '@/lib/local-dashboard';
import {
  loadLocalHoldings,
  PORTFOLIO_CHANGED_EVENT,
} from '@/lib/local-portfolio';
import {
  loadOnboardingSummary,
  ONBOARDING_SUMMARY_CHANGED_EVENT,
} from '@/lib/onboarding-summary';

interface SimulationLabProps {
  portfolio: PortfolioHolding[];
  signals: SignalRow[];
  soloMode?: boolean;
}

export function SimulationLab({ portfolio, signals, soloMode = false }: SimulationLabProps) {
  const [activePortfolio, setActivePortfolio] = useState(portfolio);
  const [activeCurrency, setActiveCurrency] = useState('USD');
  // Input state
  const [availableCash, setAvailableCash] = useState(5000);
  const [ticker, setTicker] = useState('AMD');
  const [tradeAmount, setTradeAmount] = useState(2000);
  const [entryPrice, setEntryPrice] = useState(174.22);
  const [stopPercent, setStopPercent] = useState(6);
  const [targetPercent, setTargetPercent] = useState(14);
  const [holdingPeriodDays, setHoldingPeriodDays] = useState(21);

  // Compounding / projection inputs
  const [monthlyTargetPercent, setMonthlyTargetPercent] = useState(2.5);
  const [numberOfTrades, setNumberOfTrades] = useState(12);
  const [winRateAssumption, setWinRateAssumption] = useState(55);

  // Scenario customization
  const [bullMovePercent, setBullMovePercent] = useState(20);
  const [bearMovePercent, setBearMovePercent] = useState(-15);

  useEffect(() => {
    if (!soloMode) return;
    const refresh = () => {
      const local = loadLocalHoldings();
      setActivePortfolio(buildLocalPortfolioHoldings(local, signals));
    };
    refresh();
    const refreshCash = () => {
      const capital = loadOnboardingSummary()?.capital;
      const savedCash = capital?.cashAvailable;
      if (typeof savedCash === 'number' && savedCash >= 0) {
        setAvailableCash(savedCash);
      }
      if (capital?.baseCurrency) {
        setActiveCurrency(capital.baseCurrency.toUpperCase());
      }
    };
    refreshCash();
    const first = loadLocalHoldings()[0];
    const accountCurrency =
      loadOnboardingSummary()?.capital?.baseCurrency?.toUpperCase() ?? 'USD';
    const firstSignal = first
      ? signals.find((signal) => signal.symbol === first.symbol)
      : undefined;
    if (first) {
      setTicker(first.symbol);
      const quoteCurrency = first.symbol.endsWith('.AX') ? 'AUD' : 'USD';
      setEntryPrice(
        quoteCurrency === accountCurrency
          ? firstSignal?.close || first.averageBuyPrice
          : 0,
      );
    } else {
      // Do not seed an AUD account with an unexplained USD AMD example. Solo has no
      // authoritative FX feed here, so a blank scenario is more honest than mixed currencies.
      setTicker('');
      setEntryPrice(0);
    }
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
    window.addEventListener(
      ONBOARDING_SUMMARY_CHANGED_EVENT,
      refreshCash,
    );
    return () => {
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
      window.removeEventListener(
        ONBOARDING_SUMMARY_CHANGED_EVENT,
        refreshCash,
      );
    };
  }, [signals, soloMode]);
  const cur = (value: number) =>
    Number.isFinite(value) ? formatCurrency(value, activeCurrency) : '—';
  const scenarioReady =
    ticker.trim().length > 0 && entryPrice > 0 && tradeAmount > 0;

  // Full analysis (recomputed on every input change)
  const analysis = useMemo(() => {
    const inputs: TradeInputs = {
      availableCash,
      ticker,
      tradeAmount,
      entryPrice,
      stopPercent,
      targetPercent,
      holdingPeriodDays,
    };

    return fullSimulationAnalysis(inputs, activePortfolio);
  }, [availableCash, ticker, tradeAmount, entryPrice, stopPercent, targetPercent, holdingPeriodDays, activePortfolio]);

  // Scenarios with custom bull/bear moves
  const scenarios = useMemo(() => {
    return calculateScenarioOutcomes(
      analysis.inputs,
      analysis.sizing,
      bullMovePercent,
      bearMovePercent
    );
  }, [analysis, bullMovePercent, bearMovePercent]);

  // Compounding projection
  const compoundingData = useMemo(() => {
    return calculateCompoundingProjection(availableCash, monthlyTargetPercent, numberOfTrades);
  }, [availableCash, monthlyTargetPercent, numberOfTrades]);

  // Win rate analysis (using avg win = targetProfit, avg loss = riskAmount)
  const winRateAnalysis = useMemo(() => {
    const avgWin = scenarios[0]?.pnlDollar ?? 0; // Bull scenario profit
    const avgLoss = Math.abs(scenarios[2]?.pnlDollar ?? 0); // Bear scenario loss (absolute)
    return calculateWinRate(avgWin, avgLoss);
  }, [scenarios]);

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {soloMode && (
        <p className="rounded-cell border border-blue-info/30 bg-blue-tint/50 px-3 py-2 text-xs text-blue-info">
          Solo treats every amount below as {activeCurrency} and does not convert
          currencies. Enter a same-currency price, or an FX-adjusted price you
          calculated yourself.
        </p>
      )}
      {/* Header */}
      <section className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        {[
          ['Available capital', cur(availableCash), 'text-ink'],
          ['Trade amount', cur(tradeAmount), 'text-accent'],
          ['Entry price', cur(entryPrice), 'text-ink-title'],
          ['Portfolio size', activePortfolio.length.toString(), 'text-blue-focus'],
        ].map(([label, value, tone]) => (
          <div className="terminal-panel rounded-cell p-2" key={label}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
            <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* Two-column layout: inputs left, outputs right */}
      <section className="grid gap-3 xl:grid-cols-[360px_1fr]">
        {/* INPUTS PANEL */}
        <aside className="space-y-3">
          {/* Trade Setup */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Trade setup</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Available cash</span>
                <input
                  type="number"
                  value={availableCash}
                  onChange={(e) => setAvailableCash(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Ticker</span>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Trade amount ({activeCurrency})</span>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Entry price ({activeCurrency})</span>
                <input
                  type="number"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.01}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Stop loss (%)</span>
                <input
                  type="number"
                  value={stopPercent}
                  onChange={(e) => setStopPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.5}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Target profit (%)</span>
                <input
                  type="number"
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.5}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Holding period (days)</span>
                <input
                  type="number"
                  value={holdingPeriodDays}
                  onChange={(e) => setHoldingPeriodDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
            </div>
          </div>

          {/* Scenario Moves */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Scenario moves</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Bull move (%)</span>
                <input
                  type="number"
                  value={bullMovePercent}
                  onChange={(e) => setBullMovePercent(parseFloat(e.target.value) || 0)}
                  step={1}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Bear move (%)</span>
                <input
                  type="number"
                  value={bearMovePercent}
                  onChange={(e) => setBearMovePercent(parseFloat(e.target.value) || 0)}
                  step={1}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
            </div>
          </div>

          {/* Compounding Setup */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Projection</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Monthly target (%)</span>
                <input
                  type="number"
                  value={monthlyTargetPercent}
                  onChange={(e) => setMonthlyTargetPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.1}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Number of months</span>
                <input
                  type="number"
                  value={numberOfTrades}
                  onChange={(e) => setNumberOfTrades(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Assumed win rate (%)</span>
                <input
                  type="number"
                  value={winRateAssumption}
                  onChange={(e) => setWinRateAssumption(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  step={1}
                  min={0}
                  max={100}
                  className="h-9 rounded-cell border border-line-strong bg-panel px-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30"
                />
              </label>
            </div>
          </div>
        </aside>

        {/* OUTPUTS PANELS */}
        <div className="space-y-3">
          {!scenarioReady ? (
            <div className="terminal-panel rounded-panel p-6 text-center">
              <p className="text-sm font-semibold text-ink-title">
                Enter a ticker and a positive {activeCurrency} entry price
              </p>
              <p className="mt-1 text-xs text-ink-3">
                Position sizing, risk, and scenario outcomes appear only after
                the inputs are complete.
              </p>
            </div>
          ) : (
            <>
          {/* Position Sizing */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Position sizing</h2>
            <div className="mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-3">
              {[
                ['Shares', formatNumber(analysis.sizing.shares, 2), 'text-ink-title'],
                ['Stop price', cur(analysis.sizing.stopPrice), 'text-negative'],
                ['Target price', cur(analysis.sizing.targetPrice), 'text-positive'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk & Reward */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Risk & reward</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {[
                [`Risk (${activeCurrency})`, cur(analysis.riskReward.riskDollar), toneClass(-1)],
                [`Reward (${activeCurrency})`, cur(analysis.riskReward.rewardDollar), toneClass(1)],
                ['R:R ratio', formatNumber(analysis.riskReward.riskRewardRatio, 2), 'text-ink-title'],
                ['Risk % capital', formatPercent(analysis.riskReward.riskPercent), toneClass(-1)],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Position Weight & Exposure */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Exposure impact</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-2">
              {[
                ['Position weight', formatPercent(analysis.riskReward.positionWeightPercent, 1), 'text-ink-title'],
                ['Total portfolio exposure', formatPercent(analysis.exposure.totalExposureAfterTrade, 1), 'text-blue-focus'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario Table */}
          <div className="terminal-panel overflow-hidden rounded-panel">
            <div className="border-b border-line px-3 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Bull / Base / Bear outcomes</h2>
              <p className="mt-1 font-mono text-xs text-ink-3">Deterministic scenario P&L at each price level.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-chrome font-mono uppercase text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Scenario</th>
                    <th className="px-3 py-2">Price move</th>
                    <th className="px-3 py-2">Result price</th>
                    <th className="px-3 py-2">P&amp;L ({activeCurrency})</th>
                    <th className="px-3 py-2">P&L (%)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scenarios.map((s) => (
                    <tr className="font-mono text-ink-title" key={s.label}>
                      <td className="px-3 py-2">{s.label}</td>
                      <td className="px-3 py-2">{formatSignedPercent(s.priceMove, 1)}</td>
                      <td className="px-3 py-2">{cur(s.resultPrice)}</td>
                      <td className={`px-3 py-2 ${toneClass(s.pnlDollar)}`}>{cur(s.pnlDollar)}</td>
                      <td className={`px-3 py-2 ${toneClass(s.pnlPercent)}`}>{formatSignedPercent(s.pnlPercent, 1)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            'rounded px-2 py-1 text-xs font-semibold',
                            s.status === 'won'
                              ? 'border-positive/40 bg-positive-tint text-positive'
                              : s.status === 'lost'
                                ? 'border-negative/40 bg-negative/10 text-negative'
                                : 'border-line-strong bg-panel text-ink-3',
                          ].join(' ')}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Win Rate & Expected Value */}
          <div className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Win rate analysis</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {[
                [`Avg win (${activeCurrency})`, cur(winRateAnalysis.avgWinDollar), toneClass(1)],
                [`Avg loss (${activeCurrency})`, cur(winRateAnalysis.avgLossDollar), toneClass(-1)],
                ['Breakeven win %', formatPercent(winRateAnalysis.requiredWinRatePercent, 1), 'text-ink-title'],
                [`EV per trade (${activeCurrency})`, cur(winRateAnalysis.expectedValuePerTrade), toneClass(winRateAnalysis.expectedValuePerTrade)],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-2">
              If win rate assumption is {formatPercent(winRateAssumption, 0)}, expected value per trade is{' '}
              <span className={toneClass((winRateAnalysis.avgWinDollar * winRateAssumption) / 100 - (winRateAnalysis.avgLossDollar * (1 - winRateAssumption / 100)))}>
                {cur((winRateAnalysis.avgWinDollar * winRateAssumption) / 100 - (winRateAnalysis.avgLossDollar * (1 - winRateAssumption / 100)))}
              </span>
              .
            </p>
          </div>
            </>
          )}

          {/* Compounding Projection Chart */}
          <CompoundingProjectionChart
            data={compoundingData}
            initialCapital={availableCash}
            currency={activeCurrency}
          />
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// COMPOUNDING PROJECTION MINI CHART
// =============================================================================

function CompoundingProjectionChart({
  data,
  initialCapital,
  currency,
}: {
  data: Array<{ month: number; endBalance: number }>;
  initialCapital: number;
  currency: string;
}) {
  const balances = data.map((d) => d.endBalance);
  const minBalance = Math.min(...balances, initialCapital);
  const maxBalance = Math.max(...balances, initialCapital);
  const range = maxBalance - minBalance || 1;

  const width = 600;
  const height = 160;
  const pad = 12;

  // Generate SVG path
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const path = data
    .map((d, i) => {
      const x = pad + step * i;
      const y = height - pad - ((d.endBalance - minBalance) / range) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const finalBalance = data[data.length - 1]?.endBalance ?? initialCapital;
  const totalGain = finalBalance - initialCapital;
  const totalGainPercent = (totalGain / initialCapital) * 100;

  return (
    <div className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Compounding projection</p>
          <p className="mt-1 text-xs text-ink-2">Growth to {formatCurrency(finalBalance, currency)} over {data.length - 1} months.</p>
        </div>
        <div className="text-right">
          <p className={`numeric font-mono text-sm font-semibold ${toneClass(totalGain)}`}>{formatCurrency(totalGain, currency)}</p>
          <p className={`numeric font-mono text-xs ${toneClass(totalGain)}`}>{formatSignedPercent(totalGainPercent, 1)}</p>
        </div>
      </div>
      <div className="relative h-40 overflow-hidden px-4 py-4">
        {/* SVG paints use Tailwind stroke-/fill- token classes (presentation attributes cannot
            resolve CSS var(); the class form keeps the chart on the token palette). */}
        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid line */}
          <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="stroke-line" strokeWidth="1" />
          {/* Path - projection line reads as info/selection blue, not a gain/loss claim */}
          <path d={path} fill="none" className="stroke-blue-focus" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {/* End dot */}
          {data.length > 0 && (
            <circle cx={pad + step * (data.length - 1)} cy={height - pad - ((finalBalance - minBalance) / range) * (height - pad * 2)} r="3" className="fill-blue-focus" />
          )}
        </svg>
        <div className="absolute bottom-2 left-4 right-4 flex justify-between font-mono text-[10px] text-ink-dim">
          <span>Month 0</span>
          <span>Month {data.length - 1}</span>
        </div>
      </div>
    </div>
  );
}
