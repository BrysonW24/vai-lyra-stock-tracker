'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Zap, Check, Loader2, Undo2, ArrowUpRight, AlertTriangle, TrendingUp, Plus, RotateCcw } from 'lucide-react';
import { loadOnboardingSummary } from '@/lib/onboarding-summary';
import { addLocalWatchItem, removeLocalWatchItem } from '@/lib/local-watchlist';
import { computeNextBestActions, type NextAction, type NbaProfile, type NbaSignal, type NbaHolding, type NbaWatch } from '@/lib/next-best-actions';

interface Props {
  signals: NbaSignal[];
  portfolio: NbaHolding[];
  watchlist: NbaWatch[];
}

type ActState = 'running' | 'done' | 'demo' | 'failed' | 'undone';

const TONE: Record<string, { ring: string; icon: typeof Zap; iconColor: string }> = {
  urgent: { ring: 'border-accent-border/60 bg-accent-tint/60', icon: AlertTriangle, iconColor: 'text-accent' },
  opportunity: { ring: 'border-positive/25 bg-positive-tint/60', icon: TrendingUp, iconColor: 'text-positive' },
  info: { ring: 'border-line bg-chrome', icon: Zap, iconColor: 'text-pending' },
};

/**
 * Next Best Actions - the Command Centre's "what to do now" panel. A deterministic ranker
 * (next-best-actions.ts) builds a short, prioritised, profile-personalised list from the real
 * signals/holdings/watchlist; the watchlist suggestions carry a reversible confirm-to-act button.
 */
export function NextBestActions({ signals, portfolio, watchlist }: Props) {
  const [profile, setProfile] = useState<NbaProfile | null>(null);
  const [acted, setActed] = useState<Record<string, ActState>>({});
  const [undoIds, setUndoIds] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = loadOnboardingSummary();
    if (s) setProfile({ experienceLevel: s.experienceLevel, riskComfort: s.riskComfort, watchlistCount: s.watchlistCount, portfolioCount: s.portfolioCount });
  }, []);

  const actions = useMemo(
    () => computeNextBestActions({ signals, portfolio, watchlist, profile }, 5),
    [signals, portfolio, watchlist, profile],
  );

  async function addWatch(a: NextAction) {
    if (!a.symbol || acted[a.id] === 'running') return;
    setActed((x) => ({ ...x, [a.id]: 'running' }));
    try {
      const res = await fetch('/api/watchlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol: a.symbol }) });
      const d = (await res.json()) as { ok?: boolean; demo?: boolean; data?: { id?: string } };
      if (d.ok) {
        setActed((x) => ({ ...x, [a.id]: 'done' }));
        if (d.data?.id) setUndoIds((u) => ({ ...u, [a.id]: d.data!.id as string }));
      } else if (d.demo) {
        // Solo/demo deployment - no server store exists, so save to the browser-local
        // watchlist instead of pointing at accounts that cannot be created here.
        if (addLocalWatchItem({ symbol: a.symbol })) {
          setActed((x) => ({ ...x, [a.id]: 'done' }));
          setUndoIds((u) => ({ ...u, [a.id]: `local-${a.symbol}` }));
        } else {
          setActed((x) => ({ ...x, [a.id]: 'failed' }));
        }
      } else if (res.status === 401) {
        // Configured deploy, signed out: accounts exist, "sign in to save" is right.
        setActed((x) => ({ ...x, [a.id]: 'demo' }));
      } else {
        setActed((x) => ({ ...x, [a.id]: 'failed' }));
      }
    } catch {
      setActed((x) => ({ ...x, [a.id]: 'failed' }));
    }
  }

  async function undo(a: NextAction) {
    const id = undoIds[a.id];
    if (!id) return;
    // Local- ids were saved to the browser-local watchlist (Solo/demo) - undo there.
    if (id.startsWith('local-') && a.symbol) {
      removeLocalWatchItem(a.symbol);
      setActed((x) => ({ ...x, [a.id]: 'undone' }));
      return;
    }
    setActed((x) => ({ ...x, [a.id]: 'running' }));
    try {
      await fetch('/api/watchlist', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      setActed((x) => ({ ...x, [a.id]: 'undone' }));
    } catch {
      setActed((x) => ({ ...x, [a.id]: 'done' }));
    }
  }

  if (!actions.length) return null;

  return (
    <section className="terminal-panel rounded-panel p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-cell border border-pending/30 bg-blue-tint text-pending">
          <Zap size={13} />
        </span>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Next best actions</h2>
          <p className="text-[10px] text-ink-3">Your top {actions.length} {actions.length === 1 ? 'priority' : 'priorities'} right now, ranked from your data.</p>
        </div>
      </div>

      <ol className="mt-2.5 space-y-1.5">
        {actions.map((a, i) => {
          const tone = TONE[a.tone] ?? TONE.info;
          const Icon = tone.icon;
          const st = acted[a.id];
          return (
            <li key={a.id} className={`flex items-start gap-2.5 rounded-cell border p-2.5 ${tone.ring}`}>
              <span className="mt-0.5 flex shrink-0 items-center gap-1">
                <span className="font-mono text-[10px] text-ink-dim">{i + 1}</span>
                <Icon size={13} className={tone.iconColor} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-snug text-ink">{a.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-ink-3">{a.detail}</p>
                <div className="mt-1.5">
                  {a.cta?.addWatchlist ? (
                    st === 'done' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-positive">
                        <Check size={12} /> Added to watchlist
                        {undoIds[a.id] && (
                          <button type="button" onClick={() => undo(a)} className="ml-1 inline-flex items-center gap-1 rounded border border-negative-soft/30 bg-negative-soft/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-negative-soft transition hover:bg-negative-soft/20">
                            <Undo2 size={9} /> Undo
                          </button>
                        )}
                      </span>
                    ) : st === 'undone' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3"><RotateCcw size={11} /> Undone</span>
                    ) : st === 'demo' ? (
                      <span className="text-[10.5px] text-accent">
                        <Link href="/auth/login" className="underline">Sign in</Link> to save {a.symbol} to your watchlist.
                      </span>
                    ) : (
                      <button type="button" onClick={() => addWatch(a)} disabled={st === 'running'} className="inline-flex items-center gap-1.5 rounded-cell border border-pending/40 bg-blue-tint px-2.5 py-1 text-[11px] font-semibold text-pending transition hover:bg-blue-deep/30 disabled:opacity-50">
                        {st === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {a.cta.label}
                        {st === 'failed' && <span className="ml-1 text-negative">retry</span>}
                      </button>
                    )
                  ) : a.cta?.href ? (
                    <Link href={a.cta.href} className="inline-flex items-center gap-1 rounded-cell border border-line-strong bg-panel px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition hover:text-ink">
                      {a.cta.label} <ArrowUpRight size={12} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[8.5px] leading-snug text-ink-dim">Ranked deterministically from your signals, holdings, watchlist and profile - reversible where actionable. Research, not advice.</p>
    </section>
  );
}
