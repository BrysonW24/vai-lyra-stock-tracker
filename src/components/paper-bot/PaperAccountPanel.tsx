'use client';

import { Wallet, TrendingUp, Loader2 } from 'lucide-react';
import { MiniSparkline, MiniCandlestick } from '@/components/ChartPrimitives';
import { TickerLogo } from '@/components/TickerLogo';
import { SaaSTooltip } from './SaaSTooltip';
import { PaperAccountCharts } from './PaperAccountCharts';
import type { Account } from './paper-bot-types';

interface PaperAccountPanelProps {
  account: Account | null;
  tourStep: number;
  chartType: 'line' | 'candle';
  onChartTypeChange: (type: 'line' | 'candle') => void;
  closing: string | null;
  onClosePosition: (symbol: string) => void;
  onTourDismiss: () => void;
  onTourReplay: () => void;
}

/** Paper Account analytics - equity stats, curve, capital bar, positions, closed-trade stats. */
export function PaperAccountPanel({
  account,
  tourStep,
  chartType,
  onChartTypeChange,
  closing,
  onClosePosition,
  onTourDismiss,
  onTourReplay,
}: PaperAccountPanelProps) {
  const pnlUp = (account?.unrealisedPnl ?? 0) >= 0;
  return (
    <div className={`terminal-panel rounded-md p-4 relative ${tourStep === 4 ? 'z-50' : ''}`}>
      {tourStep === 4 && (
        <SaaSTooltip
          title="Track it live"
          body="Your simulated trade is now an open position! It tracks live P/L based on real market prices. Tour complete! 🎉"
          position="bottom"
          onDismiss={onTourDismiss}
          onReplay={onTourReplay}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[#43d18b]/30 bg-[#0d251b] text-[#43d18b]">
            <Wallet size={13} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Paper Account</span>
          {account && (
            <span className={`rounded-full border px-2 py-px text-[8px] font-semibold uppercase tracking-[0.08em] ${
              account.dataSource === 'persisted' ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]' : 'border-[#5a4a1a] bg-[#231a08] text-[#f3a33a]'
            }`}>
              {account.dataSource === 'persisted' ? 'Saved' : 'Session'}
            </span>
          )}
        </div>
        <span className="text-[9px] text-[#6f7d8a]">{account?.fillCount ?? 0} fills · {account?.openPositions ?? 0} open</span>
      </div>

      {!account || (account.openPositions === 0 && account.closedTrades === 0) ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#1d2733] py-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-[#1d2733] bg-[#0b1016]">
            <TrendingUp size={20} className="text-[#3a4a5a]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#4a5a6a]">No positions yet</p>
            <p className="mt-0.5 text-[10px] text-[#3a4a5a]">Approved fills appear here with live P/L tracking</p>
          </div>
        </div>
      ) : (
        <>
          {/* Hero equity stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg border border-[#1d2733] bg-[#080c11] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-[0.1em] text-[#6f7d8a] mb-0.5">Equity</p>
              <p className="font-mono text-[14px] font-bold text-[#eef3f8]">${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border border-[#1d2733] bg-[#080c11] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-[0.1em] text-[#6f7d8a] mb-0.5">Unrealised P/L</p>
              <p className={`font-mono text-[14px] font-bold ${pnlUp ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                {pnlUp ? '+' : ''}${account.unrealisedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-lg border border-[#1d3a5a] bg-[#0b1626] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-[0.1em] text-[#6f7d8a] mb-0.5">Cash Free</p>
              <p className="font-mono text-[14px] font-bold text-[#8aa2ff]">
                ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Equity curve chart */}
          {account.equityCurve && account.equityCurve.length >= 2 && (() => {
            const days = account.equityCurve.length;
            const startDate = new Date(Date.now() - (days - 1) * 86400000);
            const startLabel = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const nowLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <div className="mb-3 rounded-lg border border-[#1d2733] bg-[#080c11] p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[#6f7d8a]">Portfolio Value Over Time</span>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-md bg-[#0d141c] p-0.5 border border-[#1d2733]">
                      <button
                        type="button"
                        onClick={() => onChartTypeChange('line')}
                        className={`rounded px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider transition-colors ${
                          chartType === 'line'
                            ? 'bg-[#1e2d3d] text-[#eef3f8]'
                            : 'text-[#5e6b78] hover:text-[#8190a0]'
                        }`}
                      >
                        Line
                      </button>
                      <button
                        type="button"
                        onClick={() => onChartTypeChange('candle')}
                        className={`rounded px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider transition-colors ${
                          chartType === 'candle'
                            ? 'bg-[#1e2d3d] text-[#eef3f8]'
                            : 'text-[#5e6b78] hover:text-[#8190a0]'
                        }`}
                      >
                        Candle
                      </button>
                    </div>
                    <span className={`text-[9px] font-semibold ${account.equity >= account.startingEquity ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                      {account.equity >= account.startingEquity ? '▲' : '▼'} {Math.abs(((account.equity - account.startingEquity) / account.startingEquity) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
                {chartType === 'line' ? (
                  <MiniSparkline
                    values={account.equityCurve}
                    color={account.equity >= account.startingEquity ? '#43d18b' : '#ff6b6b'}
                    className="h-14 w-full"
                  />
                ) : (
                  <MiniCandlestick
                    values={account.equityCurve}
                    positiveColor="#43d18b"
                    negativeColor="#ff6b6b"
                    className="h-14 w-full"
                  />
                )}
                <div className="mt-1 flex justify-between">
                  <span className="text-[8px] text-[#5e6b78]">Start ({startLabel}) ${account.startingEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span className="text-[8px] text-[#5e6b78]">Now ({nowLabel}) ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            );
          })()}

          {/* Cash remaining bar */}
          <div className="mb-3 rounded-lg border border-[#1d3a5a] bg-gradient-to-r from-[#0b1626] to-[#0d141c] px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Capital Deployed</span>
              <span className="font-mono text-[10px] text-[#8aa2ff]">{Math.round((account.totalInvested / account.equity) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#0d141c]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#8aa2ff] transition-all duration-700"
                style={{ width: `${Math.min(100, (account.totalInvested / account.equity) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[8px] text-[#5e6b78]">Invested ${account.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-[8px] text-[#43d18b]">Free ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Per-position cards */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Open Positions</p>
            {account.positions.map((p) => {
              const up = p.unrealisedPnl >= 0;
              const mag = Math.min(100, Math.abs(p.unrealisedPnlPct) * 8);
              return (
                <div key={p.symbol} className={`rounded-lg border p-3 transition ${
                  up ? 'border-[#1d4a35] bg-gradient-to-r from-[#0a1e14] to-[#0d251b]' : 'border-[#4a1d2a] bg-gradient-to-r from-[#1e0a10] to-[#2b1214]'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <TickerLogo symbol={p.symbol} size={20} />
                        <span className="font-mono text-[15px] font-bold text-[#eef3f8]">{p.symbol}</span>
                        <span className="rounded-full border border-[#1d2733] bg-[#0b1016] px-2 py-px font-mono text-[9px] text-[#8190a0]">
                          {p.quantity} units
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[9px] text-[#6f7d8a]">
                        Avg ${p.avgEntryPrice} → ${p.currentPrice}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-[14px] font-bold ${up ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                        {up ? '+' : ''}${p.unrealisedPnl.toFixed(2)}
                      </p>
                      <p className={`font-mono text-[10px] ${up ? 'text-[#43d18b]/70' : 'text-[#ff6b6b]/70'}`}>
                        {up ? '+' : ''}{p.unrealisedPnlPct}%
                      </p>
                    </div>
                  </div>
                  {/* P/L bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 overflow-hidden rounded-full bg-[#11181f]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          up ? 'bg-gradient-to-r from-[#1d7f55] to-[#43d18b]' : 'bg-gradient-to-r from-[#7f1d1d] to-[#ff6b6b]'
                        }`}
                        style={{ width: `${Math.max(4, mag)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-[#5e6b78]">
                      Val ${p.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onClosePosition(p.symbol)}
                      disabled={closing !== null}
                      className="inline-flex items-center rounded-md border border-[#3a2630] bg-[#1c1116] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wide text-[#e08a9a] transition hover:bg-[#26161d] disabled:opacity-50"
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
            <div className="mt-3 rounded-lg border border-[#1d2733] bg-[#080c11] px-3 py-2.5">
              <p className="mb-2 text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Closed Trade Stats</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[8px] text-[#5e6b78]">Win Rate</p>
                  <p className={`font-mono text-[13px] font-bold ${account.winRate >= 50 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>{account.winRate}%</p>
                </div>
                <div>
                  <p className="text-[8px] text-[#5e6b78]">Realised</p>
                  <p className={`font-mono text-[13px] font-bold ${account.realisedPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                    {account.realisedPnl >= 0 ? '+' : ''}${account.realisedPnl}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] text-[#5e6b78]">Expectancy</p>
                  <p className={`font-mono text-[13px] font-bold ${account.expectancy >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                    {account.expectancy >= 0 ? '+' : ''}${account.expectancy}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="mt-2 text-[8px] leading-snug text-[#5e6b78]">
            {account.dataSource === 'persisted'
              ? 'Saved - positions, trades and equity curve survive app restarts.'
              : 'In-memory this session. Sign in for a persistent saved track record.'}
          </p>
        </>
      )}
    </div>
  );
}
