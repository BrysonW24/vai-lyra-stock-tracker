'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, Lightbulb, Loader2, Plus, X } from 'lucide-react';
import { communityApiBase, communityParticipantKey, communityStoredKey, forgetCommunityKey } from '@/lib/community';

/**
 * The community Ideas board - purely what people want built INSIDE Lyra. External build
 * signals (news, funding rounds, world events) never appear here: those are the AI scout's
 * business and live on the Scout tab. One global board for every surface: deployments
 * without their own Supabase (Lyra Solo) read and write the canonical prod board
 * cross-origin, and nobody needs an account to post or vote - a per-device key keeps
 * votes honest.
 */

interface Idea {
  id: string;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  createdAt: string;
  voted: boolean;
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
  planned: { label: 'Planned', cls: 'border-blue-focus/40 bg-blue-tint text-blue-info' },
  in_progress: { label: 'In progress', cls: 'border-accent-border bg-accent-tint text-accent' },
  shipped: { label: 'Shipped', cls: 'border-positive/40 bg-positive-tint text-positive' },
  declined: { label: 'Not planned', cls: 'border-line-hair bg-panel text-ink-3' },
};

const ALL_STATUSES = ['open', 'planned', 'in_progress', 'shipped', 'declined'];

export function IdeasBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [maintainer, setMaintainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formNote, setFormNote] = useState<string | null>(null);
  const [voteNote, setVoteNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const base = communityApiBase();
      // Peek only - a visitor who never votes should never cost a key issuance.
      const vk = communityStoredKey();
      const res = await fetch(`${base}/api/community/ideas${vk ? `?vk=${encodeURIComponent(vk)}` : ''}`, { cache: 'no-store' });
      const data = (await res.json()) as IdeasResponse;
      setIdeas(data.ideas ?? []);
      setSignedIn(Boolean(data.signedIn));
      setMaintainer(Boolean(data.maintainer));
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
    // Optimistic flip; revert on failure.
    const nextVoted = !idea.voted;
    setIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, voted: nextVoted, voteCount: i.voteCount + (nextVoted ? 1 : -1) } : i)),
    );
    try {
      const vk = await communityParticipantKey();
      if (!vk) {
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)));
        setVoteNote('Could not reach the board - check your connection and try again.');
        setTimeout(() => setVoteNote(null), 2600);
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
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i))); // revert
        setVoteNote(data.error ?? 'Could not save your vote.');
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
      const vk = await communityParticipantKey();
      if (!vk) {
        setFormNote('Could not reach the board - check your connection and try again.');
        return;
      }
      const res = await fetch(`${communityApiBase()}/api/community/ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, description: description.trim(), vk }),
      });
      const data = (await res.json()) as { ok?: boolean; idea?: Idea; error?: string; badKey?: boolean };
      if (!res.ok || !data.ok || !data.idea) {
        if (data.badKey) forgetCommunityKey();
        setFormNote(data.error ?? 'Could not post your idea.');
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
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3 py-2">
        <p className="min-w-0 truncate text-[11px] text-ink-3">
          {sorted.length > 0 ? (
            <>
              <span className="font-mono text-ink-title">{sorted.length}</span> {sorted.length === 1 ? 'idea' : 'ideas'}
              <span className="text-ink-dim"> · </span>most wanted first
            </>
          ) : (
            'Suggest what to build next'
          )}
        </p>
        <button
          type="button"
          onClick={() => { setShowForm((s) => !s); setFormNote(null); }}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-positive/50 bg-positive-tint/80 px-2.5 text-[11px] font-medium text-positive transition hover:border-positive/70 hover:bg-positive/15 sm:min-h-[36px]"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? 'Close' : 'Add your idea'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 border-b border-line/70 bg-well/50 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="A short title for your idea"
            className="glass-well w-full rounded-md px-2.5 py-2 text-[13px] text-ink-title outline-none transition focus:border-accent-border/60 focus:ring-1 focus:ring-blue-focus/25"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="What would it do, and why would it help? (optional)"
            className="glass-well w-full resize-y rounded-md px-2.5 py-2 text-[13px] leading-relaxed text-ink-title outline-none transition focus:border-accent-border/60 focus:ring-1 focus:ring-blue-focus/25"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-ink-dim">{signedIn ? 'Posts to the public board.' : 'Posts to the public board - no account needed.'}</span>
            <button
              type="button"
              onClick={submitIdea}
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-positive/50 bg-positive-tint/80 px-3 text-[11px] font-medium text-positive transition hover:bg-positive/15 disabled:opacity-40 sm:min-h-[36px]"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Post idea
            </button>
          </div>
          {formNote && <p className="text-[11px] leading-snug text-accent">{formNote}</p>}
        </div>
      )}

      {voteNote && <p className="border-b border-line/70 bg-accent-tint/80 px-3 py-2 text-[11px] text-accent">{voteNote}</p>}

      {loading ? (
        <p className="flex items-center gap-2 px-3 py-6 text-[12px] text-ink-3"><Loader2 size={14} className="animate-spin" /> Loading ideas...</p>
      ) : sorted.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-accent-border/50 bg-accent-tint/60 text-accent">
            <Lightbulb size={16} />
          </span>
          <p className="mt-2.5 text-[12px] text-ink-3">No ideas yet - be the first to add one.</p>
        </div>
      ) : (
        <ul className="divide-y divide-panel-deep/80">
          {sorted.map((idea) => {
            const status = STATUS_META[idea.status];
            return (
              <li key={idea.id} className="glass-row flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">{fmtDate(idea.createdAt)}</span>
                    {status && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${status.cls}`}>{status.label}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">{idea.title}</p>
                  {idea.description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{idea.description}</p>}
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
      {error && <p className="border-t border-line/70 px-3 py-2 text-[11px] text-negative-soft">{error}</p>}
    </section>
  );
}
