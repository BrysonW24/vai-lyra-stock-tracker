/**
 * Server-side fundamentals reads: the Supabase `fundamental_snapshots` table (filled
 * nightly by workers/fundamentals_worker, LIVE providers only) with the bundled demo set
 * as fallback. Same contract as calendar-live.ts / intelligence-live.ts, kept out of
 * fundamentals.ts so that module stays importable from client components.
 *
 * Fallback contract: unconfigured, empty tables, or any error degrades to the demo reports
 * with source 'sample' - never a throw to the page. The fundamentals worker only persists
 * when its provider is LIVE (workers/fundamentals_worker/main.py is_live gate), so a
 * deployment with no FINNHUB_API_KEY has an empty table and honestly renders 'sample'
 * rather than surfacing fabricated demo snapshots as real company financials.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getDemoFundamentalReports,
  getFundamentalsReport,
  type FundamentalsReport,
  type TickerFundamentals,
} from '@/lib/fundamentals';

export interface FundamentalsDataset {
  reports: FundamentalsReport[];
  /** 'live' = latest snapshot per symbol from the nightly sync; 'sample' = bundled demo. */
  source: 'live' | 'sample';
  updatedAt: string | null;
}

const SAMPLE: () => FundamentalsDataset = () => ({
  reports: getDemoFundamentalReports(),
  source: 'sample',
  updatedAt: null,
});

interface SnapshotRow {
  symbol?: string | null;
  company_name?: string | null;
  sector?: string | null;
  industry?: string | null;
  market_cap?: number | string | null;
  enterprise_value?: number | string | null;
  revenue?: number | string | null;
  revenue_growth_yoy?: number | string | null;
  gross_margin?: number | string | null;
  operating_margin?: number | string | null;
  net_income?: number | string | null;
  free_cash_flow?: number | string | null;
  ebitda?: number | string | null;
  cash?: number | string | null;
  debt?: number | string | null;
  pe?: number | string | null;
  forward_pe?: number | string | null;
  price_to_sales?: number | string | null;
  ev_to_ebitda?: number | string | null;
  ev_to_revenue?: number | string | null;
  eps_growth?: number | string | null;
  snapshot_date?: string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

function mapSnapshot(row: SnapshotRow): TickerFundamentals | null {
  if (!row.symbol) return null;
  return {
    symbol: row.symbol,
    companyName: row.company_name || row.symbol,
    sector: row.sector || 'Technology',
    industry: row.industry || '',
    marketCap: num(row.market_cap),
    enterpriseValue: num(row.enterprise_value),
    revenue: num(row.revenue),
    revenueGrowthYoY: num(row.revenue_growth_yoy),
    grossMargin: num(row.gross_margin),
    operatingMargin: num(row.operating_margin),
    netIncome: num(row.net_income),
    freeCashFlow: num(row.free_cash_flow),
    ebitda: num(row.ebitda),
    cash: num(row.cash),
    debt: num(row.debt),
    pe: num(row.pe),
    forwardPe: num(row.forward_pe),
    priceToSales: num(row.price_to_sales),
    evToEbitda: num(row.ev_to_ebitda),
    evToRevenue: num(row.ev_to_revenue),
    epsGrowth: num(row.eps_growth),
  };
}

/**
 * Fundamentals reports: latest snapshot per symbol from the live table when configured +
 * populated, bundled demo set otherwise. Quality score + valuation read are recomputed
 * client-side-equivalent (getFundamentalsReport) so the displayed blend is always Lyra's
 * own deterministic formula, never a stored guess.
 */
export async function getFundamentalsLive(): Promise<FundamentalsDataset> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return SAMPLE();

  try {
    const res = await supabase
      .from('fundamental_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(500);
    if (res.error) return SAMPLE();

    const rows = (res.data ?? []) as SnapshotRow[];
    if (rows.length === 0) return SAMPLE();

    // Keep the newest snapshot per symbol (rows already sorted snapshot_date desc).
    const latest = new Map<string, SnapshotRow>();
    for (const row of rows) {
      if (row.symbol && !latest.has(row.symbol)) latest.set(row.symbol, row);
    }

    const reports: FundamentalsReport[] = [];
    for (const row of latest.values()) {
      const mapped = mapSnapshot(row);
      if (mapped) reports.push(getFundamentalsReport(mapped));
    }
    if (reports.length === 0) return SAMPLE();

    const updatedAt = rows.map((r) => r.snapshot_date ?? '').filter(Boolean).sort().at(-1) ?? null;
    return { reports, source: 'live', updatedAt };
  } catch {
    return SAMPLE();
  }
}
