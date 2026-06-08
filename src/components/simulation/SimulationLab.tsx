'use client';

import { useState, useMemo } from 'react';
import type { PortfolioHolding } from '@/types/scanner';
import {
  calculatePositionSizing,
  calculateRiskReward,
  calculateScenarioOutcomes,
  calculateExposureImpact,
  calculateCompoundingProjection,
  calculateWinRate,
  fullSimulationAnalysis,
  type TradeInputs,
} from '@/lib/simulation';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent, toneClass } from '@/lib/format';
import { MiniSparkline } from '@/components/ChartPrimitives';

interface SimulationLabProps {
  portfolio: PortfolioHolding[];
}

export function SimulationLab({ portfolio }: SimulationLabProps) {
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

    return fullSimulationAnalysis(inputs, portfolio);
  }, [availableCash, ticker, tradeAmount, entryPrice, stopPercent, targetPercent, holdingPeriodDays, portfolio]);

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
      {/* Header */}
      <section className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        {[
          ['Available capital', formatCurrency(availableCash), 'text-[#eef3f8]'],
          ['Trade amount', formatCurrency(tradeAmount), 'text-[#f3a33a]'],
          ['Entry price', formatCurrency(entryPrice), 'text-[#dbe5ee]'],
          ['Portfolio size', portfolio.length.toString(), 'text-[#60a5fa]'],
        ].map(([label, value, tone]) => (
          <div className="terminal-panel rounded-md p-2" key={label}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
            <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* Two-column layout: inputs left, outputs right */}
      <section className="grid gap-3 xl:grid-cols-[360px_1fr]">
        {/* INPUTS PANEL */}
        <aside className="space-y-3">
          {/* Trade Setup */}
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Trade setup</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Available cash</span>
                <input
                  type="number"
                  value={availableCash}
                  onChange={(e) => setAvailableCash(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Ticker</span>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Trade amount ($)</span>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Entry price ($)</span>
                <input
                  type="number"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.01}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Stop loss (%)</span>
                <input
                  type="number"
                  value={stopPercent}
                  onChange={(e) => setStopPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.5}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Target profit (%)</span>
                <input
                  type="number"
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.5}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Holding period (days)</span>
                <input
                  type="number"
                  value={holdingPeriodDays}
                  onChange={(e) => setHoldingPeriodDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
            </div>
          </div>

          {/* Scenario Moves */}
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Scenario moves</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Bull move (%)</span>
                <input
                  type="number"
                  value={bullMovePercent}
                  onChange={(e) => setBullMovePercent(parseFloat(e.target.value) || 0)}
                  step={1}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Bear move (%)</span>
                <input
                  type="number"
                  value={bearMovePercent}
                  onChange={(e) => setBearMovePercent(parseFloat(e.target.value) || 0)}
                  step={1}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
            </div>
          </div>

          {/* Compounding Setup */}
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Projection</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Monthly target (%)</span>
                <input
                  type="number"
                  value={monthlyTargetPercent}
                  onChange={(e) => setMonthlyTargetPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.1}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Number of months</span>
                <input
                  type="number"
                  value={numberOfTrades}
                  onChange={(e) => setNumberOfTrades(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Assumed win rate (%)</span>
                <input
                  type="number"
                  value={winRateAssumption}
                  onChange={(e) => setWinRateAssumption(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  step={1}
                  min={0}
                  max={100}
                  className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
                />
              </label>
            </div>
          </div>
        </aside>

        {/* OUTPUTS PANELS */}
        <div className="space-y-3">
          {/* Position Sizing */}
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Position sizing</h2>
            <div className="mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-3">
              {[
                ['Shares', formatNumber(analysis.sizing.shares, 2), 'text-[#dbe5ee]'],
                ['Stop price', formatCurrency(analysis.sizing.stopPrice), 'text-[#ff6b6b]'],
                ['Target price', formatCurrency(analysis.sizing.targetPrice), 'text-[#43d18b]'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk & Reward */}
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Risk & reward</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {[
                ['Risk ($)', formatCurrency(analysis.riskReward.riskDollar), toneClass(-1)],
                ['Reward ($)', formatCurrency(analysis.riskReward.rewardDollar), toneClass(1)],
                ['R:R ratio', formatNumber(analysis.riskReward.riskRewardRatio, 2), 'text-[#dbe5ee]'],
                ['Risk % capital', formatPercent(analysis.riskReward.riskPercent), toneClass(-1)],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Position Weight & Exposure */}
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Exposure impact</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-2">
              {[
                ['Position weight', formatPercent(analysis.riskReward.positionWeightPercent, 1), 'text-[#dbe5ee]'],
                ['Total portfolio exposure', formatPercent(analysis.exposure.totalExposureAfterTrade, 1), 'text-[#60a5fa]'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario Table */}
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Bull / Base / Bear outcomes</h2>
              <p className="mt-1 font-mono text-xs text-[#8190a0]">Deterministic scenario P&L at each price level.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
                  <tr>
                    <th className="px-3 py-2">Scenario</th>
                    <th className="px-3 py-2">Price move</th>
                    <th className="px-3 py-2">Result price</th>
                    <th className="px-3 py-2">P&L ($)</th>
                    <th className="px-3 py-2">P&L (%)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2530]">
                  {scenarios.map((s) => (
                    <tr className="font-mono text-[#dbe5ee]" key={s.label}>
                      <td className="px-3 py-2">{s.label}</td>
                      <td className="px-3 py-2">{formatSignedPercent(s.priceMove, 1)}</td>
                      <td className="px-3 py-2">{formatCurrency(s.resultPrice)}</td>
                      <td className={`px-3 py-2 ${toneClass(s.pnlDollar)}`}>{formatCurrency(s.pnlDollar)}</td>
                      <td className={`px-3 py-2 ${toneClass(s.pnlPercent)}`}>{formatSignedPercent(s.pnlPercent, 1)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            'rounded px-2 py-1 text-xs font-semibold',
                            s.status === 'won'
                              ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]'
                              : s.status === 'lost'
                                ? 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]'
                                : 'border-[#263241] bg-[#121923] text-[#8190a0]',
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
          <div className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Win rate analysis</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {[
                ['Avg win ($)', formatCurrency(winRateAnalysis.avgWinDollar), toneClass(1)],
                ['Avg loss ($)', formatCurrency(winRateAnalysis.avgLossDollar), toneClass(-1)],
                ['Breakeven win %', formatPercent(winRateAnalysis.requiredWinRatePercent, 1), 'text-[#dbe5ee]'],
                ['EV per trade ($)', formatCurrency(winRateAnalysis.expectedValuePerTrade), toneClass(winRateAnalysis.expectedValuePerTrade)],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
                  <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-[#a8b5c2]">
              If win rate assumption is {formatPercent(winRateAssumption, 0)}, expected value per trade is{' '}
              <span className={toneClass((winRateAnalysis.avgWinDollar * winRateAssumption) / 100 - (winRateAnalysis.avgLossDollar * (1 - winRateAssumption / 100)))}>
                {formatCurrency((winRateAnalysis.avgWinDollar * winRateAssumption) / 100 - (winRateAnalysis.avgLossDollar * (1 - winRateAssumption / 100)))}
              </span>
              .
            </p>
          </div>

          {/* Compounding Projection Chart */}
          <CompoundingProjectionChart data={compoundingData} initialCapital={availableCash} />
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
}: {
  data: Array<{ month: number; endBalance: number }>;
  initialCapital: number;
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
    <div className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between border-b border-[#1b2530] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Compounding projection</p>
          <p className="mt-1 text-xs text-[#a8b5c2]">Growth to {formatCurrency(finalBalance)} over {data.length - 1} months.</p>
        </div>
        <div className="text-right">
          <p className={`numeric font-mono text-sm font-semibold ${toneClass(totalGain)}`}>{formatCurrency(totalGain)}</p>
          <p className={`numeric font-mono text-xs ${toneClass(totalGain)}`}>{formatSignedPercent(totalGainPercent, 1)}</p>
        </div>
      </div>
      <div className="relative h-40 overflow-hidden px-4 py-4">
        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid line */}
          <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#17202a" strokeWidth="1" />
          {/* Path */}
          <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {/* End dot */}
          {data.length > 0 && (
            <circle cx={pad + step * (data.length - 1)} cy={height - pad - ((finalBalance - minBalance) / range) * (height - pad * 2)} r="3" fill="#60a5fa" />
          )}
        </svg>
        <div className="absolute bottom-2 left-4 right-4 flex justify-between font-mono text-[10px] text-[#5d6b79]">
          <span>Month 0</span>
          <span>Month {data.length - 1}</span>
        </div>
      </div>
    </div>
  );
}
