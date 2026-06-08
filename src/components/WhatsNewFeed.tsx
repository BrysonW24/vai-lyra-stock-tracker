'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Database, Search, Smartphone, Sparkles, Wrench } from 'lucide-react';
import { RELEASE_CATEGORIES, releaseNotes, type ReleaseCategory } from '@/lib/release-notes';
import { relativeTime } from '@/lib/format';

const CATEGORY_TONE: Record<ReleaseCategory, string> = {
  Feature: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  Improvement: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  Mobile: 'border-[#2a4a7a] bg-[#0f1a2c] text-[#7fb0ff]',
  Data: 'border-[#4c3a7a] bg-[#170f29] text-[#a78bfa]',
  Fix: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
};

/** The solid dot colour on the timeline chain - one colour per build type. */
const CATEGORY_DOT: Record<ReleaseCategory, string> = {
  Feature: '#43d18b', // green - new capability
  Improvement: '#f3a33a', // amber - refinement
  Mobile: '#7fb0ff', // blue - mobile
  Data: '#a78bfa', // purple - data
  Fix: '#f0758a', // red - fix
};

const CATEGORY_ICON: Record<ReleaseCategory, typeof Sparkles> = {
  Feature: Sparkles,
  Improvement: ArrowUpRight,
  Mobile: Smartphone,
  Data: Database,
  Fix: Wrench,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Format an ISO date as "8 Jun 2026" without timezone drift. */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

type Filter = 'All' | ReleaseCategory;

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

  const filters: Filter[] = ['All', ...RELEASE_CATEGORIES];

  return (
    <div className="space-y-3">
      {/* Filter chips (the colour dot doubles as the legend) + search + count */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {filters.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setFilter(entry)}
              aria-pressed={filter === entry}
              className={[
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition',
                filter === entry
                  ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                  : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754] hover:text-[#dbe5ee]',
              ].join(' ')}
            >
              {entry !== 'All' && (
                <span className="h-1 w-1 rounded-full" style={{ background: CATEGORY_DOT[entry] }} />
              )}
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

      {filtered.length === 0 ? (
        <p className="rounded-md border border-[#1b2530] bg-[#0d1117] px-3 py-6 text-center text-sm text-[#8190a0]">
          No updates match that filter.
        </p>
      ) : (
        <div className="relative">
          {/* The chain - one continuous line running down the left rail */}
          <span className="absolute bottom-3 left-2 top-3 w-px bg-[#1b2530]" aria-hidden />
          <div className="space-y-2">
            {filtered.map((note) => {
              const Icon = CATEGORY_ICON[note.category];
              const dot = CATEGORY_DOT[note.category];
              return (
                <article key={note.id} className="relative flex gap-3">
                  {/* The dot on the chain, filled with the build-type colour */}
                  <div className="flex w-4 shrink-0 justify-center pt-3">
                    <span
                      className="relative z-10 h-3 w-3 rounded-full ring-2 ring-[#080a0d]"
                      style={{ background: dot, boxShadow: note.highlight ? `0 0 7px ${dot}` : undefined }}
                      title={note.category}
                    />
                  </div>
                  {/* The card */}
                  <div className="min-w-0 flex-1 rounded-md border border-[#1b2530] bg-[#0d1117] p-2.5 transition hover:border-[#263241]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-[#dbe5ee]">{fmtDate(note.date)}</span>
                      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${CATEGORY_TONE[note.category]}`}>
                        <Icon size={9} /> {note.category}
                      </span>
                      {note.highlight ? (
                        <span className="inline-flex items-center gap-1 rounded border border-[#9a6a1f] bg-[#2a1f0f] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#f3a33a]">
                          <Sparkles size={9} /> Highlight
                        </span>
                      ) : null}
                      {(note.tags ?? []).map((tag) => (
                        <span key={tag} className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0]">
                          {tag}
                        </span>
                      ))}
                      <span className="ml-auto font-mono text-[10px] text-[#5f6b78]">{relativeTime(note.date)}</span>
                    </div>
                    <h3 className="mt-1 text-[13px] font-semibold text-[#eef3f8]">{note.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{note.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
