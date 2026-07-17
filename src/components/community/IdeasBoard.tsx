'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronUp, ExternalLink, Lightbulb, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { loadAi } from '@/lib/account';

interface IdeaEvidence {
  itemId?: string;
  title: string;
  url: string | null;
  sourceId?: string;
  /** Human source name, enriched at filing time (falls back to sourceId for old cards). */
  sourceName?: string;
  publishedAt?: string | null;
}

interface Idea {
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
  ideas?: Idea[];
  signedIn?: boolean;
  maintainer?: boolean;
  demo?: boolean;
  pendingMigration?: boolean;
  error?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Statuses the maintainer can set; anything else renders as "open" (no badge). */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  planned: { label: 'Planned', cls: 'border-[#2a4a7a] bg-[#0f1a2c] text-[#7fb0ff]' },
  in_progress: { label: 'In progress', cls: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]' },
  shipped: { label: 'Shipped', cls: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]' },
  declined: { label: 'Not planned', cls: 'border-[#3a4754] bg-[#141b23] text-[#8190a0]' },
};

const ALL_STATUSES = ['open', 'planned', 'in_progress', 'shipped', 'declined'];

/** Non-default idea kinds get a chip so scout cards say what they propose. */
const KIND_LABEL: Record<string, string> = {
  vertical: 'New vertical',
  'content-gap': 'Content gap',
  frontend: 'Frontend',
  backend: 'Backend',
};

export function IdeasBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [maintainer, setMaintainer] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formNote, setFormNote] = useState<string | null>(null);
  const [voteNote, setVoteNote] = useState<string | null>(null);
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

  async function loadBrief(idea: Idea) {
    if (briefs[idea.id] !== undefined) return;
    setBriefs((prev) => ({ ...prev, [idea.id]: 'loading' }));
    try {
      const res = await fetch('/api/community/ideas/brief', {
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
        setVoteNote('AI read unavailable right now - the card text above is the deterministic summary.');
        setTimeout(() => setVoteNote(null), 2600);
      }
    } catch {
      setBriefs((prev) => {
        const next = { ...prev };
        delete next[idea.id];
        return next;
      });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/community/ideas', { cache: 'no-store' });
      const data = (await res.json()) as IdeasResponse;
      setIdeas(data.ideas ?? []);
      setSignedIn(Boolean(data.signedIn));
      setMaintainer(Boolean(data.maintainer));
      setDemo(Boolean(data.demo));
      if (!data.ok) setError(data.error ?? 'Could not load ideas.');
    } catch {
      setError('Could not reach the ideas board.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(
    () => [...ideas].sort((a, b) => b.voteCount - a.voteCount || +new Date(b.createdAt) - +new Date(a.createdAt)),
    [ideas],
  );

  async function toggleVote(idea: Idea) {
    if (demo) {
      setVoteNote('Voting is disabled in the demo - sign in to vote.');
      setTimeout(() => setVoteNote(null), 2600);
      return;
    }
    // Optimistic flip; revert on failure.
    const nextVoted = !idea.voted;
    setIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, voted: nextVoted, voteCount: i.voteCount + (nextVoted ? 1 : -1) } : i)),
    );
    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id }),
      });
      const data = (await res.json()) as { ok?: boolean; voted?: boolean; voteCount?: number; error?: string };
      if (!res.ok || !data.ok) {
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i))); // revert
        setVoteNote(data.error ?? (res.status === 401 ? 'Sign in to vote.' : 'Could not save your vote.'));
        setTimeout(() => setVoteNote(null), 2600);
        return;
      }
      // Reconcile with the server's authoritative tally.
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, voted: Boolean(data.voted), voteCount: Number(data.voteCount ?? i.voteCount) } : i)));
    } catch {
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)));
      setVoteNote('Could not reach the server.');
      setTimeout(() => setVoteNote(null), 2600);
    }
  }

  async function setStatus(idea: Idea, status: string) {
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
        setVoteNote(data.error ?? 'Could not update status.');
        setTimeout(() => setVoteNote(null), 2600);
      }
    } catch {
      setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, status: prev } : i)));
      setVoteNote('Could not reach the server.');
      setTimeout(() => setVoteNote(null), 2600);
    }
  }

  async function submitIdea() {
    setFormNote(null);
    const t = title.trim();
    if (t.length < 3) {
      setFormNote('Give your idea a short title (at least 3 characters).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/community/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, description: description.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; idea?: Idea; error?: string };
      if (!res.ok || !data.ok || !data.idea) {
        setFormNote(data.error ?? (res.status === 401 ? 'Sign in to post an idea.' : 'Could not post your idea.'));
        return;
      }
      setIdeas((prev) => [data.idea!, ...prev]);
      setTitle('');
      setDescription('');
      setShowForm(false);
    } catch {
      setFormNote('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="terminal-panel overflow-hidden rounded-lg">
      {/*
       * No panel header here on purpose: the tab is already labelled "Ideas" and the hero
       * already frames it. This toolbar carries functional state (count + sort order) instead
       * of repeating the same sentence a third time.
       */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1b2530]/70 px-3 py-2">
        <p className="min-w-0 truncate text-[11px] text-[#8190a0]">
          {sorted.length > 0 ? (
            <>
              <span className="font-mono text-[#c8d3de]">{sorted.length}</span> {sorted.length === 1 ? 'idea' : 'ideas'}
              <span className="text-[#4c5866]"> · </span>most wanted first
            </>
          ) : (
            'Suggest what to build next'
          )}
        </p>
        <button
          type="button"
          onClick={() => { setShowForm((s) => !s); setFormNote(null); }}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-[#1d7f55]/80 bg-[#0d251b]/80 px-2.5 text-[11px] font-medium text-[#43d18b] transition hover:border-[#25a06c] hover:bg-[#103626]/90"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? 'Close' : 'Add your idea'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 border-b border-[#1b2530]/70 bg-[#080b10]/50 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="A short title for your idea"
            className="glass-well w-full rounded-md px-2.5 py-2 text-[13px] text-[#dbe5ee] outline-none transition focus:border-[#9a6a1f]/60 focus:ring-1 focus:ring-[#f3a33a]/25"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="What would it do, and why would it help? (optional)"
            className="glass-well w-full resize-y rounded-md px-2.5 py-2 text-[13px] leading-relaxed text-[#dbe5ee] outline-none transition focus:border-[#9a6a1f]/60 focus:ring-1 focus:ring-[#f3a33a]/25"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#6f7d8a]">{demo ? 'Demo preview - posting needs a signed-in account.' : signedIn ? 'Posts to the public board.' : 'You need to be signed in to post.'}</span>
            <button
              type="button"
              onClick={submitIdea}
              disabled={submitting}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#1d7f55]/80 bg-[#0d251b]/80 px-3 text-[11px] font-medium text-[#43d18b] transition hover:bg-[#103626]/90 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Post idea
            </button>
          </div>
          {formNote && <p className="text-[11px] leading-snug text-[#f3a33a]">{formNote}</p>}
        </div>
      )}

      {voteNote && <p className="border-b border-[#1b2530]/70 bg-[#241a0d]/80 px-3 py-2 text-[11px] text-[#f3a33a]">{voteNote}</p>}

      {loading ? (
        <p className="flex items-center gap-2 px-3 py-6 text-[12px] text-[#8190a0]"><Loader2 size={14} className="animate-spin" /> Loading ideas...</p>
      ) : sorted.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-[#9a6a1f]/50 bg-[#23180b]/60 text-[#f3a33a]">
            <Lightbulb size={16} />
          </span>
          <p className="mt-2.5 text-[12px] text-[#8190a0]">No ideas yet - be the first to add one.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#101820]/80">
          {sorted.map((idea) => {
            const status = STATUS_META[idea.status];
            return (
              <li key={idea.id} className="glass-row flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#5d6b79]">{fmtDate(idea.createdAt)}</span>
                    {idea.origin === 'scout' && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-[#2a4a7a] bg-[#0f1a2c] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#7fb0ff]"
                        title="Raised automatically by the AI scout from recurring unmapped news signal. Nothing changes unless a human accepts it."
                      >
                        <Bot size={9} /> Scout{typeof idea.confidence === 'number' ? ` ${idea.confidence}` : ''}
                      </span>
                    )}
                    {KIND_LABEL[idea.kind] && (
                      <span className="rounded-full border border-[#3a4754] bg-[#141b23] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#a8b5c2]">
                        {KIND_LABEL[idea.kind]}
                      </span>
                    )}
                    {status && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${status.cls}`}>{status.label}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-[#eef3f8]">{idea.title}</p>
                  {idea.description && <p className="mt-0.5 text-[12px] leading-relaxed text-[#98a6b4]">{idea.description}</p>}
                  {idea.origin === 'scout' && idea.kind === 'vertical' && (idea.status === 'planned' || idea.status === 'in_progress') && (
                    <p className="mt-1 text-[10px] leading-snug text-[#7fb0ff]">
                      {idea.status === 'planned'
                        ? 'Queued for drafting - the next agent session builds this vertical as a reviewable PR (/draft-vertical).'
                        : 'Being drafted - a vertical PR is in flight for this card.'}
                    </p>
                  )}
                  {typeof briefs[idea.id] === 'string' && briefs[idea.id] !== 'loading' && (
                    <div className="mt-1.5 border-l-2 border-[#9a6a1f]/60 bg-[#13100a]/60 py-1 pl-2 pr-1">
                      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#f3a33a]"><Sparkles size={10} /> Lyra&apos;s read - grounded in the evidence below</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[#dbe5ee]">{briefs[idea.id]}</p>
                    </div>
                  )}
                  {idea.origin === 'scout' && idea.evidence.length > 0 && aiAvailable && !demo && briefs[idea.id] === undefined && (
                    <button
                      type="button"
                      onClick={() => loadBrief(idea)}
                      className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 rounded border border-[#9a6a1f]/50 bg-[#23180b]/60 px-2 text-[10px] font-medium text-[#f3a33a] transition hover:border-[#9a6a1f] hover:bg-[#2a1f0f]"
                    >
                      <Sparkles size={11} /> AI read of this signal
                    </button>
                  )}
                  {briefs[idea.id] === 'loading' && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8190a0]"><Loader2 size={11} className="animate-spin" /> Reading the evidence...</p>
                  )}
                  {idea.evidence.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {(expandedEvidence.has(idea.id) ? idea.evidence : idea.evidence.slice(0, 4)).map((ev, i) => (
                        <li key={`${idea.id}-ev-${i}`} className="flex items-start gap-1 text-[11px] leading-snug text-[#8190a0]">
                          <ExternalLink size={10} className="mt-0.5 shrink-0 text-[#5d6b79]" />
                          <span className="min-w-0">
                            {ev.url ? (
                              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="underline decoration-[#3a4754] underline-offset-2 transition hover:text-[#c8d3de]">
                                {ev.title}
                              </a>
                            ) : (
                              <span>{ev.title}</span>
                            )}
                            {(ev.sourceName || ev.sourceId || ev.publishedAt) && (
                              <span className="text-[#5d6b79]">
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
                            className="min-h-[32px] text-[10px] font-medium text-[#5d6b79] underline decoration-[#3a4754] underline-offset-2 transition hover:text-[#c8d3de]"
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
                              ? 'border-[#43d18b] bg-[#0c1f16] text-[#5fd08a]'
                              : 'border-[#263241] bg-[#0d141c] text-[#6f7d8a] hover:text-[#c8d3de]'
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
                      ? 'border-[#1d7f55]/80 bg-[#0d251b]/80 text-[#43d18b] shadow-[0_6px_16px_-8px_rgba(67,209,139,0.55)]'
                      : 'glass-well text-[#a8b5c2] hover:border-[#3a4754] hover:text-[#eef3f8]'
                  }`}
                >
                  <ChevronUp size={15} className={idea.voted ? '' : 'text-[#6f7d8a]'} />
                  <span className="font-mono text-[12px] font-semibold tabular-nums leading-none">{idea.voteCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="border-t border-[#1b2530]/70 px-3 py-2 text-[11px] text-[#f0758a]">{error}</p>}
    </section>
  );
}
