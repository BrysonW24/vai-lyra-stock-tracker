'use client';

import Link from 'next/link';
import { MATURITY_TONE, scoreTone, type Theme } from '@/lib/world-radar';
import { TickerLogo } from '@/components/TickerLogo';
import { HelpDrawer, type HelpTerm } from '@/components/education/HelpDrawer';
import { pageTitleClass } from '@/lib/ui';

// Authored-editorial framing on purpose: these scores are hand-set in the theme research
// (content/themes.jsonl) when it is written or revised - they are NOT computed by the
// scan engine and carry no live as-of instant. Describing them as live market readings
// was the 2026-08-11 audit finding; every definition now says what the number IS.
const THEME_RADAR_TERMS: HelpTerm[] = [
  { term: 'Momentum', what: 'Analyst-scored read of how strongly the theme is moving - price and participation building across its names. Higher is stronger.' },
  { term: 'Capital', what: 'Analyst-scored capital-flow read - how much money is rotating into the theme (funds, capex, deals). Strong inflows tend to sustain a move.' },
  { term: 'Policy', what: 'Analyst-scored policy read - whether government funding, subsidies or regulation are tailwinds (high) or headwinds (low) for the theme.' },
  { term: 'SmallCap', what: 'Analyst-scored small-cap opportunity read - how much of the upside still sits in smaller, less-crowded names rather than the mega-caps.', moduleId: 'market-cap' },
  { term: 'Crowding', what: 'Analyst-scored crowding-risk read - how consensus the trade already is. This one runs red when hot (>=60): a crowded theme has less edge left and more downside if sentiment turns.' },
  { term: 'News', what: 'Analyst-scored news-velocity read - how fast headlines and attention have been accelerating around the theme.' },
  { term: 'maturity', what: 'Where the theme sits in its life cycle - emerging, growing, mature - which shapes how much room and how much risk is left.' },
  { term: 'Bottlenecks', what: 'The hardest-to-replace links the theme depends on, where pricing power tends to concentrate. The supply-chain map drills into these.' },
];

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
  if (stat.risk) return stat.value >= 60 ? 'text-negative-soft' : 'text-ink';
  return stat.value >= 70 ? 'text-positive' : 'text-ink';
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
 * supply chain (/themes/[slug]). The six scores are authored research context from
 * content/themes.jsonl - set when the theme research is written, not engine-computed.
 */
export function ThemeRadar({ themes, topBySlug, latestEventBySlug }: ThemeRadarProps) {
  const sorted = [...themes].sort((a, b) => b.momentum - a.momentum);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <h1 className={pageTitleClass}>World Radar</h1>
        <span className="font-mono text-[10px] text-ink-3">{sorted.length} themes</span>
        <p className="text-[10px] text-ink-dim">
          Themes mapped from first principles - follow the bottlenecks, not the noise. Scores are authored research, updated with content releases.
        </p>
        <HelpDrawer
          title="What the scores mean"
          subtitle="The six theme scores, maturity and bottlenecks"
          ariaLabel="What the World Radar scores mean"
          intro="Every theme card carries six analyst-authored 0-100 scores plus a maturity tag - set when the theme research is written or revised, updated with content releases, not computed per scan. Here is what each one reads."
          terms={THEME_RADAR_TERMS}
          footnote="Theme scores are authored research context mapped from first principles - they update with content releases, not with the market tick. Lyra surfaces where the energy and the bottlenecks are - it never tells you to buy or sell. Research only."
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((t) => {
          const top = topBySlug[t.slug] ?? [];
          const latest = latestEventBySlug[t.slug] ?? null;

          return (
            <Link
              key={t.slug}
              href={`/themes/${t.slug}`}
              className="terminal-panel block rounded-panel p-3 transition hover:border-line-hair hover:bg-panel"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-sm leading-none" aria-hidden>
                    {t.emoji}
                  </span>
                  <h2 className="truncate text-[13px] font-semibold text-ink">{t.name}</h2>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${MATURITY_TONE[t.maturity]}`}
                >
                  {t.maturity}
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-snug text-ink-2 line-clamp-2">{t.thesis}</p>

              <div className="mt-2 grid grid-cols-3 gap-1">
                {themeStats(t).map((stat) => (
                  <div key={stat.label} className="rounded border border-line bg-panel px-1.5 py-1">
                    <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{stat.label}</p>
                    <p className={`mt-0.5 font-mono text-[11px] font-semibold leading-none ${statTone(stat)}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {t.bottlenecks.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-ink-3">Bottlenecks</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {t.bottlenecks.slice(0, 3).map((b) => (
                      <span
                        key={b}
                        className="max-w-full truncate rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {top.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-ink-3">Top companies</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {top.map((c) => (
                      <span
                        key={c.symbol}
                        className="flex items-center gap-1 rounded border border-line-strong bg-panel px-1.5 py-0.5"
                      >
                        <TickerLogo symbol={c.symbol} size={13} />
                        <span className="font-mono text-[10px] font-semibold text-ink">{c.symbol}</span>
                        <span className={`font-mono text-[10px] ${scoreTone(c.total)}`}>{c.total}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {latest && (
                <p className="mt-2 truncate text-[10px] text-ink-3">
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
