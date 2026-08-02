'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronUp, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { loadAi } from '@/lib/account';
import { communityApiBase, communityParticipantKey, communityStoredKey, forgetCommunityKey } from '@/lib/community';

/**
 * The AI scout's proposal cards - external build signals promoted from recurring unmapped
 * news drumbeats. These used to share the Ideas board; they live HERE now because they are
 * perception, not community wishes: the Ideas tab is purely what people want built inside
 * Lyra, this list is what the world is signalling Lyra could become. Same community_ideas
 * table underneath (origin='scout'), same voting, same maintainer promotion flow
 * (accept -> planned -> /draft-vertical).
 */

interface IdeaEvidence {
  itemId?: string;
  title: string;
  url: string | null;
  sourceId?: string;
  /** Human source name, enriched at filing time (falls back to sourceId for old cards). */
  sourceName?: string;
  publishedAt?: string | null;
}

interface ScoutIdea {
  id: string;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  createdAt: string;
  voted: boolean;
  origin: string;
  kind: string;
  evidence: IdeaEvidence[];
  confidence: number | null;
}

interface IdeasResponse {
  ok: boolean;
  ideas?: ScoutIdea[];
  maintainer?: boolean;
  error?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  planned: { label: 'Planned', cls: 'border-blue-focus/40 bg-blue-tint text-blue-info' },
  in_progress: { label: 'In progress', cls: 'border-accent-border bg-accent-tint text-accent' },
  shipped: { label: 'Shipped', cls: 'border-positive/40 bg-positive-tint text-positive' },
  declined: { label: 'Not planned', cls: 'border-line-hair bg-panel text-ink-3' },
};

const ALL_STATUSES = ['open', 'planned', 'in_progress', 'shipped', 'declined'];

/** Non-default idea kinds get a chip so scout cards say what they propose. */
const KIND_LABEL: Record<string, string> = {
  vertical: 'New vertical',
  'content-gap': 'Content gap',
  frontend: 'Frontend',
  backend: 'Backend',
};

export function ScoutProposals() {
  const [ideas, setIdeas] = useState<ScoutIdea[]>([]);
  const [maintainer, setMaintainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  // AI reads per scout card: undefined = not asked, 'loading', or the grounded text.
  const [briefs, setBriefs] = useState<Record<string, 'loading' | string>>({});
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    // Same availability check the daily brief uses: BYOK wins, OpenAI/Google may be
    // server-backed - the route decides without exposing key presence to the bundle.
    const ai = loadAi();
    setAiAvailable(Boolean(ai.apiKey?.trim()) || ai.provider === 'openai' || ai.provider === 'google');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Peek only - a visitor who never votes should never cost a key issuance.
        const vk = communityStoredKey();
        const res = await fetch(`${communityApiBase()}/api/community/ideas?origin=scout${vk ? `&vk=${encodeURIComponent(vk)}` : ''}`, { cache: 'no-store' });
        const data = (await res.json()) as IdeasResponse;
        if (cancelled) return;
        setIdeas(data.ideas ?? []);
        setMaintainer(Boolean(data.maintainer));
      } catch {
        // The feed below still renders; proposals are additive.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(
    () => [...ideas].sort((a, b) => b.voteCount - a.voteCount || +new Date(b.createdAt) - +new Date(a.createdAt)),
    [ideas],
  );

  function flashNote(text: string) {
    setNote(text);
    setTimeout(() => setNote(null), 2600);
  }

  async function loadBrief(idea: ScoutIdea) {
    if (briefs[idea.id] !== undefined) return;
    setBriefs((prev) => ({ ...prev, [idea.id]: 'loading' }));
    try {
      // The brief grounds on the card's server-side evidence row, so it must ask the origin
      // that HAS the row - on Lyra Solo that is the canonical board, not this deployment.
      const res = await fetch(`${communityApiBase()}/api/community/ideas/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id, ai: loadAi() }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string };
      setBriefs((prev) => {
        const next = { ...prev };
        if (data.ok && data.text) next[idea.id] = data.text;
        else delete next[idea.id]; // fall back to the template description silently
        return next;
      });
      if (!data.ok || !data.text) {
        flashNote('AI read unavailable right now - the card text above is the deterministic summary.');
      }
    } catch {
      setBriefs((prev) => {
        const next = { ...prev };
        delete next[idea.id];
        return next;
      });
    }
  }

  async function toggleVote(idea: ScoutIdea) {
    const nextVoted = !idea.voted;
    setIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, voted: nextVoted, voteCount: i.voteCount + (nextVoted ? 1 : -1) } : i)),
    );
    try {
      const vk = await communityParticipantKey();
      if (!vk) {
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)));
        flashNote('Could not reach the board - check your connection and try again.');
        return;
      }
      const res = await fetch(`${communityApiBase()}/api/community/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id, vk }),
      });
      const data = (await res.json()) as { ok?: boolean; voted?: boolean; voteCount?: number; error?: string; badKey?: boolean };
      if (!res.ok || !data.ok) {
        if (data.badKey) forgetCommunityKey(); // stale key (e.g. secret rotation) - next tap re-issues
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)));
        flashNote(data.error ?? 'Could not save your vote.');
        return;
      }
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, voted: Boolean(data.voted), voteCount: Number(data.voteCount ?? i.voteCount) } : i)));
    } catch {
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)));
      flashNote('Could not reach the server.');
    }
  }

  async function setStatus(idea: ScoutIdea, status: string) {
    const prev = idea.status;
    setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, status } : i)));
    try {
      const res = await fetch('/api/community/ideas/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id, status }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, status: prev } : i)));
        flashNote(data.error ?? 'Could not update status.');
      }
    } catch {
      setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, status: prev } : i)));
      flashNote('Could not reach the server.');
    }
  }

  // Nothing filed yet: stay out of the way - the perception feed below is the story.
  if (!loading && sorted.length === 0) return null;

  return (
    <section className="terminal-panel overflow-hidden rounded-lg">
      <div className="border-b border-line/70 px-3 py-2">
        <p className="text-[11px] text-ink-3">
          <span className="font-semibold text-blue-info">Scout proposals</span>
          <span className="text-ink-dim"> · </span>signals strong enough to file - nothing changes unless a human accepts one
        </p>
      </div>

      {note && <p className="border-b border-line/70 bg-accent-tint/80 px-3 py-2 text-[11px] text-accent">{note}</p>}

      {loading ? (
        <p className="flex items-center gap-2 px-3 py-4 text-[12px] text-ink-3"><Loader2 size={14} className="animate-spin" /> Loading proposals...</p>
      ) : (
        <ul className="divide-y divide-panel-deep/80">
          {sorted.map((idea) => {
            const status = STATUS_META[idea.status];
            return (
              <li key={idea.id} className="glass-row flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">{fmtDate(idea.createdAt)}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-blue-focus/40 bg-blue-tint px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-blue-info"
                      title="Raised automatically by the AI scout from recurring unmapped news signal. Nothing changes unless a human accepts it."
                    >
                      <Bot size={9} /> Scout{typeof idea.confidence === 'number' ? ` ${idea.confidence}` : ''}
                    </span>
                    {KIND_LABEL[idea.kind] && (
                      <span className="rounded-full border border-line-hair bg-panel px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-2">
                        {KIND_LABEL[idea.kind]}
                      </span>
                    )}
                    {status && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${status.cls}`}>{status.label}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">{idea.title}</p>
                  {idea.description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{idea.description}</p>}
                  {idea.kind === 'vertical' && (idea.status === 'planned' || idea.status === 'in_progress') && (
                    <p className="mt-1 text-[10px] leading-snug text-blue-info">
                      {idea.status === 'planned'
                        ? 'Queued for drafting - the next agent session builds this vertical as a reviewable PR (/draft-vertical).'
                        : 'Being drafted - a vertical PR is in flight for this card.'}
                    </p>
                  )}
                  {typeof briefs[idea.id] === 'string' && briefs[idea.id] !== 'loading' && (
                    <div className="mt-1.5 border-l-2 border-accent-border/60 bg-accent-tint/40 py-1 pl-2 pr-1">
                      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent"><Sparkles size={10} /> Lyra&apos;s read - grounded in the evidence below</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-title">{briefs[idea.id]}</p>
                    </div>
                  )}
                  {idea.evidence.length > 0 && aiAvailable && briefs[idea.id] === undefined && (
                    <button
                      type="button"
                      onClick={() => loadBrief(idea)}
                      className="mt-1.5 inline-flex min-h-[44px] items-center gap-1 rounded border border-accent-border/50 bg-accent-tint/60 px-2 text-[10px] font-medium text-accent transition hover:border-accent-border hover:bg-accent-tint sm:min-h-[32px]"
                    >
                      <Sparkles size={11} /> AI read of this signal
                    </button>
                  )}
                  {briefs[idea.id] === 'loading' && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-3"><Loader2 size={11} className="animate-spin" /> Reading the evidence...</p>
                  )}
                  {idea.evidence.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {(expandedEvidence.has(idea.id) ? idea.evidence : idea.evidence.slice(0, 4)).map((ev, i) => (
                        <li key={`${idea.id}-ev-${i}`} className="flex items-start gap-1 text-[11px] leading-snug text-ink-3">
                          <ExternalLink size={10} className="mt-0.5 shrink-0 text-ink-dim" />
                          <span className="min-w-0">
                            {ev.url ? (
                              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line-hair underline-offset-2 transition hover:text-ink-title">
                                {ev.title}
                              </a>
                            ) : (
                              <span>{ev.title}</span>
                            )}
                            {(ev.sourceName || ev.sourceId || ev.publishedAt) && (
                              <span className="text-ink-dim">
                                {' '}- {ev.sourceName || ev.sourceId}
                                {ev.publishedAt && <> · {fmtDate(ev.publishedAt)}</>}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                      {idea.evidence.length > 4 && (
                        <li>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEvidence((prev) => {
                                const next = new Set(prev);
                                if (next.has(idea.id)) next.delete(idea.id);
                                else next.add(idea.id);
                                return next;
                              })
                            }
                            className="min-h-[44px] text-[10px] font-medium text-ink-dim underline decoration-line-hair underline-offset-2 transition hover:text-ink-title sm:min-h-[32px]"
                          >
                            {expandedEvidence.has(idea.id) ? 'Show fewer evidence links' : `+ ${idea.evidence.length - 4} more evidence links`}
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                  {maintainer && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {ALL_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(idea, s)}
                          disabled={idea.status === s}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] transition ${
                            idea.status === s
                              ? 'border-positive bg-positive-tint text-positive'
                              : 'border-line-strong bg-panel text-ink-dim hover:text-ink-title'
                          }`}
                        >
                          {STATUS_META[s]?.label ?? 'Open'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleVote(idea)}
                  aria-pressed={idea.voted}
                  aria-label={idea.voted ? `Remove your vote (${idea.voteCount})` : `Upvote (${idea.voteCount})`}
                  className={`flex min-h-[44px] w-[46px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border transition active:scale-[0.96] motion-reduce:active:scale-100 ${
                    idea.voted
                      ? 'border-positive/50 bg-positive-tint/80 text-positive shadow-[0_6px_16px_-8px_rgba(67,209,139,0.55)]'
                      : 'glass-well text-ink-2 hover:border-line-hair hover:text-ink'
                  }`}
                >
                  <ChevronUp size={15} className={idea.voted ? '' : 'text-ink-dim'} />
                  <span className="font-mono text-[12px] font-semibold tabular-nums leading-none">{idea.voteCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
