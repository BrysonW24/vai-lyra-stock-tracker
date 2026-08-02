'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronUp, ExternalLink, Loader2, Radar } from 'lucide-react';
import themesJson from '@/lib/generated/themes.json';

/**
 * "What the scout saw" - the stream behind the ideas board.
 *
 * The promotion bar (>=3 items from >=2 independent sources) is deliberately hard, so the
 * board can be empty for days while signal accumulates. This panel makes the accumulation
 * visible: last night's read counts per theme, the drumbeats still building toward
 * promotion, and the freshest items - all deterministic data the worker recorded, no AI.
 */

interface Drumbeat {
  entity: string;
  items: number;
  sources: number;
  needItems: number;
  needSources: number;
  latest: { title: string; url: string | null };
}

interface RunSummary {
  runAt: string;
  itemsFetched: number;
  itemsUnmapped: number;
  ideasFiled: number;
  sourcesActive: number;
  sourcesGated: number;
  windowSaturated: boolean;
  themeCounts: Record<string, number>;
  drumbeats: Drumbeat[];
}

interface FeedItem {
  id: string;
  title: string;
  url: string | null;
  sourceName: string;
  publishedAt: string | null;
  themes: string[];
  unmapped: boolean;
}

interface SourceScore {
  sourceName: string;
  accepted: number;
  declined: number;
}

interface FeedResponse {
  ok: boolean;
  demo?: boolean;
  pendingMigration?: boolean;
  run?: RunSummary | null;
  items?: FeedItem[];
  themeTotals?: Record<string, number>;
  sourceScores?: SourceScore[];
  stoplistCount?: number;
  error?: string;
}

const THEME_META: Record<string, { name: string; emoji: string }> = Object.fromEntries(
  (themesJson as { slug: string; name: string; emoji: string }[]).map((t) => [t.slug, { name: t.name, emoji: t.emoji }]),
);

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const VISIBLE_ITEMS = 6;

export function ScoutFeed() {
  const [run, setRun] = useState<RunSummary | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [themeTotals, setThemeTotals] = useState<Record<string, number>>({});
  const [sourceScores, setSourceScores] = useState<SourceScore[]>([]);
  const [stoplistCount, setStoplistCount] = useState(0);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scout/feed', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: FeedResponse) => {
        if (cancelled) return;
        setRun(data.run ?? null);
        setItems(data.items ?? []);
        setThemeTotals(data.themeTotals ?? {});
        setSourceScores(data.sourceScores ?? []);
        setStoplistCount(data.stoplistCount ?? 0);
        setDemo(Boolean(data.demo));
        setFailed(!data.ok);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The measurement chips: trailing-window attach totals when the ledger has history
  // (that IS the "did this theme attract news?" number), else tonight's counts.
  const totalsMode = Object.keys(themeTotals).length > 0;
  const themeChips = useMemo(() => {
    const counts = totalsMode ? themeTotals : run?.themeCounts ?? {};
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([slug, count]) => ({ slug, count, meta: THEME_META[slug] }));
  }, [totalsMode, themeTotals, run]);

  // Nothing useful to show and nothing pending: stay out of the way entirely.
  if (failed) return null;

  const visible = showAll ? items : items.slice(0, VISIBLE_ITEMS);

  return (
    <section className="terminal-panel overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line/70 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-info">
          <Radar size={13} /> What the scout saw
        </span>
        {run && <span className="font-mono text-[10px] text-ink-dim">{timeAgo(run.runAt)}</span>}
        {demo && <span className="rounded-full border border-line-hair bg-panel px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-3">Demo preview</span>}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 px-3 py-4 text-[12px] text-ink-3"><Loader2 size={13} className="animate-spin" /> Reading the scout ledger...</p>
      ) : !run && items.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-ink-3">
          The scout&apos;s first nightly run has not landed yet - it reads its sources after the US close and its ledger will appear here.
        </p>
      ) : (
        <div className="space-y-2.5 px-3 py-2.5">
          {run && (
            <>
              <p className="text-[12px] leading-relaxed text-ink-2">
                Last run read <span className="font-mono font-semibold text-ink-title">{run.itemsFetched}</span> items from{' '}
                <span className="font-mono font-semibold text-ink-title">{run.sourcesActive}</span> live sources
                {run.sourcesGated > 0 && <> ({run.sourcesGated} more registered, waiting on access keys)</>}
                {' '}- <span className="font-mono font-semibold text-ink-title">{run.itemsUnmapped}</span> items matched no existing vertical and joined the drumbeat window.
              </p>

              {themeChips.length > 0 && (
                <div>
                  {totalsMode && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Attach volume - trailing 14 nights</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {themeChips.map(({ slug, count, meta }) => (
                      <span key={slug} className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-panel px-1.5 py-0.5 text-[10px] text-ink-2">
                        {meta ? `${meta.emoji} ${meta.name}` : slug}
                        <span className="font-mono font-semibold text-ink-title">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {run.drumbeats.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Building signals - not yet promoted</p>
                  <ul className="mt-1 space-y-1">
                    {run.drumbeats.slice(0, 5).map((d) => (
                      <li key={d.entity} className="text-[11px] leading-snug text-ink-2">
                        <span className="font-semibold text-ink-title">{d.entity}</span>
                        <span className="font-mono text-ink-3"> {d.items}/3 items · {d.sources}/2 sources</span>
                        <span className="text-ink-dim">
                          {' '}- needs {d.needItems > 0 ? `${d.needItems} more item${d.needItems === 1 ? '' : 's'}` : ''}
                          {d.needItems > 0 && d.needSources > 0 ? ' and ' : ''}
                          {d.needSources > 0 ? `${d.needSources} more independent source${d.needSources === 1 ? '' : 's'}` : ''}
                          {d.needItems === 0 && d.needSources === 0 ? 'promotion next run' : ' to become an idea card'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sourceScores.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Earned source scores - from your verdicts</p>
                  <ul className="mt-1 space-y-0.5">
                    {sourceScores.map((s) => (
                      <li key={s.sourceName} className="flex items-center justify-between gap-2 text-[11px] leading-snug">
                        <span className="min-w-0 truncate text-ink-2">{s.sourceName}</span>
                        <span className="shrink-0 font-mono text-[10px]">
                          <span className="text-positive">+{s.accepted}</span>
                          <span className="text-ink-dim"> · </span>
                          <span className="text-negative-soft">-{s.declined}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stoplistCount > 0 && (
                <p className="text-[10px] text-ink-dim">
                  {stoplistCount} entit{stoplistCount === 1 ? 'y' : 'ies'} stop-listed by your verdicts - declined signals never re-file.
                </p>
              )}

              {run.windowSaturated && (
                <p className="rounded border border-accent-border/50 bg-accent-tint/60 px-2 py-1 text-[10px] text-accent">
                  The drumbeat window is saturated - the oldest unmapped signal is being dropped. Clustering may be conservative until the window is widened.
                </p>
              )}
            </>
          )}

          {visible.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Freshest items</p>
              <ul className="mt-1 space-y-1">
                {visible.map((it) => (
                  <li key={it.id} className="flex items-start gap-1.5 text-[11px] leading-snug">
                    <ExternalLink size={10} className="mt-0.5 shrink-0 text-ink-dim" />
                    <span className="min-w-0">
                      {it.url ? (
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-ink-title underline decoration-line-hair underline-offset-2 transition hover:text-ink">
                          {it.title}
                        </a>
                      ) : (
                        <span className="text-ink-title">{it.title}</span>
                      )}
                      <span className="text-ink-dim">
                        {' '}- {it.sourceName}
                        {it.publishedAt && <> · {timeAgo(it.publishedAt)}</>}
                        {it.themes.length > 0 ? (
                          <> · {it.themes.map((t) => THEME_META[t]?.name ?? t).join(', ')}</>
                        ) : it.unmapped ? (
                          <> · <span className="text-blue-info">unmapped</span></>
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {items.length > VISIBLE_ITEMS && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[10px] font-medium text-ink-3 transition hover:text-ink-title sm:min-h-[32px]"
                >
                  {showAll ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {showAll ? 'Show fewer' : `Show all ${items.length}`}
                </button>
              )}
            </div>
          )}

          <p className="flex items-center gap-1 border-t border-panel-deep/80 pt-1.5 text-[10px] leading-snug text-ink-dim">
            <Bot size={10} className="shrink-0" />
            Signal that recurs across 3+ items from 2+ independent sources is promoted to an idea card below. Nothing changes unless a human accepts it.
          </p>
        </div>
      )}
    </section>
  );
}
