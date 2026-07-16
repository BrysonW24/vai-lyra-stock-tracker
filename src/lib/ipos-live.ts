/**
 * Server-side IPO reads: the Supabase `ipos` table (filled nightly by
 * workers/events_worker from the Finnhub IPO calendar) with the static editorial
 * seed as demo fallback. Kept out of ipos.ts so that module stays importable from
 * client components - this one touches next/headers via the server client.
 *
 * Fallback contract (same shape as the data libs in data.ts): unconfigured, empty
 * table, or any error degrades to the bundled sample - never a throw to the page.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getIpos,
  getIpoBySymbol,
  hydrateIpoSeed,
  withEffectiveStatus,
  type IpoCategory,
  type IpoCompany,
  type IpoSeed,
  type IpoStatus,
} from '@/lib/ipos';

export interface IpoDataset {
  ipos: IpoCompany[];
  /** 'live' = rows from the nightly Finnhub sync; 'sample' = bundled editorial seed. */
  source: 'live' | 'sample';
  /** Most recent updated_at across live rows (ISO), null on sample data. */
  updatedAt: string | null;
}

interface IpoRow {
  symbol?: string;
  company_name?: string;
  ipo_date?: string;
  exchange?: string;
  category?: string;
  status?: string;
  offer_price?: number | string;
  shares_offered_m?: number | string;
  proceeds_usd_m?: number | string;
  valuation_usd_m?: number | string;
  revenue_ttm_usd_m?: number | string | null;
  revenue_growth_pct?: number | string | null;
  gross_margin_pct?: number | string | null;
  net_income_usd_m?: number | string | null;
  profitable?: boolean | null;
  employees?: number | null;
  products?: unknown;
  notable_projects?: unknown;
  key_people?: unknown;
  description?: string | null;
  domain?: string | null;
  updated_at?: string | null;
}

const STATUSES: ReadonlySet<string> = new Set(['upcoming', 'priced', 'recent']);
const CATEGORIES: ReadonlySet<string> = new Set([
  'mega_cap_platform', 'ai_infrastructure', 'semiconductor', 'software',
  'cloud_data', 'cybersecurity', 'consumer_internet', 'fintech_tech',
]);

function num(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Map a snake_case table row to the frontend shape; null when required fields are missing. */
export function mapIpoRow(row: IpoRow): IpoCompany | null {
  if (!row.symbol || !row.company_name || !row.ipo_date) return null;
  const offerPrice = num(row.offer_price);
  if (offerPrice === undefined) return null;

  const seed: IpoSeed = {
    symbol: row.symbol,
    companyName: row.company_name,
    ipoDate: row.ipo_date,
    exchange: row.exchange ?? '-',
    category: (CATEGORIES.has(row.category ?? '') ? row.category : 'software') as IpoCategory,
    status: (STATUSES.has(row.status ?? '') ? row.status : 'upcoming') as IpoStatus,
    offerPrice,
    sharesOfferedM: num(row.shares_offered_m) ?? 0,
    proceedsUsdM: num(row.proceeds_usd_m) ?? 0,
    valuationUsdM: num(row.valuation_usd_m) ?? 0,
    revenueTtmUsdM: num(row.revenue_ttm_usd_m),
    revenueGrowthPct: num(row.revenue_growth_pct),
    grossMarginPct: num(row.gross_margin_pct),
    netIncomeUsdM: num(row.net_income_usd_m),
    profitable: row.profitable === true,
    employees: row.employees ?? undefined,
    products: strArray(row.products),
    notableProjects: strArray(row.notable_projects),
    keyPeople: Array.isArray(row.key_people)
      ? (row.key_people as { name?: string; role?: string }[])
          .filter((p) => typeof p?.name === 'string' && typeof p?.role === 'string')
          .map((p) => ({ name: p.name as string, role: p.role as string }))
      : [],
    description: row.description ?? '',
    domain: row.domain ?? '',
  };
  return hydrateIpoSeed(seed);
}

/** All IPOs for the radar: live table when configured + populated, sample otherwise. */
export async function getIposLive(now: Date = new Date()): Promise<IpoDataset> {
  const sample: IpoDataset = { ipos: withEffectiveStatus(getIpos(), now), source: 'sample', updatedAt: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return sample;

  try {
    const { data, error } = await supabase.from('ipos').select('*').limit(300);
    if (error || !data || data.length === 0) return sample;

    const mapped = (data as IpoRow[]).map(mapIpoRow).filter((i): i is IpoCompany => i !== null);
    if (mapped.length === 0) return sample;

    const updatedAt = (data as IpoRow[])
      .map((r) => r.updated_at ?? '')
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return {
      ipos: withEffectiveStatus(mapped, now).sort((a, b) => b.valuationUsdM - a.valuationUsdM),
      source: 'live',
      updatedAt,
    };
  } catch {
    return sample;
  }
}

/** Single IPO by symbol: live row when available, sample fallback, undefined when unknown. */
export async function getIpoBySymbolLive(symbol: string, now: Date = new Date()): Promise<IpoCompany | undefined> {
  const fallback = () => {
    const ipo = getIpoBySymbol(symbol);
    return ipo ? withEffectiveStatus([ipo], now)[0] : undefined;
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallback();

  try {
    const { data, error } = await supabase.from('ipos').select('*').ilike('symbol', symbol).limit(1);
    if (error || !data || data.length === 0) return fallback();
    const mapped = mapIpoRow(data[0] as IpoRow);
    return mapped ? withEffectiveStatus([mapped], now)[0] : fallback();
  } catch {
    return fallback();
  }
}
