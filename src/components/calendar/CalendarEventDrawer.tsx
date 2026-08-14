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
        <span className={`mb-1 inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${eventTypeClass(event.type)}`}>
          {eventBadgeLabel(event)}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-cell bg-line">
        {facts.map(([k, v]) => (
          <div className="bg-panel-deep p-2" key={k}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{k}</p>
            <p className="mt-0.5 truncate font-mono text-sm text-ink md:text-base">{v}</p>
          </div>
        ))}
      </div>

      {event.description && (
        <div className="rounded-cell border border-line-strong bg-panel p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">What this is</p>
          <p className="mt-1.5 text-xs leading-5 text-ink-title">{event.description}</p>
        </div>
      )}

      {macroMeta && (
        <div className="rounded-cell border border-line-strong bg-panel p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Why it matters</p>
          <p className="mt-1.5 text-xs leading-5 text-ink-2">{macroMeta.framing}</p>
          <p className="mt-2 text-[10px] leading-4 text-ink-dim">Research, not advice.</p>
        </div>
      )}

      {event.ticker && (
        <div className="rounded-cell border border-line-strong bg-panel p-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink">{event.ticker}</span>
            <span className="text-ink-3">{exchangeFor(event.ticker)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ink-3">Event risk</span>
            <span className="text-ink-title">{eventRiskForTicker(event.ticker, signals, events, today)}</span>
          </div>
        </div>
      )}

      {isEarnings && (
        <div className="rounded-cell border border-line-strong bg-panel p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Earnings detail</p>
            <span className="rounded-full border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">Sample</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
            {/* Timing is not asserted until the live earnings feed carries it - "After market
                close" was an invented per-event fact, wrong for pre-market reporters (2026-08-11). */}
            <span className="text-ink-3">Reports</span>
            <span className="text-right text-ink-3">live next</span>
            <span className="text-ink-3">Consensus EPS</span>
            <span className="text-right text-ink-3">live next</span>
            <span className="text-ink-3">Last quarter</span>
            <span className="text-right text-ink-3">live next</span>
            <span className="text-ink-3">Forecast</span>
            <span className="text-right text-ink-3">live next</span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-ink-dim">
            Consensus, last-quarter beat/miss and forecasts wire in with live fundamentals (Finnhub).
          </p>
        </div>
      )}

      {event.ticker && (
        <Link
          href={`/tickers/${event.ticker}`}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-cell border border-line-strong bg-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2 transition hover:text-ink"
        >
          Open {event.ticker} <ArrowUpRight size={12} />
        </Link>
      )}

      {macroMeta && (
        <a
          href={macroMeta.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-cell border border-line-strong bg-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2 transition hover:text-ink"
        >
          {macroMeta.sourceLabel} <ArrowUpRight size={12} />
        </a>
      )}
    </DetailDrawer>
  );
}
