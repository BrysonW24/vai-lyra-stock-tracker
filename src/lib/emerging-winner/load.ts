/**
 * Server-side loader for the Emerging Winner Engine research queue. Reads the latest run's predictions
 * from the immutable ledger (migration 056) via the anon key (RLS: read-only). Demo-safe: with no
 * Supabase, or an empty ledger, returns the generated DEMO_QUEUE so the surface always renders honestly.
 * The Python worker owns every number; this only reads them back.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEMO_QUEUE } from './demo';
import type { EmergingWinnerQueue, EmergingWinnerResult } from './types';

const SHADOW_NOTE =
  'Beta: predictions are computed and logged to an immutable ledger, but are not surfaced as ' +
  'truth until historical walk-forward and live calibration earn it. Research only, never advice.';

export async function loadEmergingWinnerQueue(): Promise<EmergingWinnerQueue> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEMO_QUEUE;

  try {
    const { data: runs, error: runErr } = await supabase
      .from('emerging_winner_runs')
      .select('id, started_at, engine_version')
      .order('started_at', { ascending: false })
      .limit(1);
    if (runErr || !runs || runs.length === 0) return DEMO_QUEUE;

    const run = runs[0] as { id: string; started_at: string; engine_version: string };
    const { data: preds, error: predErr } = await supabase
      .from('emerging_winner_predictions')
      .select('payload')
      .eq('run_id', run.id)
      .order('surfaced', { ascending: false })
      .order('priority_score', { ascending: false })
      .limit(200);
    if (predErr || !preds || preds.length === 0) return DEMO_QUEUE;

    const queue = preds.map((p) => (p as { payload: EmergingWinnerResult }).payload);
    return {
      queue,
      generated_at: run.started_at,
      engine_version: run.engine_version,
      demo: false,
      note: SHADOW_NOTE,
    };
  } catch {
    return DEMO_QUEUE;
  }
}
