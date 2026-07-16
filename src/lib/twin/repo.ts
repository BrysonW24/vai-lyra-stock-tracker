/**
 * Twin repo - the ONLY place the twin touches the database. Reads the signed-in user's own
 * behavioural rows (RLS-enforced, owner-only), maps them onto the pure model's inputs, and returns
 * the deterministic reflection. Keeping all IO here means model.ts / reconcile.ts / reflect.ts stay
 * pure and fully unit-tested. Every read is best-effort: any failure degrades to the empty twin.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUserConstraints } from '@/lib/ai/user-context';
import {
  computeTwinProfile,
  type TwinInputs,
  type TwinTradeEvent,
  type TwinWatchEvent,
  type TwinAttentionEvent,
} from '@/lib/twin/model';
import { buildReflection, type TwinReflection } from '@/lib/twin/reflect';
import { affinityWeightsFrom, type AffinityWeights } from '@/lib/twin/ranking';
import { themeForSymbol, themeNameForSlug } from '@/lib/twin/themes';
import type { SignalKind } from '@/lib/signal-intelligence';
import type { LifecycleStage } from '@/lib/small-cap-lifecycle';

const LIFECYCLE_STAGES: LifecycleStage[] = ['concept', 'funded', 'contracted', 'scaling', 'crowded'];
const KNOWN_KINDS: SignalKind[] = [
  'gov-award',
  'capital-event',
  'big-tech-backing',
  'institutional',
  'bottleneck',
  'momentum',
  'lifecycle',
];

/** Defensive JSON coercion - the snapshot columns are freeform jsonb from historical writes. */
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function coerceStage(v: unknown): LifecycleStage | null {
  return typeof v === 'string' && (LIFECYCLE_STAGES as string[]).includes(v) ? (v as LifecycleStage) : null;
}

function coerceKinds(v: unknown): SignalKind[] {
  if (!Array.isArray(v)) return [];
  return v.filter((k): k is SignalKind => typeof k === 'string' && (KNOWN_KINDS as string[]).includes(k));
}

function stageFromSnapshot(snap: Record<string, unknown>): LifecycleStage | null {
  return coerceStage(snap.stage) ?? coerceStage(snap.lifecycleStage) ?? coerceStage(snap.lifecycle_stage);
}

function kindsFromSnapshot(snap: Record<string, unknown>): SignalKind[] {
  const raw = snap.kinds ?? snap.signalKinds ?? snap.convergenceKinds;
  return coerceKinds(raw);
}

/**
 * Load + map the signed-in user's behavioural rows into the pure model's inputs (+ their stated
 * constraints). Shared by the reflection and affinity loaders so the DB read lives in one place.
 * Returns null when there is no signed-in user / Supabase is unconfigured.
 */
async function loadTwinContext(): Promise<{
  inputs: TwinInputs;
  constraints: Awaited<ReturnType<typeof getUserConstraints>>;
} | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;

    const [tradesRes, watchRes, acctRes, attnRes, constraints] = await Promise.all([
      supabase
        .from('paper_trades')
        .select('symbol, entry_time, exit_time, entry_price, quantity, realised_pnl, signal_snapshot')
        .eq('user_id', user.id)
        .order('entry_time', { ascending: false })
        .limit(500),
      supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('paper_accounts').select('starting_cash').eq('user_id', user.id).maybeSingle(),
      // Opt-in attention capture. The table may not exist / be empty; a failed read degrades to [].
      supabase
        .from('interaction_events')
        .select('event_type, entity_type, entity_id, meta, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000),
      getUserConstraints(),
    ]);

    const trades: TwinTradeEvent[] = (tradesRes.data ?? []).map((row) => {
      const snap = asRecord((row as { signal_snapshot?: unknown }).signal_snapshot);
      const symbol = String((row as { symbol?: unknown }).symbol ?? '');
      const entryPrice = Number((row as { entry_price?: unknown }).entry_price ?? NaN);
      const quantity = Number((row as { quantity?: unknown }).quantity ?? NaN);
      const notional = Number.isFinite(entryPrice) && Number.isFinite(quantity) ? entryPrice * quantity : null;
      const realised = (row as { realised_pnl?: unknown }).realised_pnl;
      return {
        symbol,
        theme: (typeof snap.theme === 'string' ? snap.theme : null) ?? themeForSymbol(symbol),
        signalKinds: kindsFromSnapshot(snap),
        stage: stageFromSnapshot(snap),
        openedAt: (row as { entry_time?: string | null }).entry_time ?? null,
        closedAt: (row as { exit_time?: string | null }).exit_time ?? null,
        notional,
        realisedPnl: typeof realised === 'number' ? realised : null,
      };
    });

    const watches: TwinWatchEvent[] = (watchRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const symbol = String(r.symbol ?? '');
      return {
        symbol,
        theme: themeForSymbol(symbol),
        // stage-at-add (migration 034); absent on legacy rows -> null, handled by the model.
        stage: coerceStage(r.lifecycle_stage_at_add) ?? coerceStage(r.lifecycle_stage),
        addedAt: (r.created_at as string | null) ?? null,
      };
    });

    const attention: TwinAttentionEvent[] = (attnRes.data ?? [])
      // Only entity-bearing events feed affinity. Cadence events (session_open / filter_apply) carry
      // no ticker/theme, so they must not inflate the interaction count or affinities.
      .filter((row) => (row as Record<string, unknown>).entity_id)
      .map((row) => {
      const r = row as Record<string, unknown>;
      const meta = asRecord(r.meta);
      const eventType = String(r.event_type ?? '');
      const entityId = r.entity_id ? String(r.entity_id) : null;
      // theme_open carries a theme slug; every other attention event carries a symbol.
      const isTheme = eventType === 'theme_open' || r.entity_type === 'theme';
      return {
        symbol: isTheme ? null : entityId,
        theme: isTheme ? themeNameForSlug(entityId) : themeForSymbol(entityId),
        signalKinds: kindsFromSnapshot(meta),
        stage: stageFromSnapshot(meta),
        at: (r.created_at as string | null) ?? null,
      };
    });

    const capital =
      (acctRes.data as { starting_cash?: number } | null)?.starting_cash ??
      (typeof constraints?.cashAvailable === 'number' ? constraints.cashAvailable : null);

    const inputs: TwinInputs = { trades, watches, attention, capital };
    return { inputs, constraints };
  } catch {
    return null;
  }
}

/**
 * The signed-in user's trading-twin reflection, or null when unsigned / unconfigured (the caller
 * renders the demo/empty state).
 */
export async function loadTwinReflection(nowMs: number = Date.now()): Promise<TwinReflection | null> {
  const ctx = await loadTwinContext();
  if (!ctx) return null;
  return buildReflection(computeTwinProfile(ctx.inputs, nowMs), ctx.constraints);
}

/** The user's affinity weights (symbols + themes) for the deterministic ranking tiebreak, or null. */
export async function loadTwinAffinity(nowMs: number = Date.now()): Promise<AffinityWeights | null> {
  const ctx = await loadTwinContext();
  if (!ctx) return null;
  return affinityWeightsFrom(computeTwinProfile(ctx.inputs, nowMs));
}
