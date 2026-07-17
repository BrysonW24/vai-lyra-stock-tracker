'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { APP_VERSION, RELEASES } from '@/lib/version';

/**
 * The single, authoritative product-updates timeline - generated straight from RELEASES in
 * src/lib/version.ts, so it can never drift from what actually shipped. Searchable across version,
 * title and highlights. This replaces the old two-surface setup (a version list + a separate,
 * hand-maintained feed that had gone stale) with one source of truth.
 */
export function ProductUpdatesTimeline() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RELEASES;
    return RELEASES.filter((r) =>
      [`v${r.version}`, r.title, ...r.highlights].join(' ').toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <section className="terminal-panel overflow-hidden rounded-lg">
      {/* Slim search toolbar. No "Version history" header and no "you are on vX" chip: the
          hero above already names the surface and carries the live version. */}
      <div className="border-b border-[#1b2530]/70 px-3 py-2">
        <div className="glass-well flex items-center gap-2 rounded-md px-2.5 py-2 transition focus-within:border-[#9a6a1f]/60 focus-within:ring-1 focus-within:ring-[#f3a33a]/25">
          <Search size={13} className="shrink-0 text-[#6f7d8a]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search updates"
            aria-label="Search updates"
            className="w-full bg-transparent text-[13px] text-[#dbe5ee] outline-none placeholder:text-[#6f7d8a]"
          />
          <span className="shrink-0 font-mono text-[10px] text-[#6f7d8a]">{filtered.length}/{RELEASES.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-3 py-10 text-center text-[12px] text-[#8190a0]">No updates match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ol className="relative divide-y divide-[#101820]/80">
          {/* Chronology rail - one continuous hairline threading every release node. */}
          <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-gradient-to-b from-[#2b3947] via-[#1b2530] to-transparent" />
          {filtered.map((rel) => {
            const current = rel.version === APP_VERSION;
            return (
              <li key={rel.version} className="glass-row relative py-2.5 pl-9 pr-3">
                {/* Release node - the current build gets an amber pulse-free halo. */}
                <span
                  aria-hidden
                  className={`absolute left-[13px] top-[15px] h-2 w-2 rounded-full ring-4 ring-[#0d1117] ${
                    current ? 'bg-[#f3a33a] shadow-[0_0_10px_2px_rgba(243,163,58,0.55)]' : 'bg-[#3a4754]'
                  }`}
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`font-mono text-sm font-semibold ${current ? 'text-[#f3a33a]' : 'text-[#eef3f8]'}`}>v{rel.version}</span>
                  {current && (
                    <span className="rounded-full border border-[#1d7f55]/70 bg-[#0d251b]/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#43d18b]">
                      Current
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5d6b79]">{rel.date}</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#c8d3de]">{rel.title}</p>
                <ul className="mt-1.5 space-y-1">
                  {rel.highlights.map((h, j) => (
                    <li key={j} className="flex gap-1.5 text-[11px] leading-relaxed text-[#98a6b4]">
                      <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#60a5fa]/70" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
