import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DashboardData } from '@/types/scanner';
import type { IntelligenceItem } from '@/lib/intelligence';
import type { GovAward } from '@/lib/gov-awards';
import type { LifecycleCandidate } from '@/lib/small-cap-lifecycle';
import type { Theme } from '@/lib/world-radar';
import type { SetupStatus } from '@/lib/setup-status';
import { relativeTime } from '@/lib/format';
import { SimpleSection, SimpleEmpty, SimpleChip } from '@/components/simple/SimpleSection';
import { SimpleBook } from '@/components/simple/SimpleBook';
import { SimpleSetup } from '@/components/simple/SimpleSetup';
import { SourceFavicon } from '@/components/SourceFavicon';

/**
 * SIMPLE VIEW - the calm front door.
 *
 * Built to a founder brief (2026-09-09): portfolio, news, government money, the small
 * caps riding that money, and which themes are running. Links deeper, "but not, like,
 * too much overkill, no charts, nothing like that... no sliding information".
 *
 * So: no chart primitives, no carousels, no auto-rotating faces, no countdown timers,
 * one link per block. Every block obeys the standing sample-data rule - live rows render
 * as data, sample rows only on the demo tour under a chip, and a live surface with no
 * feed says so instead of inventing one.
 */

export interface SimpleHomeProps {
  data: DashboardData;
  news: IntelligenceItem[];
  newsSource: 'live' | 'sample';
  awards: GovAward[];
  awardsSource: 'live' | 'mixed' | 'sample';
  /** Small caps whose backing profile names a government body. */
  govBackedCaps: LifecycleCandidate[];
  /** Top themes by authored research score, highest first. */
  themes: Theme[];
  themeCount: number;
  /** Real per-user setup state; drives the progressive onboarding checklist. */
  setupStatus: SetupStatus;
}

export function SimpleHome({
  data,
  news,
  newsSource,
  awards,
  awardsSource,
  govBackedCaps,
  themes,
  themeCount,
  setupStatus,
}: SimpleHomeProps) {
  const isDemo = data.mode === 'demo';
  // Sample rows may only render on the demo tour (standing honesty rule).
  const showNews = newsSource === 'live' || isDemo;
  const shownNews = showNews ? news.slice(0, 5) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-28 xl:pb-6">
      <SimpleSetup status={setupStatus} />

      <SimpleSection title="Your book" hint="What you own and how it is doing." href="/portfolio" linkLabel="Open portfolio">
        <SimpleBook data={data} />
      </SimpleSection>

      <SimpleSection
        title="What moved"
        hint="Headlines on the names and themes Lyra tracks."
        href="/intelligence"
        linkLabel="All news"
        chip={showNews && newsSource === 'sample' ? <SimpleChip>Sample</SimpleChip> : null}
      >
        {shownNews.length === 0 ? (
          <SimpleEmpty>
            Live news feed not connected. Lyra shows nothing here rather than sample headlines.
          </SimpleEmpty>
        ) : (
          <ul className="divide-y divide-line/70">
            {shownNews.map((item) => (
              <li key={item.id} className="flex gap-2.5 py-2.5">
                <span className="mt-0.5 shrink-0">
                  <SourceFavicon domain={item.sourceDomain} sourceName={item.sourceName} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug text-ink-title">{item.headline}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    {item.tickers.length > 0 && (
                      <span className="font-mono font-semibold text-ink-2">{item.tickers.join(' ')} · </span>
                    )}
                    {item.sourceName} · {relativeTime(item.publishedAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SimpleSection>

      <SimpleSection
        title="Where government money went"
        hint="Awarded contracts and grants - public record, straight from the source."
        href="/awards"
        linkLabel="All awards"
        chip={
          awardsSource === 'live' ? null : (
            <SimpleChip>{awardsSource === 'mixed' ? 'Part sample' : 'Sample'}</SimpleChip>
          )
        }
      >
        {awards.length === 0 ? (
          <SimpleEmpty>No awards on file yet. Nothing is shown rather than an invented one.</SimpleEmpty>
        ) : (
          <ul className="divide-y divide-line/70">
            {awards.slice(0, 5).map((award) => (
              <li key={award.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[13px] font-medium leading-snug text-ink-title">
                    {award.recipient}
                  </span>
                  <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-accent">
                    {award.amount}
                  </span>
                </div>
                {/* The award's OWN description - what the money is actually for. The `why`
                    field is a templated sentence that reads identically on every row, so
                    five of them stacked up is noise, not information. */}
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-2">{award.summary}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
                  <span>{award.agency}</span>
                  {award.tickers.length > 0 && (
                    <span className="font-mono font-semibold text-ink-2">{award.tickers.join(' ')}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SimpleSection>

      <SimpleSection
        title="Small caps riding that money"
        hint="Smaller names with a government body already backing them."
        href="/small-caps"
        linkLabel="All small caps"
      >
        {govBackedCaps.length === 0 ? (
          <SimpleEmpty>
            No small cap currently shows government backing on record. Nothing is listed rather than
            stretching the definition to fill the block.
          </SimpleEmpty>
        ) : (
          <ul className="divide-y divide-line/70">
            {govBackedCaps.slice(0, 5).map((cap) => {
              const backer = cap.backing.sources.find((s) => s.kind === 'government');
              return (
                <li key={cap.symbol}>
                  <Link
                    href={`/tickers/${cap.symbol}`}
                    className="-mx-1 block rounded px-1 py-2.5 transition hover:bg-panel/60"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[13px] font-semibold text-ink">{cap.symbol}</span>
                      <span className="min-w-0 truncate text-[12px] text-ink-2">{cap.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-ink-3">
                        {cap.themeEmoji} {cap.themeName}
                      </span>
                    </div>
                    {/* The backing evidence itself - a real, specific award or programme.
                        The lifecycle engine's whyNow line is templated and reads the same
                        on every row, so it is left to the /small-caps page. */}
                    {backer ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
                        <span className="text-ink-2">{backer.name}</span>
                        {backer.detail ? ` - ${backer.detail}` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] leading-snug text-ink-3">{cap.whyNow}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SimpleSection>

      <SimpleSection
        title="What is running right now"
        hint="Research themes, strongest first. Analyst-scored - updated with content releases, not with the market tick."
        href="/themes"
        linkLabel={`All ${themeCount} themes`}
      >
        {themes.length === 0 ? (
          <SimpleEmpty>No themes on file.</SimpleEmpty>
        ) : (
          <ul className="divide-y divide-line/70">
            {themes.map((theme) => (
              <li key={theme.slug}>
                <Link
                  href={`/themes/${theme.slug}`}
                  className="-mx-1 flex items-start gap-2.5 rounded px-1 py-2.5 transition hover:bg-panel/60"
                >
                  <span className="mt-0.5 shrink-0 text-[15px] leading-none" aria-hidden>
                    {theme.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-medium text-ink-title">{theme.name}</span>
                      <span className="text-[11px] uppercase tracking-[0.1em] text-ink-dim">{theme.maturity}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">{theme.thesis}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SimpleSection>

      <div className="px-1 pt-1">
        <Link
          href="/radar"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 transition hover:text-accent"
        >
          Explore everything Lyra tracks <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
