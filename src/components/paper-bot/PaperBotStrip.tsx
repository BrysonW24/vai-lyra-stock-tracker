'use client';

import Link from 'next/link';
import { Bot, Sparkles, ArrowRight } from 'lucide-react';
import type { PaperAccountSummary } from '@/lib/trading/paper-account-store';

export function PaperBotStrip({ account }: { account: PaperAccountSummary }) {
  const hasTraded = account.fillCount > 0 || account.openPositions > 0;

  if (!hasTraded) {
    return (
      <section className="terminal-panel overflow-hidden rounded-panel border border-pending/30 bg-blue-tint">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-cell border border-pending/50 bg-blue-deep/30 text-pending">
              <Bot size={20} />
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-pending">
                Paper Bot <Sparkles size={11} className="text-accent" />
              </p>
              <p className="mt-0.5 text-xs text-ink-2">
                Practise the AI pipeline with fake money. Walk through an end-to-end simulated trade.
              </p>
            </div>
          </div>
          <Link
            href="/paper-bot?tour=true"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-cell border border-pending/40 bg-blue-deep/30 px-3 py-1.5 text-xs font-semibold text-pending transition hover:bg-blue-deep/40 sm:min-h-0"
          >
            Start your first trade <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    );
  }

  const pnlUp = account.unrealisedPnl >= 0;

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-pending" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Paper Bot Performance</p>
        </div>
        <Link href="/paper-bot" className="inline-flex min-h-[44px] items-center gap-1 rounded-cell border border-line-strong bg-panel px-2 py-1 text-xs text-ink-2 transition hover:text-ink sm:min-h-0">
          Open Bot <ArrowRight size={12} />
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-panel-deep px-3 py-2.5 tabular-nums">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-mono text-[10px] text-ink-dim">Equity</p>
            <p className="font-mono text-[13px] font-semibold text-ink">${account.equity.toLocaleString()}</p>
          </div>
          <div className="h-6 w-px bg-line" />
          <div>
            <p className="font-mono text-[10px] text-ink-dim">Open P/L</p>
            <p className={`font-mono text-[13px] font-semibold ${pnlUp ? 'text-positive' : 'text-negative'}`}>
              {pnlUp ? '+' : ''}{account.unrealisedPnl} ({pnlUp ? '+' : ''}{account.unrealisedPnlPct}%)
            </p>
          </div>
          <div className="hidden h-6 w-px bg-line sm:block" />
          <div className="hidden sm:block">
            <p className="font-mono text-[10px] text-ink-dim">Win rate</p>
            {/* '-' until a trade has CLOSED - the store's defined-zero placeholder read
                as "every trade lost" with only open positions (2026-08-14 audit). */}
            <p className="font-mono text-[13px] font-semibold text-ink">{account.closedTrades > 0 ? `${account.winRate}%` : '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] text-ink-3">
          <span>{account.openPositions} open</span>
          <span>{account.closedTrades} closed</span>
        </div>
      </div>
    </section>
  );
}
