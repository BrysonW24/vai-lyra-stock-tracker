'use client';

import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { RELEASE_CATEGORIES, releaseNotes, type ReleaseCategory, type ReleaseNote } from '@/lib/release-notes';
import { relativeTime } from '@/lib/format';

const CATEGORY_TONE: Record<ReleaseCategory, string> = {
  Feature: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  Improvement: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  Mobile: 'border-[#2a4a7a] bg-[#0f1a2c] text-[#7fb0ff]',
  Data: 'border-[#3a4754] bg-[#0d141c] text-[#a8b5c2]',
  Fix: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
};

type Filter = 'All' | ReleaseCategory;

/** Group notes by their week label, preserving manifest order. */
function groupByWeek(notes: ReleaseNote[]): { week: string; notes: ReleaseNote[] }[] {
  const groups: { week: string; notes: ReleaseNote[] }[] = [];
  for (const note of notes) {
    const existing = groups.find((g) => g.week === note.week);
    if (existing) existing.notes.push(note);
    else groups.push({ week: note.week, notes: [note] });
  }
  return groups;
}

export function WhatsNewFeed() {
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return releaseNotes.filter((note) => {
      if (filter !== 'All' && note.category !== filter) return false;
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.description.toLowerCase().includes(q) ||
        (note.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [filter, query]);

  const groups = useMemo(() => groupByWeek(filtered), [filtered]);
  const filters: Filter[] = ['All', ...RELEASE_CATEGORIES];

  return (
    <div className="space-y-3">
      {/* Filter chips + search + count */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {filters.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setFilter(entry)}
              aria-pressed={filter === entry}
              className={[
                'rounded-md border px-2.5 py-1 font-mono text-[11px] transition',
                filter === entry
                  ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                  : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754] hover:text-[#dbe5ee]',
              ].join(' ')}
            >
              {entry}
            </button>
          ))}
        </div>
        <label className="ml-auto flex min-w-[160px] flex-1 items-center gap-2 rounded-md border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 sm:max-w-[260px]">
          <Search size={14} className="text-[#8190a0]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search updates"
            className="min-w-0 flex-1 bg-transparent text-xs text-[#dbe5ee] outline-none placeholder:text-[#5f6b78]"
          />
        </label>
        <span className="font-mono text-[11px] text-[#8190a0]">{filtered.length} updates</span>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-md border border-[#1b2530] bg-[#0d1117] px-3 py-6 text-center text-sm text-[#8190a0]">
          No updates match that filter.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.week} className="space-y-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">{group.week}</h2>
            <div className="space-y-2">
              {group.notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3 transition hover:border-[#263241]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {note.highlight ? (
                      <span className="inline-flex items-center gap-1 rounded border border-[#9a6a1f] bg-[#2a1f0f] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#f3a33a]">
                        <Sparkles size={10} /> Highlight
                      </span>
                    ) : null}
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${CATEGORY_TONE[note.category]}`}>
                      {note.category}
                    </span>
                    {(note.tags ?? []).map((tag) => (
                      <span key={tag} className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0]">
                        {tag}
                      </span>
                    ))}
                    <span className="ml-auto font-mono text-[10px] text-[#5f6b78]">{relativeTime(note.date)}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-[#eef3f8]">{note.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#a8b5c2]">{note.description}</p>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
