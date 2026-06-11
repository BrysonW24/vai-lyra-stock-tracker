'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Compass } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { ACTION_TONE, SIZE_LABEL } from '@/lib/world-radar';
import type { ScoredCompany, SmallCapBucket } from '@/lib/world-radar';

const AVOID_BUCKET = 'Avoid - dilution/hype risk';
const EMERGING_BUCKET = 'Emerging opportunities';

interface ThemeMeta {
  name: string;
  emoji: string;
}

interface SmallCapDiscoveryProps {
  buckets: SmallCapBucket[];
  themesBySlug: Record<string, ThemeMeta>;
}

/** Deterministic tone for the 0-100 opportunity total. */
function scoreTone(total: number): string {
  if (total >= 72) return 'text-[#43d18b]';
  if (total >= 58) return 'text-[#f3a33a]';
  if (total >= 45) return 'text-[#a8b5c2]';
  return 'text-[#f0758a]';
}

interface CompanyRowProps {
  company: ScoredCompany;
  theme: ThemeMeta;
  open: boolean;
  onToggle: () => void;
}

function CompanyRow({ company, theme, open, onToggle }: CompanyRowProps) {
  const s = company.score;
  const breakdown: { label: string; value: string; tone: string }[] = [
    { label: 'Theme fit', value: String(s.themeFit), tone: 'text-[#eef3f8]' },
    { label: 'Bottleneck', value: String(s.bottleneck), tone: 'text-[#eef3f8]' },
    { label: 'Evidence', value: String(s.evidence), tone: 'text-[#eef3f8]' },
    { label: 'Momentum', value: String(s.momentum), tone: 'text-[#eef3f8]' },
    { label: 'Quality', value: String(s.financialQuality), tone: 'text-[#eef3f8]' },
    { label: 'Liquidity', value: String(s.liquidity), tone: 'text-[#eef3f8]' },
    { label: 'Capital', value: String(s.capitalFlow), tone: 'text-[#eef3f8]' },
    { label: 'Penalty', value: `-${s.riskPenalty}`, tone: 'text-[#f0758a]' },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-[#1b2530] bg-[#0d1117]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-[#101720]"
      >
        <TickerLogo symbol={company.symbol} companyName={company.name} size={13} />
        <span className="shrink-0 font-mono text-[11px] font-semibold text-[#eef3f8]">{company.symbol}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-[#8190a0]">{company.name}</span>
        <span className="shrink-0 text-[10px]" title={theme.name} aria-hidden>
          {theme.emoji}
        </span>
        <span className={`numeric shrink-0 font-mono text-sm font-semibold ${scoreTone(s.total)}`}>{s.total}</span>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${ACTION_TONE[s.action]}`}>
          {s.action}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[#8190a0] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-[#1b2530] px-2.5 py-2 text-[11px] leading-snug">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Why it matters</p>
            <p className="mt-0.5 text-[#c8d3de]">{company.whyItMatters}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Evidence</p>
            <p className="mt-0.5 text-[#c8d3de]">{company.evidenceSummary}</p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {breakdown.map((cell) => (
              <div key={cell.label} className="rounded-md border border-[#263241] bg-[#0d141c] p-1.5">
                <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{cell.label}</p>
                <p className={`numeric mt-0.5 font-mono text-xs font-semibold ${cell.tone}`}>{cell.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${ACTION_TONE[s.action]}`}>
              {s.state}
            </span>
            <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#a8b5c2]">
              {SIZE_LABEL[company.sizeBucket]}
            </span>
            <Link
              href={`/themes/${company.theme}`}
              className="rounded border border-[#2a4a7a] bg-[#0f1a2c] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#7fb0ff] transition hover:bg-[#13233c]"
            >
              Theme dossier {'->'}
            </Link>
          </div>

          {company.risks.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#f0758a]">Risks</p>
              <ul className="mt-0.5 space-y-0.5">
                {company.risks.map((risk) => (
                  <li key={risk} className="text-[10px] text-[#c8d3de]">
                    - {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Small-cap discovery engine. Deterministic buckets from world-radar rendered as dense
 * inline accordions, with client-side theme filtering. Research surface only - no
 * output here is a buy or sell call.
 */
export function SmallCapDiscovery({ buckets, themesBySlug }: SmallCapDiscoveryProps) {
  const [activeTheme, setActiveTheme] = useState<string>('all');
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);

  const themeSlugs = useMemo(() => {
    const slugs: string[] = [];
    for (const bucket of buckets) {
      for (const company of bucket.items) {
        if (!slugs.includes(company.theme)) slugs.push(company.theme);
      }
    }
    return slugs;
  }, [buckets]);

  const visibleBuckets = useMemo(() => {
    const rest = buckets.filter((b) => b.bucket !== AVOID_BUCKET);
    const avoid = buckets.filter((b) => b.bucket === AVOID_BUCKET);
    return [...rest, ...avoid]
      .map((b) => ({
        ...b,
        items: activeTheme === 'all' ? b.items : b.items.filter((c) => c.theme === activeTheme),
      }))
      .filter((b) => b.items.length > 0);
  }, [buckets, activeTheme]);

  const namesTracked = visibleBuckets.reduce((n, b) => n + b.items.length, 0);
  const emergingNow = visibleBuckets.find((b) => b.bucket === EMERGING_BUCKET)?.items.length ?? 0;
  const flaggedRisky = visibleBuckets.find((b) => b.bucket === AVOID_BUCKET)?.items.length ?? 0;

  const themeMeta = (slug: string): ThemeMeta => themesBySlug[slug] ?? { name: slug, emoji: '' };

  return (
    <div className="space-y-3">
      <section className="terminal-panel rounded-md p-3">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-[#7fb0ff]" />
          <h2 className="text-sm font-semibold text-[#eef3f8]">Discovery engine</h2>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {([
            ['Names tracked', namesTracked, 'text-[#eef3f8]'],
            ['Emerging now', emergingNow, 'text-[#43d18b]'],
            ['Flagged risky', flaggedRisky, 'text-[#f0758a]'],
          ] as const).map(([label, value, tone]) => (
            <div key={label} className="rounded-md border border-[#263241] bg-[#0d141c] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
              <p className={`numeric mt-0.5 font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTheme('all')}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition ${
              activeTheme === 'all'
                ? 'border-[#3b5bdb] bg-[#0d1530] text-[#8aa2ff]'
                : 'border-[#1b2530] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]'
            }`}
          >
            All
          </button>
          {themeSlugs.map((slug) => {
            const meta = themeMeta(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => setActiveTheme(slug)}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] transition ${
                  activeTheme === slug
                    ? 'border-[#3b5bdb] bg-[#0d1530] text-[#8aa2ff]'
                    : 'border-[#1b2530] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]'
                }`}
              >
                {meta.emoji} {meta.name}
              </button>
            );
          })}
        </div>
      </section>

      {visibleBuckets.length === 0 && (
        <section className="terminal-panel rounded-md p-3">
          <p className="text-[11px] text-[#a8b5c2]">No names match this theme filter yet.</p>
        </section>
      )}

      {visibleBuckets.map((bucket) => {
        const isAvoid = bucket.bucket === AVOID_BUCKET;
        return (
          <section key={bucket.bucket} className="terminal-panel rounded-md p-3">
            <div className="flex items-center gap-2">
              <h3 className={`text-[12px] font-semibold ${isAvoid ? 'text-[#f0758a]' : 'text-[#eef3f8]'}`}>
                {bucket.bucket}
              </h3>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${
                  isAvoid
                    ? 'border-[#7a2630] bg-[#260f12] text-[#f0758a]'
                    : 'border-[#263241] bg-[#0d141c] text-[#8190a0]'
                }`}
              >
                {bucket.items.length}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-[#8190a0]">{bucket.blurb}</p>

            <div className="mt-2 space-y-1.5">
              {bucket.items.map((company) => (
                <CompanyRow
                  key={company.symbol}
                  company={company}
                  theme={themeMeta(company.theme)}
                  open={openSymbol === company.symbol}
                  onToggle={() => setOpenSymbol(openSymbol === company.symbol ? null : company.symbol)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-[10px] leading-snug text-[#6f7d8a]">
        Discovery ranks are deterministic research scores built on evidence, bottleneck exposure and risk penalties -
        small caps carry real liquidity and dilution risk.
      </p>
    </div>
  );
}
