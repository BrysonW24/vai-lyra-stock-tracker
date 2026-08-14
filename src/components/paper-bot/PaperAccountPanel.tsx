'use client';

import { Wallet, TrendingUp, Loader2 } from 'lucide-react';
import { MiniSparkline } from '@/components/ChartPrimitives';
import { TickerLogo } from '@/components/TickerLogo';
import { SaaSTooltip } from './SaaSTooltip';
import { PaperAccountCharts } from './PaperAccountCharts';
import type { Account } from './paper-bot-types';

interface PaperAccountPanelProps {
  account: Account | null;
  tourStep: number;
  closing: string | null;
  onClosePosition: (symbol: string) => void;
  onTourDismiss: () => void;
  onTourReplay: () => void;
}

/** Paper Account analytics - equity stats, curve, capital bar, positions, closed-trade stats. */
export function PaperAccountPanel({
  account,
  tourStep,
  closing,
  onClosePosition,
  onTourDismiss,
  onTourReplay,
}: PaperAccountPanelProps) {
  const pnlUp = (account?.unrealisedPnl ?? 0) >= 0;
  return (
    <div className={`terminal-panel rounded-panel p-4 relative ${tourStep === 4 ? 'z-50' : ''}`}>
      {tourStep === 4 && (
        <SaaSTooltip
          title="Track it live"
          body="That was a scripted walkthrough fill - it is not recorded in your account. When you approve a real paper trade, it lands here as an open position tracking live P/L. Tour complete! 🎉"
          position="bottom"
          onDismiss={onTourDismiss}
          onReplay={onTourReplay}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-cell border border-positive/30 bg-positive-tint text-positive">
            <Wallet size={13} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-title">Paper Account</span>
          {account && (
            <span className={`rounded-full border px-2 py-px text-[8px] font-semibold uppercase tracking-[0.08em] ${
              account.dataSource === 'persisted' ? 'border-positive/50 bg-positive-tint text-positive' : 'border-accent-border/60 bg-accent-tint/80 text-accent'
            }`}>
              {account.dataSource === 'persisted' ? 'Saved' : 'Session'}
            </span>
          )}
        </div>
        <span className="text-[9px] text-ink-dim">{account?.fillCount ?? 0} fills · {account?.openPositions ?? 0} open</span>
      </div>

      {!account || (account.openPositions === 0 && account.closedTrades === 0) ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-3 rounded-cell border border-dashed border-line py-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-line bg-chrome">
            <TrendingUp size={20} className="text-ink-dim/80" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink-dim">No positions yet</p>
            <p className="mt-0.5 text-[10px] text-ink-dim/80">Approved fills appear here with live P/L tracking</p>
          </div>
        </div>
      ) : (
        <>
          {/* Hero equity stats */}
          <div className="grid grid-cols-3 gap-2 mb-3 tabular-nums">
            <div className="rounded-cell border border-line bg-well p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-[0.1em] text-ink-dim mb-0.5">Equity</p>
              <p className="font-mono text-[14px] font-bold text-ink">${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-cell border border-line bg-well p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-[0.1em] text-ink-dim mb-0.5">Unrealised P/L</p>
              <p className={`font-mono text-[14px] font-bold ${pnlUp ? 'text-positive' : 'text-negative'}`}>
                {pnlUp ? '+' : ''}${account.unrealisedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-cell border border-blue-focus/40 bg-blue-tint/60 p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-[0.1em] text-ink-dim mb-0.5">Cash Free</p>
              <p className="font-mono text-[14px] font-bold text-pending">
                ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Equity curve chart. No derived calendar dates on the axis: curve points are
              snapshots (per trade / poll), not one-per-day - the old "(Aug 3)" start label
              invented a date from the point count (2026-08-11 audit). */}
          {account.equityCurve && account.equityCurve.length >= 2 && (() => {
            return (
              <div className="mb-3 rounded-cell border border-line bg-well p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-ink-dim">Portfolio Value Over Time</span>
                  <span className={`text-[9px] font-semibold tabular-nums ${account.equity >= account.startingEquity ? 'text-positive' : 'text-negative'}`}>
                    {account.equity >= account.startingEquity ? '▲' : '▼'} {Math.abs(((account.equity - account.startingEquity) / account.startingEquity) * 100).toFixed(2)}%
                  </span>
                </div>
                {/* SVG paint props (ChartPrimitives): byte-copies of the positive/negative tokens -
                    fill=/stroke= attributes cannot resolve var(), and gain/loss IS the meaning (P2 ruling).
                    Line only: the old Candle toggle drew invented OHLC wicks on real daily equity
                    marks - fabricated intrabar detail, removed in the 2026-08-11 honesty audit. */}
                <MiniSparkline
                  values={account.equityCurve}
                  color={account.equity >= account.startingEquity ? '#43d18b' : '#ff6b6b'}
                  className="h-14 w-full"
                />
                <div className="mt-1 flex justify-between tabular-nums">
                  <span className="text-[8px] text-ink-dim">Start ${account.startingEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span className="text-[8px] text-ink-dim">Now ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            );
          })()}

          {/* Cash remaining bar */}
          <div className="mb-3 rounded-cell border border-blue-focus/40 bg-blue-tint/50 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] uppercase tracking-[0.1em] text-ink-dim">Capital Deployed</span>
              <span className="font-mono text-[10px] tabular-nums text-pending">{Math.round((account.totalInvested / account.equity) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
              {/* Progress fill, not a CTA - gradient allowed per the P1 GoalCockpit ruling */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-deep to-pending transition-all duration-700"
                style={{ width: `${Math.min(100, (account.totalInvested / account.equity) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between tabular-nums">
              <span className="text-[8px] text-ink-dim">Invested ${account.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-[8px] text-positive">Free ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Per-position cards */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase tracking-[0.1em] text-ink-dim">Open Positions</p>
            {account.positions.map((p) => {
              const up = p.unrealisedPnl >= 0;
              const mag = Math.min(100, Math.abs(p.unrealisedPnlPct) * 8);
              return (
                <div key={p.symbol} className={`rounded-cell border p-3 transition ${
                  up ? 'border-positive/40 bg-positive-tint' : 'border-negative-soft/40 bg-negative/10'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <TickerLogo symbol={p.symbol} size={20} />
                        <span className="font-mono text-[15px] font-bold text-ink">{p.symbol}</span>
                        <span className="rounded-full border border-line bg-chrome px-2 py-px font-mono text-[9px] text-ink-3">
                          {p.quantity} units
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[9px] tabular-nums text-ink-dim">
                        Avg ${p.avgEntryPrice} → ${p.currentPrice}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className={`font-mono text-[14px] font-bold ${up ? 'text-positive' : 'text-negative'}`}>
                        {up ? '+' : ''}${p.unrealisedPnl.toFixed(2)}
                      </p>
                      <p className={`font-mono text-[10px] ${up ? 'text-positive/70' : 'text-negative/70'}`}>
                        {up ? '+' : ''}{p.unrealisedPnlPct}%
                      </p>
                    </div>
                  </div>
                  {/* P/L bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 overflow-hidden rounded-full bg-line/70">
                      {/* Progress fill, not a CTA - gradient allowed per the P1 GoalCockpit ruling */}
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          up ? 'bg-gradient-to-r from-positive/50 to-positive' : 'bg-gradient-to-r from-negative/50 to-negative'
                        }`}
                        style={{ width: `${Math.max(4, mag)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] tabular-nums text-ink-dim">
                      Val ${p.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onClosePosition(p.symbol)}
                      disabled={closing !== null}
                      className="inline-flex min-h-[44px] items-center rounded-cell border border-negative-soft/30 bg-negative/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wide text-negative-soft transition hover:bg-negative/20 disabled:opacity-50 sm:min-h-0"
                    >
                      {closing === p.symbol ? <Loader2 size={9} className="animate-spin" /> : 'Close'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Allocation, Sector, P&L, Benchmark Charts */}
          <div className="mt-3">
            <PaperAccountCharts
              positions={account.positions}
              totalMarketValue={account.marketValue}
              equityCurve={account.equityCurve}
              startingEquity={account.startingEquity}
            />
          </div>

          {/* Realised performance */}
          {account.closedTrades > 0 && (
            <div className="mt-3 rounded-cell border border-line bg-well px-3 py-2.5">
              <p className="mb-2 text-[9px] uppercase tracking-[0.1em] text-ink-dim">Closed Trade Stats</p>
              <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                <div>
                  <p className="text-[8px] text-ink-dim">Win Rate</p>
                  <p className={`font-mono text-[13px] font-bold ${account.winRate >= 50 ? 'text-positive' : 'text-negative'}`}>{account.winRate}%</p>
                </div>
                <div>
                  <p className="text-[8px] text-ink-dim">Realised</p>
                  <p className={`font-mono text-[13px] font-bold ${account.realisedPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {account.realisedPnl >= 0 ? '+' : ''}${account.realisedPnl}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] text-ink-dim">Expectancy</p>
                  <p className={`font-mono text-[13px] font-bold ${account.expectancy >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {account.expectancy >= 0 ? '+' : ''}${account.expectancy}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="mt-2 text-[8px] leading-snug text-ink-dim">
            {account.dataSource === 'persisted'
              ? 'Saved - positions, trades and equity curve survive app restarts.'
              : 'In-memory this session. Sign in for a persistent saved track record.'}
          </p>
        </>
      )}
    </div>
  );
}
