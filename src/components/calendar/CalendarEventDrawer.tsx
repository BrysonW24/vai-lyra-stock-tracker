'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import {
  type CalendarEvent,
  daysUntil,
  eventTypeLabel,
  eventTypeClass,
  eventBadgeLabel,
  eventRiskForTicker,
  macroEventMeta,
} from '@/lib/calendar';
import { DetailDrawer } from '@/components/DetailDrawer';

// Known exchanges for the demo tickers. Unknown tickers get 'US listing', not a
// guessed 'NASDAQ' - the old default asserted an exchange it had no basis for
// (wrong for any NYSE or ASX name outside this map).
const EXCHANGE: Record<string, string> = { CRM: 'NYSE', ORCL: 'NYSE', IBM: 'NYSE', NOW: 'NYSE' };
function exchangeFor(ticker: string): string {
  return EXCHANGE[ticker] ?? 'US listing';
}

/**
 * Calendar event explainer - right-slide drawer with what the event actually is:
 * type, exchange, timing, event risk, and (for earnings) the fundamentals shape that
 * fills in with live data next. Built on the reusable DetailDrawer.
 */
export function CalendarEventDrawer({
  event,
  signals,
  events,
  todayIso,
  onClose,
}: {
  event: CalendarEvent | null;
  signals: SignalRow[];
  /** The board's event set so the drawer's risk read matches it (live or sample). */
  events?: CalendarEvent[];
  /** The board's clock - without it the drawer disagrees with the agenda near UTC midnight. */
  todayIso?: string;
  onClose: () => void;
}) {
  if (!event) return null;

  const today = todayIso ? new Date(todayIso + 'T00:00:00Z') : new Date();
  const days = daysUntil(event.date, today);
  const when = days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`;
  const isEarnings = event.type === 'earnings';
  const macroMeta = macroEventMeta(event);

  const facts: Array<[string, string]> = [
    ['Date', event.date],
    // Seeded macro events know their announcement time; date-only events keep the countdown.
    ['When', macroMeta ? `${when} · ${macroMeta.timeLocal}` : when],
    ['Importance', event.importance],
    ['Type', eventTypeLabel(event.type)],
  ];

  return (
    <DetailDrawer
      open={!!event}
      onClose={onClose}
      title={event.title}
      subtitle={event.ticker ? `${event.ticker} · ${exchangeFor(event.ticker)}` : eventTypeLabel(event.type)}
      badge={
        <span className={`mb-1 inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${eventTypeClass(event.type)}`}>
          {eventBadgeLabel(event)}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[#1b2530]">
        {facts.map(([k, v]) => (
          <div className="bg-[#0d1117] p-2" key={k}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{k}</p>
            <p className="mt-0.5 truncate font-mono text-sm text-[#eef3f8] md:text-base">{v}</p>
          </div>
        ))}
      </div>

      {event.description && (
        <div className="rounded-md border border-[#263241] bg-[#0d141c] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">What this is</p>
          <p className="mt-1.5 text-xs leading-5 text-[#dbe5ee]">{event.description}</p>
        </div>
      )}

      {macroMeta && (
        <div className="rounded-md border border-[#263241] bg-[#0d141c] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Why it matters</p>
          <p className="mt-1.5 text-xs leading-5 text-[#a8b5c2]">{macroMeta.framing}</p>
          <p className="mt-2 text-[10px] leading-4 text-[#5e6b78]">Research, not advice.</p>
        </div>
      )}

      {event.ticker && (
        <div className="rounded-md border border-[#263241] bg-[#0d141c] p-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#eef3f8]">{event.ticker}</span>
            <span className="text-[#8190a0]">{exchangeFor(event.ticker)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[#8190a0]">Event risk</span>
            <span className="text-[#dbe5ee]">{eventRiskForTicker(event.ticker, signals, events, today)}</span>
          </div>
        </div>
      )}

      {isEarnings && (
        <div className="rounded-md border border-[#263241] bg-[#0d141c] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Earnings detail</p>
            <span className="rounded border border-[#9a6a1f] bg-[#2a1f0f] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#f3a33a]">Sample</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
            <span className="text-[#8190a0]">Reports</span>
            <span className="text-right text-[#dbe5ee]">After market close</span>
            <span className="text-[#8190a0]">Consensus EPS</span>
            <span className="text-right text-[#8190a0]">live next</span>
            <span className="text-[#8190a0]">Last quarter</span>
            <span className="text-right text-[#8190a0]">live next</span>
            <span className="text-[#8190a0]">Forecast</span>
            <span className="text-right text-[#8190a0]">live next</span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-[#5e6b78]">
            Consensus, last-quarter beat/miss and forecasts wire in with live fundamentals (Finnhub).
          </p>
        </div>
      )}

      {event.ticker && (
        <Link
          href={`/tickers/${event.ticker}`}
          className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8b5c2] transition hover:text-[#eef3f8]"
        >
          Open {event.ticker} <ArrowUpRight size={12} />
        </Link>
      )}

      {macroMeta && (
        <a
          href={macroMeta.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8b5c2] transition hover:text-[#eef3f8]"
        >
          {macroMeta.sourceLabel} <ArrowUpRight size={12} />
        </a>
      )}
    </DetailDrawer>
  );
}
