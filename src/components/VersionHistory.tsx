import { APP_VERSION, RELEASES } from '@/lib/version';

/**
 * The version-numbered changelog, rendered in-app at /whats-new. Each release shows its version, date,
 * theme and user-facing highlights, newest first - so anyone (the founder dogfooding now, users later)
 * can track exactly what changed in each version. Source of truth: src/lib/version.ts.
 */
export function VersionHistory() {
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Version history</p>
        <span className="rounded-full border border-[#1d7f55] bg-[#0d251b] px-2 py-0.5 font-mono text-[10px] text-[#43d18b]">
          You are on v{APP_VERSION}
        </span>
      </div>

      <ol className="divide-y divide-[#101820]">
        {RELEASES.map((rel, i) => (
          <li key={rel.version} className="px-3 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-sm font-semibold text-[#eef3f8]">v{rel.version}</span>
              {i === 0 && (
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
    </section>
  );
}
