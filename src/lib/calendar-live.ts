/**
 * Server-side calendar reads: the Supabase `company_events` + `market_calendar_events`
 * tables (filled nightly by workers/events_worker) with the re-anchored sample set as
 * demo fallback. Same shape as ipos-live.ts and kept out of calendar.ts so that module
 * stays importable from client components.
 *
 * Fallback contract: unconfigured, empty tables, or any error degrades to the sample
 * set - never a throw to the page.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDemoCalendarEvents, type CalendarEvent, type EventImportance, type EventType } from '@/lib/calendar';

export interface CalendarDataset {
  events: CalendarEvent[];
  /** 'live' = rows from the nightly sync; 'sample' = bundled re-anchored seeds. */
  source: 'live' | 'sample';
  updatedAt: string | null;
}

interface EventRow {
  event_id?: string;
  event_date?: string;
  event_type?: string;
  ticker?: string | null;
  title?: string;
  description?: string | null;
  importance?: string;
  updated_at?: string | null;
}

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'earnings', 'ipo', 'product_launch', 'investor_day', 'conference', 'macro', 'options_expiry',
]);
const IMPORTANCE: ReadonlySet<string> = new Set(['high', 'medium', 'low']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapEventType(raw: string | undefined): EventType | null {
  if (!raw) return null;
  if (EVENT_TYPES.has(raw)) return raw as EventType;
  // Tolerated alias: schema comments describe 'economic_release' for scheduled data
  // prints (no writer emits it today) - render it as macro rather than dropping it.
  if (raw === 'economic_release') return 'macro';
  return null;
}

/** Map a table row to the frontend shape; null when required fields are missing/invalid. */
export function mapEventRow(row: EventRow): CalendarEvent | null {
  const type = mapEventType(row.event_type);
  if (!row.event_id || !row.title || !type) return null;
  if (!row.event_date || !ISO_DATE_RE.test(row.event_date)) return null;
  return {
    id: row.event_id,
    date: row.event_date,
    type,
    ticker: row.ticker ?? null,
    title: row.title,
    importance: (IMPORTANCE.has(row.importance ?? '') ? row.importance : 'medium') as EventImportance,
  };
}

interface IpoEventRow {
  symbol?: string;
  company_name?: string;
  ipo_date?: string;
  valuation_usd_m?: number | string | null;
  updated_at?: string | null;
}

/** IPO listings live in the `ipos` table, not company_events - synthesize their calendar entries. */
function mapIpoEventRow(row: IpoEventRow): CalendarEvent | null {
  if (!row.symbol || !row.company_name) return null;
  if (!row.ipo_date || !ISO_DATE_RE.test(row.ipo_date)) return null;
  const valuation = typeof row.valuation_usd_m === 'string' ? Number(row.valuation_usd_m) : (row.valuation_usd_m ?? 0);
  return {
    id: `ipo-${row.symbol}-${row.ipo_date}`,
    date: row.ipo_date,
    type: 'ipo',
    ticker: row.symbol,
    title: `${row.company_name} IPO (${row.symbol})`,
    importance: Number.isFinite(valuation) && (valuation as number) >= 10000 ? 'high' : 'medium',
  };
}

/**
 * All calendar events for the board: live tables when configured + populated,
 * re-anchored sample set otherwise. The window is BOUNDED [yesterday, +35d] with
 * generous row caps - the board renders 30 days, and an unbounded ascending select
 * against a whole-market earnings table would truncate to the first few days during
 * earnings season. IPO entries come from the `ipos` table (the worker writes IPOs
 * there, never to company_events), so live mode keeps the IPO event class the sample
 * set has. Rows are deduped by id across the three sources.
 */
export async function getCalendarEventsLive(now: Date = new Date()): Promise<CalendarDataset> {
  const sample: CalendarDataset = { events: getDemoCalendarEvents(now), source: 'sample', updatedAt: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return sample;

  try {
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [company, market, ipos] = await Promise.all([
      supabase.from('company_events').select('*').gte('event_date', from).lte('event_date', to).order('event_date').limit(1000),
      // No writer fills this table yet (the worker upserts only company_events) - kept
      // because the schema ships it and a future macro provider lands here for free.
      supabase.from('market_calendar_events').select('*').gte('event_date', from).lte('event_date', to).order('event_date').limit(500),
      supabase.from('ipos').select('symbol, company_name, ipo_date, valuation_usd_m, updated_at').gte('ipo_date', from).lte('ipo_date', to).limit(200),
    ]);
    if (company.error || market.error) return sample;

    const rows = [...((company.data ?? []) as EventRow[]), ...((market.data ?? []) as EventRow[])];
    const mapped = rows.map(mapEventRow).filter((e): e is CalendarEvent => e !== null);
    // IPO read failure only loses the IPO class, never the whole live board.
    const ipoEvents = ipos.error
      ? []
      : ((ipos.data ?? []) as IpoEventRow[]).map(mapIpoEventRow).filter((e): e is CalendarEvent => e !== null);
    if (mapped.length === 0 && ipoEvents.length === 0) return sample;

    const deduped = [...new Map([...mapped, ...ipoEvents].map((e) => [e.id, e])).values()];
    const updatedAt =
      [...rows, ...(ipos.error ? [] : ((ipos.data ?? []) as IpoEventRow[]))]
        .map((r) => r.updated_at ?? '')
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return {
      events: deduped.sort((a, b) => a.date.localeCompare(b.date)),
      source: 'live',
      updatedAt,
    };
  } catch {
    return sample;
  }
}
