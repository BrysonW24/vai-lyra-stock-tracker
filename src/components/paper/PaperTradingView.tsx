'use client';

import { useState } from 'react';
import type {
  MistakeTag,
  PaperAccountSummary,
  PaperExitReason,
  PaperJournalEntry,
  PaperTrade,
  StrategyReadiness,
} from '@/lib/paper-trading';
import { computeOpenTradePnl } from '@/lib/paper-trading';
import { formatCurrency, formatSignedPercent, toneClass } from '@/lib/format';

interface PaperTradingViewProps {
  summary: PaperAccountSummary;
  trades: PaperTrade[];
  journal: PaperJournalEntry[];
  readiness: StrategyReadiness[];
}

const EXIT_REASON_LABELS: Record<PaperExitReason, string> = {
  target_hit: 'Target hit',
  stop_hit: 'Stop hit',
  trailing_stop: 'Trailing stop',
  signal_invalidated: 'Signal invalidated',
  time_stop: 'Time stop',
  manual_close: 'Manual close',
};

const MISTAKE_TAG_LABELS: Record<MistakeTag, string> = {
  chased_entry: 'Chased entry',
  oversized: 'Oversized',
  moved_stop: 'Moved stop',
  ignored_regime: 'Ignored regime',
  early_exit: 'Early exit',
  late_exit: 'Late exit',
  revenge_trade: 'Revenge trade',
  no_mistake: 'No mistake',
};

function exitReasonChipClass(reason: PaperExitReason): string {
  if (reason === 'target_hit' || reason === 'trailing_stop') {
    return 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]';
  }

  if (reason === 'stop_hit' || reason === 'signal_invalidated') {
    return 'border-[#7f1d1d] bg-[#2b1214] text-[#f0758a]';
  }

  return 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]';
}

function mistakeChipClass(tag: MistakeTag): string {
  if (tag === 'no_mistake') {
    return 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]';
  }

  return 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]';
}

function signedCurrency(value: number): string {
  return `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PaperTradingView({ summary, trades, journal, readiness }: PaperTradingViewProps) {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades
    .filter((t) => t.status === 'closed')
    .sort((a, b) => (b.exitAt ?? '').localeCompare(a.exitAt ?? ''));
  const journalByTradeId = new Map(journal.map((entry) => [entry.tradeId, entry]));

  return (
    <div className="space-y-3">
      {/* Demo-safety banner */}
      <section className="rounded-md border border-[#2b4569] bg-[#101a2b] p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[#7fb0ff]">Simulated environment</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#a8b5c2]">
          Paper trading - simulated fills with spread, slippage and fees. No real money. No live execution exists in
          this build.
        </p>
      </section>

      {/* Summary strip */}
      <section className="grid grid-cols-3 gap-1.5">
        {([
          ['Paper P/L', `${signedCurrency(summary.totalPnl)} (${formatSignedPercent(summary.totalPnlPct)})`, toneClass(summary.totalPnl)],
          ['Win rate', summary.winRate === null ? 'n/a' : `${summary.winRate.toFixed(0)}% of ${summary.closedTrades}`, 'text-[#7fb0ff]'],
          ['Open trades', String(summary.openTrades), 'text-[#eef3f8]'],
        ] as const).map(([label, value, tone]) => (
          <div className="terminal-panel rounded-md p-2" key={label}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
            <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* Open trades */}
      <section className="terminal-panel rounded-md p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[#eef3f8]">Open trades</h2>
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">
            Unrealised {signedCurrency(summary.unrealisedPnl)}
          </p>
        </div>
        <div className="mt-2 space-y-1.5">
          {openTrades.map((trade) => {
            const { pnl, pnlPct } = computeOpenTradePnl(trade);
            return (
              <div
                className="flex items-center gap-2 rounded border border-[#1b2530] bg-[#0d141c] px-2 py-1.5"
                key={trade.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-[#eef3f8]">{trade.symbol}</span>
                    <span className="rounded border border-[#263241] bg-[#121923] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#a8b5c2]">
                      {trade.side}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-[#8190a0]">{trade.reasonCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Entry</p>
                  <p className="font-mono text-[11px] text-[#a8b5c2]">{formatCurrency(trade.entryPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Stop</p>
                  <p className="font-mono text-[11px] text-[#f0758a]">{formatCurrency(trade.stopPrice)}</p>
                </div>
                <div className="min-w-[84px] text-right">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">P/L</p>
                  <p className={`font-mono text-[11px] font-semibold ${toneClass(pnl)}`}>
                    {signedCurrency(pnl)} ({formatSignedPercent(pnlPct)})
                  </p>
                </div>
              </div>
            );
          })}
          {openTrades.length === 0 ? (
            <p className="text-[11px] text-[#8190a0]">No open paper trades.</p>
          ) : null}
        </div>
      </section>

      {/* Closed trades */}
      <section className="terminal-panel rounded-md p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[#eef3f8]">Closed trades</h2>
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">
            Realised {signedCurrency(summary.realisedPnl)}
          </p>
        </div>
        <div className="mt-2 space-y-1.5">
          {closedTrades.map((trade) => {
            const expanded = expandedTradeId === trade.id;
            const journalEntry = journalByTradeId.get(trade.id);
            const realised = trade.realisedPnl ?? 0;
            return (
              <div className="rounded border border-[#1b2530] bg-[#0d141c]" key={trade.id}>
                <button
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                  onClick={() => setExpandedTradeId(expanded ? null : trade.id)}
                  type="button"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-[#eef3f8]">{trade.symbol}</span>
                      <span className="rounded border border-[#263241] bg-[#121923] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#a8b5c2]">
                        {trade.side}
                      </span>
                      {trade.exitReason ? (
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${exitReasonChipClass(trade.exitReason)}`}>
                          {EXIT_REASON_LABELS[trade.exitReason]}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-[#8190a0]">
                      {shortDate(trade.entryAt)}
                      {trade.exitAt ? ` to ${shortDate(trade.exitAt)}` : ''} · {trade.quantity} sh
                    </p>
                  </div>
                  <div className="min-w-[84px] text-right">
                    <p className={`font-mono text-[11px] font-semibold ${toneClass(realised)}`}>{signedCurrency(realised)}</p>
                    <p className="font-mono text-[9px] text-[#8190a0]">{expanded ? 'collapse' : 'expand'}</p>
                  </div>
                </button>
                {expanded ? (
                  <div className="space-y-2 border-t border-[#1b2530] px-2 py-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Thesis snapshot at entry</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#a8b5c2]">{trade.thesisSnapshot.note}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {([
                          ['Score', String(trade.thesisSnapshot.signalScore)],
                          ['Status', trade.thesisSnapshot.signalStatus],
                          ['RSI', trade.thesisSnapshot.rsi.toFixed(1)],
                          ['MACD', trade.thesisSnapshot.macdState],
                          ['Vol', `${trade.thesisSnapshot.volumeRatio.toFixed(1)}x`],
                        ] as const).map(([label, value]) => (
                          <span
                            className="rounded border border-[#263241] bg-[#121923] px-1.5 py-0.5 font-mono text-[9px] text-[#a8b5c2]"
                            key={label}
                          >
                            {label} {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="rounded-md border border-[#263241] bg-[#121923] p-2">
                        <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Exit reason</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#eef3f8]">
                          {trade.exitReason ? EXIT_REASON_LABELS[trade.exitReason] : 'n/a'}
                        </p>
                      </div>
                      <div className="rounded-md border border-[#263241] bg-[#121923] p-2">
                        <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Entry / exit</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#eef3f8]">
                          {formatCurrency(trade.entryPrice)} / {trade.exitPrice !== undefined ? formatCurrency(trade.exitPrice) : 'n/a'}
                        </p>
                      </div>
                      <div className="rounded-md border border-[#263241] bg-[#121923] p-2">
                        <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Fees + slippage</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#f3a33a]">
                          -{formatCurrency(trade.fees + trade.slippage)}
                        </p>
                      </div>
                    </div>
                    {journalEntry ? (
                      <div className="rounded-md border border-[#263241] bg-[#121923] p-2">
                        <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Journal note</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#a8b5c2]">{journalEntry.note}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Strategy readiness */}
      <section className="terminal-panel rounded-md p-3">
        <h2 className="text-sm font-semibold text-[#eef3f8]">Strategy readiness</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#a8b5c2]">
          Honest automation gates per strategy. Every strategy stays manual-research-only until all gates pass - and
          even then the deterministic risk engine and human approval sit in front of any execution path.
        </p>
        <div className="mt-2 space-y-1.5">
          {readiness.map((strategy) => (
            <div className="rounded border border-[#1b2530] bg-[#0d141c] p-2" key={strategy.strategyId}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-[#eef3f8]">{strategy.strategyLabel}</span>
                <span className="rounded border border-[#263241] bg-[#121923] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0]">
                  n={strategy.sampleSize}
                </span>
                {strategy.winRate !== null ? (
                  <span className="rounded border border-[#263241] bg-[#121923] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0]">
                    win {strategy.winRate.toFixed(0)}%
                  </span>
                ) : null}
                <span className="ml-auto rounded border border-[#9a3a2a] bg-[#2a140f] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f3a33a]">
                  Not ready for automation
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {strategy.gates.map((gate) => (
                  <li className="flex items-start gap-1.5 text-[10px] leading-relaxed" key={gate.id}>
                    <span className={`font-mono ${gate.passed ? 'text-[#43d18b]' : 'text-[#f0758a]'}`}>
                      {gate.passed ? 'PASS' : 'FAIL'}
                    </span>
                    <span className="text-[#a8b5c2]">
                      {gate.label}
                      <span className="text-[#8190a0]"> - {gate.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Journal */}
      <section className="terminal-panel rounded-md p-3">
        <h2 className="text-sm font-semibold text-[#eef3f8]">Trade journal</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#a8b5c2]">
          Mistake tags and lessons captured per trade - the raw material the readiness gates are judged against.
        </p>
        <div className="mt-2 space-y-1.5">
          {journal.map((entry) => (
            <div className="rounded border border-[#1b2530] bg-[#0d141c] p-2" key={entry.id}>
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-mono text-[11px] font-semibold text-[#eef3f8]">{entry.symbol}</span>
                <span className="font-mono text-[9px] text-[#8190a0]">{shortDate(entry.createdAt)}</span>
                {entry.mistakeTags.map((tag) => (
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${mistakeChipClass(tag)}`} key={tag}>
                    {MISTAKE_TAG_LABELS[tag]}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#a8b5c2]">{entry.lesson}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
