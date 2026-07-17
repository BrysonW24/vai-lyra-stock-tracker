import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import scoutSources from '@/lib/generated/scout-sources.json';

/**
 * "What the scout saw" - the feed behind the ideas board's scout panel.
 *
 * Returns the latest nightly run ledger (per-theme counts, near-promotion drumbeats,
 * saturation) plus the freshest items the scout read. Everything here is read-only,
 * public-by-RLS data; drumbeats are computed by the SAME Python code that promotes
 * ideas (workers/scout/cluster.py), so this surface can never drift from the real bar.
 *
 * Degrades on purpose: no Supabase -> a demo feed so the panel always has shape;
 * migration 045 not applied -> pendingMigration instead of a 500.
 */

interface ScoutDrumbeat {
  entity: string;
  items: number;
  sources: number;
  needItems: number;
  needSources: number;
  latest: { title: string; url: string | null };
}

export interface ScoutRunSummary {
  runAt: string;
  itemsFetched: number;
  itemsUnmapped: number;
  ideasFiled: number;
  sourcesActive: number;
  sourcesGated: number;
  windowSaturated: boolean;
  themeCounts: Record<string, number>;
  drumbeats: ScoutDrumbeat[];
}

export interface ScoutFeedItem {
  id: string;
  title: string;
  url: string | null;
  sourceName: string;
  publishedAt: string | null;
  themes: string[];
  unmapped: boolean;
}

/** v3: earned source score - evidence appearances in accepted vs declined cards. */
export interface ScoutSourceScore {
  sourceName: string;
  accepted: number;
  declined: number;
}

const SOURCE_NAMES: Record<string, string> = Object.fromEntries(
  (scoutSources as { id: string; name: string }[]).map((s) => [s.id, s.name]),
);

/** Mirrors the first real production run so the demo panel shows true-to-life shape. */
const DEMO_RUN: ScoutRunSummary = {
  runAt: '2026-07-17T22:10:00.000Z',
  itemsFetched: 400,
  itemsUnmapped: 110,
  ideasFiled: 0,
  sourcesActive: 36,
  sourcesGated: 64,
  windowSaturated: false,
  themeCounts: {
    'agi-infrastructure': 96, 'critical-minerals': 91, 'robotics-automation': 83,
    'space-economy': 81, 'cybersecurity': 78, 'quantum-computing': 62,
  },
  drumbeats: [
    { entity: 'Commonwealth Fusion Systems', items: 2, sources: 1, needItems: 1, needSources: 1, latest: { title: 'Commonwealth Fusion Systems signs utility power agreement', url: null } },
    { entity: 'Orbital Data Centres', items: 2, sources: 2, needItems: 1, needSources: 0, latest: { title: 'Second startup pitches orbital data centres for AI training', url: null } },
  ],
};

const DEMO_SCORES: ScoutSourceScore[] = [
  { sourceName: 'DOE Newsroom', accepted: 3, declined: 0 },
  { sourceName: 'World Nuclear News', accepted: 2, declined: 1 },
  { sourceName: 'PR Newswire Tech', accepted: 0, declined: 4 },
];

const DEMO_ITEMS: ScoutFeedItem[] = [
  { id: 'demo-f1', title: 'US Department of Energy announces fusion pilot funding round', url: 'https://example.com/doe-fusion', sourceName: 'DOE Newsroom', publishedAt: '2026-07-17T14:00:00.000Z', themes: [], unmapped: true },
  { id: 'demo-f2', title: 'Hyperscaler expands data-centre campus with dedicated substation', url: 'https://example.com/dc-substation', sourceName: 'Data Center Dynamics', publishedAt: '2026-07-17T11:00:00.000Z', themes: ['agi-infrastructure'], unmapped: false },
  { id: 'demo-f3', title: 'Rare-earth processing plant clears final permitting hurdle', url: 'https://example.com/rare-earth', sourceName: 'Mining.com', publishedAt: '2026-07-17T08:00:00.000Z', themes: ['critical-minerals'], unmapped: false },
];

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /does not exist/i.test(error.message || '');
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true, demo: true, run: DEMO_RUN, items: DEMO_ITEMS,
      themeTotals: DEMO_RUN.themeCounts, sourceScores: DEMO_SCORES, stoplistCount: 2,
    });
  }

  // Last 14 run ledger rows (migration 045): newest is the panel's headline, and the
  // window sum is the "did this theme attract news?" measurement (v3 - shipped verticals
  // are measured by the attach volume they actually earn, not by anyone's opinion).
  let run: ScoutRunSummary | null = null;
  const themeTotals: Record<string, number> = {};
  let pendingMigration = false;
  const runRes = await supabase
    .from('scout_runs')
    .select('run_at, items_fetched, items_unmapped, ideas_filed, sources_active, sources_gated, window_saturated, theme_counts, drumbeats')
    .order('run_at', { ascending: false })
    .limit(14);
  if (runRes.error) {
    if (!isMissingTable(runRes.error)) {
      return NextResponse.json({ ok: false, error: runRes.error.message }, { status: 400 });
    }
    pendingMigration = true;
  } else if (runRes.data && runRes.data.length > 0) {
    const r = runRes.data[0];
    run = {
      runAt: r.run_at as string,
      itemsFetched: Number(r.items_fetched ?? 0),
      itemsUnmapped: Number(r.items_unmapped ?? 0),
      ideasFiled: Number(r.ideas_filed ?? 0),
      sourcesActive: Number(r.sources_active ?? 0),
      sourcesGated: Number(r.sources_gated ?? 0),
      windowSaturated: Boolean(r.window_saturated),
      themeCounts: (r.theme_counts ?? {}) as Record<string, number>,
      drumbeats: Array.isArray(r.drumbeats) ? (r.drumbeats as ScoutDrumbeat[]) : [],
    };
    for (const row of runRes.data) {
      for (const [slug, count] of Object.entries((row.theme_counts ?? {}) as Record<string, number>)) {
        themeTotals[slug] = (themeTotals[slug] ?? 0) + Number(count || 0);
      }
    }
  }

  // v3 surfaces (migration 048): the earned source leaderboard and the verdict stoplist.
  // Both degrade to empty when unapplied - the panel simply omits the sections.
  let sourceScores: ScoutSourceScore[] = [];
  let stoplistCount = 0;
  const scoresRes = await supabase.from('scout_source_scores').select('source_id, accepted, declined');
  if (!scoresRes.error && scoresRes.data) {
    sourceScores = scoresRes.data
      .map((row) => ({
        sourceName: SOURCE_NAMES[row.source_id as string] ?? (row.source_id as string),
        accepted: Number(row.accepted ?? 0),
        declined: Number(row.declined ?? 0),
      }))
      .sort((a, b) => b.accepted + b.declined - (a.accepted + a.declined))
      .slice(0, 8);
  }
  const stopRes = await supabase.from('scout_stoplist').select('slug', { count: 'exact', head: true });
  if (!stopRes.error && typeof stopRes.count === 'number') stoplistCount = stopRes.count;

  // Freshest items the scout read (migration 043). Missing table -> empty list, same flag.
  let items: ScoutFeedItem[] = [];
  const itemsRes = await supabase
    .from('scout_items')
    .select('id, title, url, source_id, published_at, matched_themes, unmapped')
    .order('created_at', { ascending: false })
    .limit(12);
  if (itemsRes.error) {
    if (!isMissingTable(itemsRes.error)) {
      return NextResponse.json({ ok: false, error: itemsRes.error.message }, { status: 400 });
    }
    pendingMigration = true;
  } else {
    items = (itemsRes.data || []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      url: (row.url as string) ?? null,
      sourceName: SOURCE_NAMES[row.source_id as string] ?? (row.source_id as string),
      publishedAt: (row.published_at as string) ?? null,
      themes: Array.isArray(row.matched_themes) ? (row.matched_themes as string[]) : [],
      unmapped: Boolean(row.unmapped),
    }));
  }

  return NextResponse.json({ ok: true, pendingMigration, run, items, themeTotals, sourceScores, stoplistCount });
}
