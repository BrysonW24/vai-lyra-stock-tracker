import type { SignalRow } from '@/types/scanner';

export type EventType = 'earnings' | 'ipo' | 'product_launch' | 'investor_day' | 'conference' | 'macro' | 'options_expiry';
export type EventImportance = 'high' | 'medium' | 'low';
export type EventRisk = 'elevated' | 'moderate' | 'low';

export interface CalendarEvent {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  type: EventType;
  ticker: string | null; // null for MACRO events
  title: string;
  importance: EventImportance;
}

/** The date the sample event set was authored around - anchorCalendarEvents shifts from here. */
export const DEMO_ANCHOR_ISO = '2026-06-03';

/**
 * Deterministic demo event seeds spanning ~30 days from the authoring anchor.
 * Two kinds: company events (tagged to ticker) and macro events (tagged 'MACRO').
 * Each event is either high-, medium-, or low-importance.
 *
 * Rule: Event risk is "elevated" when a ticker has a strong_setup or watchlist_setup signal
 * AND a high-importance event is within 7 days.
 */
const DEMO_EVENT_SEEDS: CalendarEvent[] = [
  // This week (June 3-9, 2026)
  {
    id: 'macro-fomc-20260604',
    date: '2026-06-04',
    type: 'macro',
    ticker: null,
    title: 'FOMC Interest Rate Decision',
    importance: 'high',
  },
  {
    id: 'earnings-nvda-20260605',
    date: '2026-06-05',
    type: 'earnings',
    ticker: 'NVDA',
    title: 'Nvidia Q1 FY2027 Earnings',
    importance: 'high',
  },
  {
    id: 'earnings-amd-20260606',
    date: '2026-06-06',
    type: 'earnings',
    ticker: 'AMD',
    title: 'AMD Q1 2026 Earnings',
    importance: 'high',
  },
  {
    id: 'earnings-crm-20260606',
    date: '2026-06-06',
    type: 'earnings',
    ticker: 'CRM',
    title: 'Salesforce Q1 FY2027 Earnings',
    importance: 'high',
  },
  {
    id: 'macro-cpi-20260609',
    date: '2026-06-09',
    type: 'macro',
    ticker: null,
    title: 'US CPI Release',
    importance: 'high',
  },

  // Following week (June 10-16)
  {
    id: 'earnings-msft-20260610',
    date: '2026-06-10',
    type: 'earnings',
    ticker: 'MSFT',
    title: 'Microsoft Q4 FY2026 Earnings',
    importance: 'high',
  },
  {
    id: 'earnings-aapl-20260611',
    date: '2026-06-11',
    type: 'earnings',
    ticker: 'AAPL',
    title: 'Apple Q3 FY2026 Earnings',
    importance: 'high',
  },
  {
    id: 'conference-computex-20260610',
    date: '2026-06-10',
    type: 'conference',
    ticker: 'NVDA',
    title: 'Computex Conference (NVDA keynote)',
    importance: 'medium',
  },
  {
    id: 'earnings-adbe-20260612',
    date: '2026-06-12',
    type: 'earnings',
    ticker: 'ADBE',
    title: 'Adobe Q2 FY2026 Earnings',
    importance: 'high',
  },
  {
    id: 'macro-nfp-20260613',
    date: '2026-06-13',
    type: 'macro',
    ticker: null,
    title: 'US Jobs Report (NFP)',
    importance: 'high',
  },
  {
    id: 'earnings-snow-20260613',
    date: '2026-06-13',
    type: 'earnings',
    ticker: 'SNOW',
    title: 'Snowflake Q1 FY2027 Earnings',
    importance: 'high',
  },
  {
    id: 'earnings-now-20260615',
    date: '2026-06-15',
    type: 'earnings',
    ticker: 'NOW',
    title: 'ServiceNow Q1 2026 Earnings',
    importance: 'medium',
  },

  // Third week (June 17-23)
  {
    id: 'product-launch-panw-20260617',
    date: '2026-06-17',
    type: 'product_launch',
    ticker: 'PANW',
    title: 'Palo Alto Networks Next Gen Security Announcement',
    importance: 'medium',
  },
  {
    id: 'earnings-crwd-20260618',
    date: '2026-06-18',
    type: 'earnings',
    ticker: 'CRWD',
    title: 'CrowdStrike Q1 2026 Earnings',
    importance: 'high',
  },
  {
    id: 'macro-options-expiry-20260620',
    date: '2026-06-20',
    type: 'options_expiry',
    ticker: null,
    title: 'June Monthly Options Expiry',
    importance: 'medium',
  },
  {
    id: 'earnings-ddog-20260619',
    date: '2026-06-19',
    type: 'earnings',
    ticker: 'DDOG',
    title: 'Datadog Q1 2026 Earnings',
    importance: 'medium',
  },
  {
    id: 'earnings-avgo-20260620',
    date: '2026-06-20',
    type: 'earnings',
    ticker: 'AVGO',
    title: 'Broadcom Q2 FY2026 Earnings',
    importance: 'high',
  },
  {
    id: 'investor-day-msft-20260621',
    date: '2026-06-21',
    type: 'investor_day',
    ticker: 'MSFT',
    title: 'Microsoft Investor Day',
    importance: 'medium',
  },

  // IPO calendar events (colour-coded distinctly). Demo listings within the window.
  {
    id: 'ipo-helios-20260605',
    date: '2026-06-05',
    type: 'ipo',
    ticker: null,
    title: 'Helios Compute IPO prices (demo)',
    importance: 'medium',
  },
  {
    id: 'ipo-bluewave-20260612',
    date: '2026-06-12',
    type: 'ipo',
    ticker: null,
    title: 'BlueWave AI IPO debut (demo)',
    importance: 'high',
  },
  {
    id: 'ipo-northstar-20260619',
    date: '2026-06-19',
    type: 'ipo',
    ticker: null,
    title: 'NorthStar Robotics IPO (demo)',
    importance: 'medium',
  },
  {
    id: 'ipo-quantic-lockup-20260624',
    date: '2026-06-24',
    type: 'ipo',
    ticker: null,
    title: 'Quantic lock-up expiry (demo)',
    importance: 'low',
  },

  // Fourth week (June 24-30)
  {
    id: 'macro-fomc-minutes-20260625',
    date: '2026-06-25',
    type: 'macro',
    ticker: null,
    title: 'FOMC Meeting Minutes',
    importance: 'medium',
  },
  {
    id: 'conference-tesla-ai-20260626',
    date: '2026-06-26',
    type: 'conference',
    ticker: null,
    title: 'Tesla AI Day (hypothetical)',
    importance: 'medium',
  },
  {
    id: 'macro-cpi-final-20260628',
    date: '2026-06-28',
    type: 'macro',
    ticker: null,
    title: 'Core CPI Final Reading',
    importance: 'low',
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Shift a set of events so the authoring anchor lands on `todayIso`, preserving the
 * relative spacing between events. This is how the SAMPLE calendar stays a calendar:
 * without it the seeds age out and every surface reads "43d ago" forever. Pure.
 */
export function anchorCalendarEvents(events: CalendarEvent[], anchorIso: string, todayIso: string): CalendarEvent[] {
  const shiftDays = Math.round(
    (new Date(todayIso + 'T00:00:00Z').getTime() - new Date(anchorIso + 'T00:00:00Z').getTime()) / DAY_MS,
  );
  if (shiftDays === 0) return events;
  return events.map((event) => ({
    ...event,
    date: isoDay(new Date(new Date(event.date + 'T00:00:00Z').getTime() + shiftDays * DAY_MS)),
  }));
}

/**
 * The sample events, re-anchored so "today" always sits at the start of the window.
 * A GETTER, deliberately not a module-level const: a const anchors once at process
 * start, so a long-lived server (Coolify/Docker demo deploy) would watch the sample
 * window slide into the past and the board empty - the exact age-out bug the anchor
 * exists to fix. Call it per request/render.
 */
export function getDemoCalendarEvents(now: Date = new Date()): CalendarEvent[] {
  return anchorCalendarEvents(DEMO_EVENT_SEEDS, DEMO_ANCHOR_ISO, isoDay(now));
}

/**
 * Calendar days until a given ISO date. Today by default - the old hardcoded
 * 2026-06-03 "today" froze every countdown in the app at authoring time.
 */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const todayUtc = new Date(isoDay(today) + 'T00:00:00Z');
  const target = new Date(isoDate + 'T00:00:00Z');
  return Math.ceil((target.getTime() - todayUtc.getTime()) / DAY_MS);
}

/**
 * Determine event risk level for a ticker.
 * Rule: "elevated" when the ticker has a strong_setup or watchlist_setup signal
 * AND a high-importance event is within 7 days.
 * Otherwise "moderate" if medium-importance event within 7 days, or "low".
 */
export function eventRiskForTicker(
  ticker: string,
  signals: SignalRow[],
  events?: CalendarEvent[],
  today: Date = new Date(),
): EventRisk {
  const pool = events ?? getDemoCalendarEvents(today);
  const signal = signals.find((s) => s.symbol === ticker);

  // Only consider tickers with strong or watchlist setups
  if (!signal || (signal.status !== 'strong_setup' && signal.status !== 'watchlist_setup')) {
    return 'low';
  }

  // Find upcoming events for this ticker
  const upcomingEvents = pool.filter(
    (event) => event.ticker === ticker && daysUntil(event.date, today) >= 0 && daysUntil(event.date, today) <= 7,
  );

  // Check if any high-importance event within 7 days
  if (upcomingEvents.some((e) => e.importance === 'high')) {
    return 'elevated';
  }

  // Check if any medium-importance event within 7 days
  if (upcomingEvents.some((e) => e.importance === 'medium')) {
    return 'moderate';
  }

  return 'low';
}

/**
 * Group events by date (YYYY-MM-DD).
 * Returns array of { date, events } tuples.
 */
export function groupEventsByDate(events: CalendarEvent[]): Array<{ date: string; events: CalendarEvent[] }> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    if (!grouped.has(event.date)) {
      grouped.set(event.date, []);
    }
    grouped.get(event.date)!.push(event);
  }

  // Sort by date and return
  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, events]) => ({ date, events }));
}

/**
 * Get a human-readable label for event type.
 */
export function eventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    earnings: 'Earnings',
    ipo: 'IPO',
    product_launch: 'Product Launch',
    investor_day: 'Investor Day',
    conference: 'Conference',
    macro: 'Macro Event',
    options_expiry: 'Options Expiry',
  };
  return labels[type];
}

/**
 * Per-type colour class (border + bg + text) for colour-coding the calendar.
 * Distinct hue per event type so the agenda and grid are scannable at a glance.
 */
export function eventTypeClass(type: EventType): string {
  const classes: Record<EventType, string> = {
    earnings: 'border-[#3b5bdb] bg-[#0d1530] text-[#8aa2ff]',
    ipo: 'border-[#7c3aed] bg-[#160f24] text-[#a78bfa]',
    product_launch: 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]',
    investor_day: 'border-[#854d0e] bg-[#2a1f0f] text-[#f8c46b]',
    conference: 'border-[#0e7490] bg-[#08222a] text-[#4fd1d9]',
    macro: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
    options_expiry: 'border-[#475569] bg-[#11161d] text-[#94a3b8]',
  };
  return classes[type];
}

/** Solid dot colour per type for the month grid. */
export function eventTypeDot(type: EventType): string {
  const dots: Record<EventType, string> = {
    earnings: 'bg-[#8aa2ff]',
    ipo: 'bg-[#a78bfa]',
    product_launch: 'bg-[#43d18b]',
    investor_day: 'bg-[#f8c46b]',
    conference: 'bg-[#4fd1d9]',
    macro: 'bg-[#f3a33a]',
    options_expiry: 'bg-[#94a3b8]',
  };
  return dots[type];
}

/** Short badge label: ticker when present, else a type-based code. */
export function eventBadgeLabel(event: CalendarEvent): string {
  if (event.ticker) return event.ticker;
  const codes: Record<EventType, string> = {
    earnings: 'EARN',
    ipo: 'IPO',
    product_launch: 'LAUNCH',
    investor_day: 'INVDAY',
    conference: 'CONF',
    macro: 'MACRO',
    options_expiry: 'OPEX',
  };
  return codes[event.type];
}

/**
 * Get a tailwind colour class for importance badge.
 */
export function importanceClass(importance: EventImportance): string {
  const classes: Record<EventImportance, string> = {
    high: 'bg-[#7f1d1d] text-[#ff6b6b]',
    medium: 'bg-[#2a1f0f] text-[#f8c46b]',
    low: 'bg-[#0d2115] text-[#8190a0]',
  };
  return classes[importance];
}

/**
 * Get a tailwind colour class for event risk badge.
 */
export function eventRiskClass(risk: EventRisk): string {
  const classes: Record<EventRisk, string> = {
    elevated: 'bg-[#7f1d1d] text-[#ff6b6b]',
    moderate: 'bg-[#2a1f0f] text-[#f8c46b]',
    low: 'bg-[#0d2115] text-[#8190a0]',
  };
  return classes[risk];
}
