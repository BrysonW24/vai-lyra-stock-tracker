'use client';

import Link from 'next/link';
import { MATURITY_TONE, type Theme } from '@/lib/world-radar';
import { TickerLogo } from '@/components/TickerLogo';

interface TopCompany {
  symbol: string;
  total: number;
}

interface LatestEvent {
  summary: string;
  date: string;
}

interface ThemeRadarProps {
  themes: Theme[];
  topBySlug: Record<string, TopCompany[]>;
  latestEventBySlug: Record<string, LatestEvent | null>;
}

interface StatDef {
  label: string;
  value: number;
  /** Risk-flavoured stat: high is bad (crowding). */
  risk?: boolean;
}

/** Crowding runs red when hot (>=60); every other stat runs green when strong (>=70). */
function statTone(stat: StatDef): string {
  if (stat.risk) return stat.value >= 60 ? 'text-[#f0758a]' : 'text-[#eef3f8]';
  return stat.value >= 70 ? 'text-[#43d18b]' : 'text-[#eef3f8]';
}

function themeStats(t: Theme): StatDef[] {
  return [
    { label: 'Momentum', value: t.momentum },
    { label: 'Capital', value: t.capitalFlow },
    { label: 'Policy', value: t.policySupport },
    { label: 'SmallCap', value: t.smallCapOpportunity },
    { label: 'Crowding', value: t.crowdingRisk, risk: true },
    { label: 'News', value: t.newsVelocity },
  ];
}

/**
 * World Radar - the theme grid. Every card is a tappable doorway into a theme's
 * supply chain (/themes/[slug]); the deterministic engine owns every number shown.
 */
export function ThemeRadar({ themes, topBySlug, latestEventBySlug }: ThemeRadarProps) {
  const sorted = [...themes].sort((a, b) => b.momentum - a.momentum);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7fb0ff]">World Radar</h1>
        <span className="font-mono text-[10px] text-[#8190a0]">{sorted.length} themes</span>
        <p className="text-[10px] text-[#6f7d8a]">
          Themes mapped from first principles - follow the bottlenecks, not the noise
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((t) => {
          const top = topBySlug[t.slug] ?? [];
          const latest = latestEventBySlug[t.slug] ?? null;

          return (
            <Link
              key={t.slug}
              href={`/themes/${t.slug}`}
              className="terminal-panel block rounded-md p-3 transition hover:border-[#3a4754] hover:bg-[#101720]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-sm leading-none" aria-hidden>
                    {t.emoji}
                  </span>
                  <h2 className="truncate text-[13px] font-semibold text-[#eef3f8]">{t.name}</h2>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${MATURITY_TONE[t.maturity]}`}
                >
                  {t.maturity}
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-snug text-[#a8b5c2] line-clamp-2">{t.thesis}</p>

              <div className="mt-2 grid grid-cols-3 gap-1">
                {themeStats(t).map((stat) => (
                  <div key={stat.label} className="rounded border border-[#1b2530] bg-[#0d141c] px-1.5 py-1">
                    <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{stat.label}</p>
                    <p className={`mt-0.5 font-mono text-[11px] font-semibold leading-none ${statTone(stat)}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {t.bottlenecks.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Bottlenecks</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {t.bottlenecks.slice(0, 3).map((b) => (
                      <span
                        key={b}
                        className="max-w-full truncate rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#a8b5c2]"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {top.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Top companies</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {top.map((c) => (
                      <span
                        key={c.symbol}
                        className="flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5"
                      >
                        <TickerLogo symbol={c.symbol} size={13} />
                        <span className="font-mono text-[10px] font-semibold text-[#eef3f8]">{c.symbol}</span>
                        <span className="font-mono text-[10px] text-[#43d18b]">{c.total}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {latest && (
                <p className="mt-2 truncate text-[10px] text-[#8190a0]">
                  <span className="font-mono text-[9px]">{latest.date}</span> {latest.summary}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
