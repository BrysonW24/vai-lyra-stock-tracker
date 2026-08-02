'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import {
  daysUntil,
  eventRiskForTicker,
  eventTypeLabel,
  eventTypeClass,
  eventTypeDot,
  eventBadgeLabel,
  importanceClass,
  eventRiskClass,
  groupEventsByDate,
  type CalendarEvent,
} from '@/lib/calendar';
import { CalendarEventDrawer } from '@/components/calendar/CalendarEventDrawer';

interface CalendarViewProps {
  signals: SignalRow[];
  /** Server-fetched set: live nightly-synced tables when configured, re-anchored sample otherwise. */
  events: CalendarEvent[];
  source: 'live' | 'sample';
  /** Server-computed ISO day so SSR and hydration agree on what "today" is. */
  todayIso: string;
}

export function CalendarView({ signals, events: allEvents, source, todayIso }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showPortfolioOnly, setShowPortfolioOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const today = new Date(todayIso + 'T00:00:00Z');

  // Get portfolio symbols from signals for "my portfolio" context
  const portfolioSymbols = new Set(signals.map((s) => s.symbol));

  // Filter events based on active filters
  const filteredEvents = allEvents.filter((event) => {
    // Filter by type if selected
    if (filterType && event.type !== filterType) {
      return false;
    }

    // Filter by portfolio only
    if (showPortfolioOnly && event.ticker !== null && !portfolioSymbols.has(event.ticker)) {
      return false;
    }

    // Include future and today
    const days = daysUntil(event.date, today);
    return days >= 0 && days <= 29;
  });

  // Find tickers with elevated event risk
  const elevatedRiskTickers = signals
    .filter((signal) => {
      const risk = eventRiskForTicker(signal.symbol, signals, allEvents, today);
      return risk === 'elevated' || risk === 'moderate';
    })
    .sort((a, b) => {
      const riskA = eventRiskForTicker(a.symbol, signals, allEvents, today);
      const riskB = eventRiskForTicker(b.symbol, signals, allEvents, today);
      // Sort "elevated" first, then "moderate"
      if (riskA === 'elevated' && riskB !== 'elevated') return -1;
      if (riskA !== 'elevated' && riskB === 'elevated') return 1;
      return a.symbol.localeCompare(b.symbol);
    });

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Event Risk Callout */}
      {elevatedRiskTickers.length > 0 && (
        <section className="terminal-panel rounded-panel border-l-4 border-negative p-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-negative">⚠ Event Risk Alert</h2>
          <p className="mt-2 text-xs text-ink-2">
            {elevatedRiskTickers.length} ticker
            {elevatedRiskTickers.length !== 1 ? 's have' : ' has'} active signals with upcoming high-importance
            events within 7 days.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {elevatedRiskTickers.map((signal) => {
              const risk = eventRiskForTicker(signal.symbol, signals, allEvents, today);
              const upcomingEvent = allEvents.find(
                (e) =>
                  e.ticker === signal.symbol &&
                  daysUntil(e.date, today) >= 0 &&
                  daysUntil(e.date, today) <= 7 &&
                  e.importance === 'high',
              );
              const days = upcomingEvent ? daysUntil(upcomingEvent.date, today) : null;

              return (
                <div
                  key={signal.symbol}
                  className={`rounded-cell border px-3 py-1 font-mono text-xs ${eventRiskClass(risk)}`}
                >
                  <span className="font-semibold">{signal.symbol}</span>
                  {days !== null && <span className="ml-2 text-[10px] opacity-80">in {days}d</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Controls */}
      <section className="terminal-panel rounded-panel p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'agenda' ? 'month' : 'agenda')}
              className="inline-flex items-center gap-2 rounded-cell border border-line-strong bg-panel px-3 py-1 font-mono text-xs text-ink-2 transition hover:border-accent hover:text-accent"
            >
              {viewMode === 'agenda' ? 'Month View' : 'Agenda View'}
            </button>

            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="rounded-cell border border-line-strong bg-panel px-3 py-1 font-mono text-xs text-ink-2 transition hover:border-accent hover:text-accent"
            >
              <option value="">All event types</option>
              <option value="earnings">Earnings</option>
              <option value="ipo">IPOs</option>
              <option value="macro">Macro Events</option>
              <option value="conference">Conferences</option>
              <option value="product_launch">Product Launches</option>
              <option value="investor_day">Investor Days</option>
              <option value="options_expiry">Options Expiry</option>
            </select>

            <button
              onClick={() => setShowPortfolioOnly(!showPortfolioOnly)}
              className={`inline-flex items-center gap-2 rounded-cell border px-3 py-1 font-mono text-xs transition ${
                showPortfolioOnly
                  ? 'border-accent-border bg-accent-tint text-accent'
                  : 'border-line-strong bg-panel text-ink-2 hover:border-accent hover:text-accent'
              }`}
            >
              {showPortfolioOnly ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="hidden sm:inline">My Events</span>
            </button>
          </div>

          <div className="text-right text-xs text-ink-3">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} upcoming
            <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">
              {source === 'live' ? 'Live - synced nightly' : 'Sample set - live sync lights up with Supabase + Finnhub'}
            </span>
          </div>
        </div>
      </section>

      {/* Agenda View */}
      {viewMode === 'agenda' && (
        <section className="terminal-panel rounded-panel overflow-hidden">
          <div className="border-b border-line px-3 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Event Agenda</h2>
            <p className="mt-1 font-mono text-xs text-ink-3">Grouped by date. Future events next 30 days.</p>
          </div>

          <div className="divide-y divide-line">
            {groupEventsByDate(filteredEvents).length === 0 ? (
              <div className="px-3 py-4">
                <p className="text-xs text-ink-3">No events match filters.</p>
              </div>
            ) : (
              groupEventsByDate(filteredEvents).map(({ date, events }) => {
                const days = daysUntil(date, today);
                const dayLabel =
                  days === 0
                    ? 'Today'
                    : days === 1
                      ? 'Tomorrow'
                      : new Date(date + 'T00:00:00Z').toLocaleDateString('en-AU', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        });

                return (
                  <div key={date}>
                    <div className="flex items-center justify-between border-b border-line-strong bg-chrome px-3 py-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-ink">{dayLabel}</p>
                        <p className="text-xs text-ink-3">{date}</p>
                      </div>
                      <div className="font-mono text-xs text-ink-2">
                        {events.length} event{events.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="divide-y divide-line">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className={`flex w-full flex-col gap-1.5 border-l-2 px-3 py-2 text-left transition hover:bg-line/30 sm:flex-row sm:items-start sm:justify-between ${eventTypeClass(event.type).split(' ')[0]}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <div className={`rounded-cell border px-2 py-1 font-mono text-xs font-semibold ${eventTypeClass(event.type)}`}>
                                {eventBadgeLabel(event)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium leading-snug text-ink">{event.title}</p>
                                <p className="text-[11px] text-ink-3">{eventTypeLabel(event.type)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            <div className={`rounded-cell border px-2 py-1 font-mono text-xs font-semibold ${importanceClass(event.importance)}`}>
                              {event.importance}
                            </div>
                            <div className="font-mono text-xs text-ink-2">in {days}d</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Month View */}
      {viewMode === 'month' && <MonthCalendar events={filteredEvents} todayIso={todayIso} onSelectEvent={setSelectedEvent} />}


      {/* Event detail drawer (reusable right-slide explainer) */}
      <CalendarEventDrawer event={selectedEvent} signals={signals} events={allEvents} todayIso={todayIso} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

/**
 * Simple month grid with event dots.
 */
function MonthCalendar({
  events,
  todayIso,
  onSelectEvent,
}: {
  events: CalendarEvent[];
  todayIso: string;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const MIN_OFFSET = 0;
  const MAX_OFFSET = 6; // current month plus six forward
  const [monthOffset, setMonthOffset] = useState(0);

  // Parse the ISO day into LOCAL year/month/day components: local getters on a
  // UTC-midnight instant put the today-highlight on yesterday's cell for every user
  // west of UTC, contradicting the agenda's 'Today' label on the same page.
  const [todayYear, todayMonthOneBased, todayDay] = todayIso.split('-').map(Number);
  const viewDate = new Date(todayYear, todayMonthOneBased - 1 + monthOffset, 1);
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Get all days in the displayed month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday

  // Create event map by date
  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const key = event.date;
    if (!eventsByDate.has(key)) {
      eventsByDate.set(key, []);
    }
    eventsByDate.get(key)!.push(event);
  }

  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  });

  const days: (number | null)[] = Array(firstDayOfMonth).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <section className="terminal-panel rounded-panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Calendar grid</h2>
          <p className="mt-0.5 font-mono text-xs text-ink-3">{monthLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMonthOffset((o) => Math.max(MIN_OFFSET, o - 1))}
            disabled={monthOffset <= MIN_OFFSET}
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-cell border border-line-strong bg-panel text-ink-2 transition hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((o) => Math.min(MAX_OFFSET, o + 1))}
            disabled={monthOffset >= MAX_OFFSET}
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-cell border border-line-strong bg-panel text-ink-2 transition hover:text-ink disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-chrome font-mono text-ink-3">
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <th key={day} className="border-b border-line px-2 py-2 font-semibold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array(Math.ceil(days.length / 7))
              .fill(null)
              .map((_, weekIndex) => (
                <tr key={weekIndex}>
                  {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                    const dateStr =
                      day === null
                        ? null
                        : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEvents = dateStr ? eventsByDate.get(dateStr) : undefined;
                    const isToday =
                      day === todayDay && currentMonth === todayMonthOneBased - 1 && currentYear === todayYear;

                    return (
                      <td
                        key={dayIndex}
                        className={`border border-line-strong px-2 py-2 align-top ${
                          day === null ? 'bg-chrome' : isToday ? 'bg-positive-tint' : 'bg-panel'
                        }`}
                      >
                        {day && (
                          <div>
                            <div className={`font-mono font-semibold ${isToday ? 'text-positive' : 'text-ink'}`}>
                              {day}
                            </div>
                            {dayEvents && dayEvents.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {dayEvents.slice(0, 2).map((event) => (
                                  <button
                                    type="button"
                                    key={event.id}
                                    onClick={() => onSelectEvent(event)}
                                    className={`flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[10px] font-semibold transition hover:brightness-125 ${eventTypeClass(event.type)}`}
                                    title={`${event.title} - ${eventTypeLabel(event.type)}`}
                                  >
                                    <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${eventTypeDot(event.type)}`} />
                                    {eventBadgeLabel(event)}
                                  </button>
                                ))}
                                {dayEvents.length > 2 && (
                                  <div className="text-[10px] text-ink-3">+{dayEvents.length - 2} more</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
