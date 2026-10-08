/**
 * Server-side read of the AI briefing: the `stock_scanner_runs` rows the briefing worker writes
 * (job_name `ai_briefing`, workers/stock_scanner/ai_briefing.py), one per evening, with the
 * checked items on the row's payload. The mapping itself is in briefing.ts (client-safe); this
 * file only does the read.
 *
 * Fallback contract (same as intelligence-live.ts): unconfigured, empty, or any error degrades to
 * `source: 'none'` and an empty list - the page says there is no briefing yet rather than showing a
 * sample dressed as tonight's research.
 */
import { briefingFromRow, type Briefing, type BriefingRunRow } from '@/lib/briefing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface BriefingDataset {
  briefings: Briefing[];
  /** 'live' = rows from the worker; 'none' = nothing stored yet (or unreachable). */
  source: 'live' | 'none';
}

export async function getBriefings(limit = 7): Promise<BriefingDataset> {
  const none: BriefingDataset = { briefings: [], source: 'none' };
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return none;
    const { data, error } = await supabase
      .from('stock_scanner_runs')
      .select('started_at, finished_at, payload')
      .eq('job_name', 'ai_briefing')
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      // A "no briefing tonight" run is a success row with no items; over-fetch so `limit` is briefings.
      .limit(limit * 3);
    if (error || !data) return none;
    const seen = new Set<string>();
    const briefings: Briefing[] = [];
    for (const row of data as BriefingRunRow[]) {
      const briefing = briefingFromRow(row);
      if (!briefing || seen.has(briefing.date)) continue;
      seen.add(briefing.date);
      briefings.push(briefing);
      if (briefings.length >= limit) break;
    }
    return { briefings, source: briefings.length > 0 ? 'live' : 'none' };
  } catch {
    return none;
  }
}
