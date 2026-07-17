'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, Lightbulb, Loader2, Plus, X } from 'lucide-react';

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

export function IdeasBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [demo, setDemo] = useState(false);
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
      const res = await fetch('/api/community/ideas', { cache: 'no-store' });
      const data = (await res.json()) as IdeasResponse;
      setIdeas(data.ideas ?? []);
      setSignedIn(Boolean(data.signedIn));
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
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[#9a6a1f] bg-[#23180b] text-[#f3a33a]">
            <Lightbulb size={13} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c8d3de]">Ideas</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#8190a0]">Suggest what to build next - and upvote what you want most.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((s) => !s); setFormNote(null); }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#1d7f55] bg-[#0d251b] px-2.5 py-1.5 text-[11px] font-medium text-[#43d18b] transition hover:bg-[#103626]"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? 'Close' : 'Add your idea'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 border-b border-[#1b2530] bg-[#0b1016] p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="A short title for your idea"
            className="w-full rounded border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 text-[13px] text-[#dbe5ee] outline-none transition focus:border-[#3a4754] focus:ring-1 focus:ring-[#f3a33a]/30"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="What would it do, and why would it help? (optional)"
            className="w-full resize-y rounded border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 text-[13px] leading-relaxed text-[#dbe5ee] outline-none transition focus:border-[#3a4754] focus:ring-1 focus:ring-[#f3a33a]/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#6f7d8a]">{demo ? 'Demo preview - posting needs a signed-in account.' : signedIn ? 'Posts to the public board.' : 'You need to be signed in to post.'}</span>
            <button
              type="button"
              onClick={submitIdea}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded border border-[#1d7f55] bg-[#0d251b] px-3 py-1.5 text-[11px] font-medium text-[#43d18b] transition hover:bg-[#103626] disabled:opacity-40"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Post idea
            </button>
          </div>
          {formNote && <p className="text-[11px] leading-snug text-[#f3a33a]">{formNote}</p>}
        </div>
      )}

      {voteNote && <p className="border-b border-[#1b2530] bg-[#241a0d] px-3 py-2 text-[11px] text-[#f3a33a]">{voteNote}</p>}

      {loading ? (
        <p className="flex items-center gap-2 px-3 py-6 text-[12px] text-[#8190a0]"><Loader2 size={14} className="animate-spin" /> Loading ideas...</p>
      ) : sorted.length === 0 ? (
        <p className="px-3 py-8 text-center text-[12px] text-[#8190a0]">No ideas yet - be the first to add one.</p>
      ) : (
        <ul className="divide-y divide-[#101820]">
          {sorted.map((idea) => {
            const status = STATUS_META[idea.status];
            return (
              <li key={idea.id} className="flex items-start gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[10px] uppercase tracking-[0.1em] text-[#5d6b79]">{fmtDate(idea.createdAt)}</span>
                    {status && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${status.cls}`}>{status.label}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-[#eef3f8]">{idea.title}</p>
                  {idea.description && <p className="mt-0.5 text-[12px] leading-relaxed text-[#a8b5c2]">{idea.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => toggleVote(idea)}
                  aria-pressed={idea.voted}
                  aria-label={idea.voted ? `Remove your vote (${idea.voteCount})` : `Upvote (${idea.voteCount})`}
                  className={`flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 transition ${
                    idea.voted
                      ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]'
                      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754]'
                  }`}
                >
                  <ChevronUp size={15} />
                  <span className="font-mono text-[12px] font-semibold tabular-nums">{idea.voteCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="border-t border-[#1b2530] px-3 py-2 text-[11px] text-[#f0758a]">{error}</p>}
    </section>
  );
}
