'use client';

import Link from 'next/link';
import { Bot, Sparkles, ArrowRight, Wallet, TrendingUp } from 'lucide-react';
import type { PaperAccountSummary } from '@/lib/trading/paper-account-store';

export function PaperBotStrip({ account }: { account: PaperAccountSummary }) {
  const hasTraded = account.fillCount > 0 || account.openPositions > 0;

  if (!hasTraded) {
    return (
      <section className="terminal-panel overflow-hidden rounded-md border border-[#8aa2ff]/30 bg-[#101a2e]">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#8aa2ff]/50 bg-[#15233d] text-[#8aa2ff]">
              <Bot size={20} />
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2ff]">
                Paper Bot <Sparkles size={11} className="text-[#f3a33a]" />
              </p>
              <p className="mt-0.5 text-xs text-[#a8b5c2]">
                Practise the AI pipeline with fake money. Walk through an end-to-end simulated trade.
              </p>
            </div>
          </div>
          <Link
            href="/paper-bot?tour=true"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#8aa2ff]/40 bg-[#15233d] px-3 py-1.5 text-xs font-semibold text-[#8aa2ff] transition hover:bg-[#1c2d4f]"
          >
            Start your first trade <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    );
  }

  const pnlUp = account.unrealisedPnl >= 0;

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-[#8aa2ff]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Paper Bot Performance</p>
        </div>
        <Link href="/paper-bot" className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]">
          Open Bot <ArrowRight size={12} />
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d1117] px-3 py-2.5">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-mono text-[10px] text-[#6f7d8a]">Equity</p>
            <p className="font-mono text-[13px] font-semibold text-[#eef3f8]">${account.equity.toLocaleString()}</p>
          </div>
          <div className="h-6 w-px bg-[#1b2530]" />
          <div>
            <p className="font-mono text-[10px] text-[#6f7d8a]">Open P/L</p>
            <p className={`font-mono text-[13px] font-semibold ${pnlUp ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
              {pnlUp ? '+' : ''}{account.unrealisedPnl} ({pnlUp ? '+' : ''}{account.unrealisedPnlPct}%)
            </p>
          </div>
          <div className="hidden h-6 w-px bg-[#1b2530] sm:block" />
          <div className="hidden sm:block">
            <p className="font-mono text-[10px] text-[#6f7d8a]">Win rate</p>
            <p className="font-mono text-[13px] font-semibold text-[#eef3f8]">{account.winRate}%</p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] text-[#8190a0]">
          <span>{account.openPositions} open</span>
          <span>{account.closedTrades} closed</span>
        </div>
      </div>
    </section>
  );
}
