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
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Version history</p>
        <span className="rounded-full border border-[#1d7f55] bg-[#0d251b] px-2 py-0.5 font-mono text-[10px] text-[#43d18b]">
          You are on v{APP_VERSION}
        </span>
      </div>

      <div className="border-b border-[#1b2530] px-3 py-2">
        <div className="flex items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-2.5 py-1.5">
          <Search size={13} className="shrink-0 text-[#6f7d8a]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search updates"
            className="w-full bg-transparent text-[13px] text-[#dbe5ee] outline-none placeholder:text-[#6f7d8a]"
          />
          <span className="shrink-0 font-mono text-[10px] text-[#6f7d8a]">{filtered.length} of {RELEASES.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-3 py-8 text-center text-[12px] text-[#8190a0]">No updates match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ol className="divide-y divide-[#101820]">
          {filtered.map((rel) => (
            <li key={rel.version} className="px-3 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-sm font-semibold text-[#eef3f8]">v{rel.version}</span>
                {rel.version === APP_VERSION && (
                  <span className="rounded-full border border-[#1d7f55] bg-[#0d251b] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#43d18b]">
                    Current
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#5d6b79]">{rel.date}</span>
                <span className="text-[11px] text-[#a8b5c2]">- {rel.title}</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {rel.highlights.map((h, j) => (
                  <li key={j} className="flex gap-1.5 text-[11px] leading-relaxed text-[#a8b5c2]">
                    <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[#60a5fa]" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
