/**
 * "State at add" - the deterministic snapshot frozen onto a watchlist add (migration 034). Captures
 * the signal score, lifecycle stage, and backing strength a name was in AT THE MOMENT the user added
 * it, so the twin can later learn whether they gravitate to early (concept/funded) or late
 * (scaling/crowded) names. Pure read of the deterministic engine; best-effort (nulls on any miss).
 */
import { getDashboardData } from '@/lib/data';
import { backingFor, buildLifecycleCandidates, type LifecycleStage } from '@/lib/small-cap-lifecycle';

export interface StateAtAdd {
  signalScore: number | null;
  lifecycleStage: LifecycleStage | null;
  backingStrength: number | null;
}

export async function stateAtAdd(symbol: string): Promise<StateAtAdd> {
  const sym = symbol.toUpperCase();
  try {
    const data = await getDashboardData();
    const signal = data.signals.find((s) => s.symbol === sym);
    const momentumBySymbol = Object.fromEntries(data.signals.map((s) => [s.symbol, s.score]));
    const candidate = buildLifecycleCandidates(momentumBySymbol).find((c) => c.symbol === sym);
    const backing = backingFor(sym);
    return {
      signalScore: signal ? signal.score : null,
      lifecycleStage: candidate ? candidate.stage : null,
      backingStrength: backing ? backing.strength : null,
    };
  } catch {
    return { signalScore: null, lifecycleStage: null, backingStrength: null };
  }
}
