'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, X } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import {
  demoCalendarEvents,
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

interface CalendarViewProps {
  signals: SignalRow[];
}

export function CalendarView({ signals }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showPortfolioOnly, setShowPortfolioOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Get portfolio symbols from signals for "my portfolio" context
  const portfolioSymbols = new Set(signals.map((s) => s.symbol));

  // Filter events based on active filters
  const filteredEvents = demoCalendarEvents.filter((event) => {
    // Filter by type if selected
    if (filterType && event.type !== filterType) {
      return false;
    }

    // Filter by portfolio only
    if (showPortfolioOnly && event.ticker !== null && !portfolioSymbols.has(event.ticker)) {
      return false;
    }

    // Include future and today
    const days = daysUntil(event.date);
    return days >= 0 && days <= 29;
  });

  // Find tickers with elevated event risk
  const elevatedRiskTickers = signals
    .filter((signal) => {
      const risk = eventRiskForTicker(signal.symbol, signals);
      return risk === 'elevated' || risk === 'moderate';
    })
    .sort((a, b) => {
      const riskA = eventRiskForTicker(a.symbol, signals);
      const riskB = eventRiskForTicker(b.symbol, signals);
      // Sort "elevated" first, then "moderate"
      if (riskA === 'elevated' && riskB !== 'elevated') return -1;
      if (riskA !== 'elevated' && riskB === 'elevated') return 1;
      return a.symbol.localeCompare(b.symbol);
    });

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Event Risk Callout */}
      {elevatedRiskTickers.length > 0 && (
        <section className="terminal-panel rounded-md border-l-4 border-[#ff6b6b] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ff6b6b]">⚠ Event Risk Alert</h2>
          <p className="mt-2 text-xs text-[#a8b5c2]">
            {elevatedRiskTickers.length} ticker
            {elevatedRiskTickers.length !== 1 ? 's have' : ' has'} active signals with upcoming high-importance
            events within 7 days.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {elevatedRiskTickers.map((signal) => {
              const risk = eventRiskForTicker(signal.symbol, signals);
              const upcomingEvent = demoCalendarEvents.find(
                (e) =>
                  e.ticker === signal.symbol &&
                  daysUntil(e.date) >= 0 &&
                  daysUntil(e.date) <= 7 &&
                  e.importance === 'high',
              );
              const days = upcomingEvent ? daysUntil(upcomingEvent.date) : null;

              return (
                <div
                  key={signal.symbol}
                  className={`rounded-md border px-3 py-1 font-mono text-xs ${eventRiskClass(risk)}`}
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
      <section className="terminal-panel rounded-md p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'agenda' ? 'month' : 'agenda')}
              className="inline-flex items-center gap-2 rounded-md border border-[#263241] bg-[#0d141c] px-3 py-1 font-mono text-xs text-[#a8b5c2] transition hover:border-[#f3a33a] hover:text-[#f3a33a]"
            >
              {viewMode === 'agenda' ? 'Month View' : 'Agenda View'}
            </button>

            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="rounded-md border border-[#263241] bg-[#0d141c] px-3 py-1 font-mono text-xs text-[#a8b5c2] transition hover:border-[#f3a33a] hover:text-[#f3a33a]"
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
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 font-mono text-xs transition ${
                showPortfolioOnly
                  ? 'border-[#43d18b] bg-[#0d251b] text-[#43d18b]'
                  : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#43d18b] hover:text-[#43d18b]'
              }`}
            >
              {showPortfolioOnly ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="hidden sm:inline">My Events</span>
            </button>
          </div>

          <div className="text-xs text-[#8190a0]">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} upcoming
          </div>
        </div>
      </section>

      {/* Agenda View */}
      {viewMode === 'agenda' && (
        <section className="terminal-panel rounded-md overflow-hidden">
          <div className="border-b border-[#1b2530] px-3 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Event Agenda</h2>
            <p className="mt-1 font-mono text-xs text-[#8190a0]">Grouped by date. Future events next 30 days.</p>
          </div>

          <div className="divide-y divide-[#1b2530]">
            {groupEventsByDate(filteredEvents).length === 0 ? (
              <div className="px-3 py-4">
                <p className="text-xs text-[#8190a0]">No events match filters.</p>
              </div>
            ) : (
              groupEventsByDate(filteredEvents).map(({ date, events }) => {
                const days = daysUntil(date);
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
                    <div className="flex items-center justify-between border-b border-[#263241] bg-[#0b1016] px-3 py-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#eef3f8]">{dayLabel}</p>
                        <p className="text-xs text-[#8190a0]">{date}</p>
                      </div>
                      <div className="font-mono text-xs text-[#a8b5c2]">
                        {events.length} event{events.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="divide-y divide-[#1b2530]">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className={`flex w-full flex-col gap-2 border-l-2 px-3 py-3 text-left transition hover:bg-[#101720] sm:flex-row sm:items-start sm:justify-between ${eventTypeClass(event.type).split(' ')[0]}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <div className={`rounded-md border px-2 py-1 font-mono text-xs font-semibold ${eventTypeClass(event.type)}`}>
                                {eventBadgeLabel(event)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#eef3f8]">{event.title}</p>
                                <p className="text-xs text-[#8190a0]">{eventTypeLabel(event.type)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            <div className={`rounded-md border px-2 py-1 font-mono text-xs font-semibold ${importanceClass(event.importance)}`}>
                              {event.importance}
                            </div>
                            <div className="font-mono text-xs text-[#a8b5c2]">in {days}d</div>
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
      {viewMode === 'month' && <MonthCalendar events={filteredEvents} />}

      {/* Event detail drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[400px] flex-col overflow-y-auto border-l border-[#1b2530] bg-[#0b1016] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[#1b2530] bg-[#0b1016]/95 px-4 py-3 backdrop-blur">
              <div className={`rounded-md border px-2 py-1 font-mono text-xs font-semibold ${eventTypeClass(selectedEvent.type)}`}>
                {eventBadgeLabel(selectedEvent)}
              </div>
              <button onClick={() => setSelectedEvent(null)} className="grid h-8 w-8 place-items-center rounded border border-[#263241] text-[#8190a0] transition hover:text-[#eef3f8]" type="button" aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div>
                <p className="text-base font-semibold text-[#eef3f8]">{selectedEvent.title}</p>
                <p className="mt-1 font-mono text-xs text-[#8190a0]">{eventTypeLabel(selectedEvent.type)}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
                <span className="text-[#8190a0]">Date</span>
                <span className="text-right text-[#dbe5ee]">{selectedEvent.date}</span>
                <span className="text-[#8190a0]">In</span>
                <span className="text-right text-[#dbe5ee]">{daysUntil(selectedEvent.date)} days</span>
                <span className="text-[#8190a0]">Importance</span>
                <span className="text-right text-[#dbe5ee]">{selectedEvent.importance}</span>
                {selectedEvent.ticker && (<>
                  <span className="text-[#8190a0]">Ticker</span>
                  <span className="text-right text-[#dbe5ee]">{selectedEvent.ticker}</span>
                  <span className="text-[#8190a0]">Event risk</span>
                  <span className="text-right text-[#dbe5ee]">{eventRiskForTicker(selectedEvent.ticker, signals)}</span>
                </>)}
              </div>
              {selectedEvent.ticker && (
                <Link href={`/tickers/${selectedEvent.ticker}`} className="inline-flex rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8b5c2] transition hover:text-[#eef3f8]">
                  Open ticker
                </Link>
              )}
              {selectedEvent.type === 'ipo' && (
                <Link href="/ipos" className="inline-flex rounded border border-[#3b3050] bg-[#15101f] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a78bfa] transition hover:bg-[#1b1330]">
                  Open IPO radar
                </Link>
              )}
              <p className="text-[10px] leading-4 text-[#8190a0]">
                A signal before an event carries different risk than the same signal after it. Research context only - not financial advice.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/**
 * Simple month grid with event dots.
 */
function MonthCalendar({ events }: { events: typeof demoCalendarEvents }) {
  const today = new Date('2026-06-03T00:00:00Z');
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Get all days in the current month
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
    <section className="terminal-panel rounded-md overflow-hidden">
      <div className="border-b border-[#1b2530] px-3 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Calendar Grid</h2>
        <p className="mt-1 font-mono text-xs text-[#8190a0]">{monthLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-[#0b1016] font-mono text-[#8190a0]">
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <th key={day} className="border-b border-[#1b2530] px-2 py-2 font-semibold">
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
                    const isToday = day === today.getDate() && currentMonth === today.getMonth();

                    return (
                      <td
                        key={dayIndex}
                        className={`border border-[#263241] px-2 py-2 align-top ${
                          day === null ? 'bg-[#0b1016]' : isToday ? 'bg-[#0d251b]' : 'bg-[#0d141c]'
                        }`}
                      >
                        {day && (
                          <div>
                            <div className={`font-mono font-semibold ${isToday ? 'text-[#43d18b]' : 'text-[#eef3f8]'}`}>
                              {day}
                            </div>
                            {dayEvents && dayEvents.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {dayEvents.slice(0, 2).map((event) => (
                                  <div
                                    key={event.id}
                                    className={`flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[10px] font-semibold ${eventTypeClass(event.type)}`}
                                    title={`${event.title} - ${eventTypeLabel(event.type)}`}
                                  >
                                    <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${eventTypeDot(event.type)}`} />
                                    {eventBadgeLabel(event)}
                                  </div>
                                ))}
                                {dayEvents.length > 2 && (
                                  <div className="text-[10px] text-[#8190a0]">+{dayEvents.length - 2} more</div>
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
