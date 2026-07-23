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
  urgent: { ring: 'border-[#5a4a1a] bg-[#1a1408]', icon: AlertTriangle, iconColor: 'text-[#f3a33a]' },
  opportunity: { ring: 'border-[#1d3a2a] bg-[#0c1813]', icon: TrendingUp, iconColor: 'text-[#43d18b]' },
  info: { ring: 'border-[#1d2733] bg-[#0b1016]', icon: Zap, iconColor: 'text-[#8aa2ff]' },
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
        addLocalWatchItem({ symbol: a.symbol });
        setActed((x) => ({ ...x, [a.id]: 'done' }));
        setUndoIds((u) => ({ ...u, [a.id]: `local-${a.symbol}` }));
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
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-[#8aa2ff]/30 bg-[#101a2e] text-[#8aa2ff]">
          <Zap size={13} />
        </span>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Next best actions</h2>
          <p className="text-[10px] text-[#8190a0]">Your top {actions.length} {actions.length === 1 ? 'priority' : 'priorities'} right now, ranked from your data.</p>
        </div>
      </div>

      <ol className="mt-2.5 space-y-1.5">
        {actions.map((a, i) => {
          const tone = TONE[a.tone] ?? TONE.info;
          const Icon = tone.icon;
          const st = acted[a.id];
          return (
            <li key={a.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${tone.ring}`}>
              <span className="mt-0.5 flex shrink-0 items-center gap-1">
                <span className="font-mono text-[10px] text-[#5e6b78]">{i + 1}</span>
                <Icon size={13} className={tone.iconColor} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-snug text-[#eef3f8]">{a.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-[#8190a0]">{a.detail}</p>
                <div className="mt-1.5">
                  {a.cta?.addWatchlist ? (
                    st === 'done' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#43d18b]">
                        <Check size={12} /> Added to watchlist
                        {undoIds[a.id] && (
                          <button type="button" onClick={() => undo(a)} className="ml-1 inline-flex items-center gap-1 rounded border border-[#3a2630] bg-[#1c1116] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#e08a9a] transition hover:bg-[#26161d]">
                            <Undo2 size={9} /> Undo
                          </button>
                        )}
                      </span>
                    ) : st === 'undone' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#8190a0]"><RotateCcw size={11} /> Undone</span>
                    ) : st === 'demo' ? (
                      <span className="text-[10.5px] text-[#f3a33a]">
                        <Link href="/auth/login" className="underline">Sign in</Link> to save {a.symbol} to your watchlist.
                      </span>
                    ) : (
                      <button type="button" onClick={() => addWatch(a)} disabled={st === 'running'} className="inline-flex items-center gap-1.5 rounded-md border border-[#8aa2ff]/40 bg-[#101a2e] px-2.5 py-1 text-[11px] font-semibold text-[#8aa2ff] transition hover:bg-[#13203a] disabled:opacity-50">
                        {st === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {a.cta.label}
                        {st === 'failed' && <span className="ml-1 text-[#ff8a8a]">retry</span>}
                      </button>
                    )
                  ) : a.cta?.href ? (
                    <Link href={a.cta.href} className="inline-flex items-center gap-1 rounded-md border border-[#263241] bg-[#0d141c] px-2.5 py-1 text-[11px] font-semibold text-[#a8b5c2] transition hover:text-[#eef3f8]">
                      {a.cta.label} <ArrowUpRight size={12} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[8.5px] leading-snug text-[#5e6b78]">Ranked deterministically from your signals, holdings, watchlist and profile - reversible where actionable. Research, not advice.</p>
    </section>
  );
}
