import { Activity, CalendarClock, Newspaper } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import type { IntelligenceItem, Sentiment } from '@/lib/intelligence';
import type { CalendarEvent } from '@/lib/calendar';
import { SourceFavicon } from '@/components/SourceFavicon';
import { formatNumber, formatSignedNumber, relativeTime } from '@/lib/format';

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-positive',
  neutral: 'bg-ink-3',
  negative: 'bg-negative',
};

const SENTIMENT_TEXT: Record<Sentiment, string> = {
  positive: 'text-positive',
  neutral: 'text-ink-3',
  negative: 'text-negative',
};

/** Deterministic one-line read of where momentum sits - no opinion, no advice. */
function momentumRead(s: SignalRow): string {
  const parts: string[] = [];
  parts.push(
    s.scoreDelta > 0
      ? `Score climbing ${formatSignedNumber(s.scoreDelta, 0)}`
      : s.scoreDelta < 0
        ? `Score slipping ${formatSignedNumber(s.scoreDelta, 0)}`
        : 'Score flat',
  );
  parts.push(s.histDelta > 0 ? 'MACD turning up' : s.histDelta < 0 ? 'MACD fading' : 'MACD flat');
  parts.push(
    s.volumeRatio >= 1.2 ? `heavy volume ${formatNumber(s.volumeRatio, 1)}x` : s.volumeRatio >= 1 ? `in-line volume ${formatNumber(s.volumeRatio, 1)}x` : `light volume ${formatNumber(s.volumeRatio, 1)}x`,
  );
  return `${parts.join(' · ')}. ${formatNumber(s.distanceFromLow, 0)}% above the 60-day low.`;
}

function daysFromToday(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function SampleChip() {
  return (
    <span className="rounded border border-accent-border/60 bg-accent-tint px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-accent">
      Sample
    </span>
  );
}

export interface TickerIntelProps {
  signal: SignalRow;
  /** Ticker-relevant news from the live tables, or the bundled sample feed. */
  news: IntelligenceItem[];
  newsSource: 'live' | 'sample';
  /** Earnings events from the live tables, or the re-anchored sample seeds. */
  events: CalendarEvent[];
  eventsSource: 'live' | 'sample';
  /** The page's own data mode - sample content may only render on the demo tour. */
  pageMode: 'demo' | 'solo' | 'supabase';
}

/**
 * Ticker insights - the per-name catalyst + intelligence layer. The momentum read is always
 * real (computed from the signal the scanner produced). News and earnings follow the honesty
 * rule fixed in the 2026-08-11 audit: LIVE rows render as intelligence; SAMPLE rows render
 * only when the whole page is the demo tour (clearly chipped); a live page whose feed is not
 * connected says exactly that instead of dressing sample headlines and a fabricated earnings
 * date as market intelligence. A fake "earnings in 2d" is a trade-around date - never shown.
 */
export function TickerInsightsPanel({ signal, news, newsSource, events, eventsSource, pageMode }: TickerIntelProps) {
  const showSample = pageMode === 'demo';
  const showNews = newsSource === 'live' || showSample;
  const showEvents = eventsSource === 'live' || showSample;

  const tickerNews = news
    .filter((item) => item.tickers.includes(signal.symbol))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  const earnings = events.filter((e) => e.type === 'earnings' && e.ticker === signal.symbol);
  const upcoming = earnings.filter((e) => daysFromToday(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = earnings.filter((e) => daysFromToday(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
  const nextEarnings = upcoming[0] ?? null;
  const lastEarnings = past[0] ?? null;

  return (
    <section className="terminal-panel flex flex-col gap-3 rounded-panel p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">News, catalysts & momentum</p>
        <p className="mt-0.5 font-mono text-[10px] text-ink-2">What is moving {signal.symbol} beyond the chart.</p>
      </div>

      {/* Momentum read - always real, derived from the scanner's own numbers */}
      <div className="rounded-cell border border-line-strong bg-panel p-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-info">
          <Activity size={12} /> Momentum read
        </p>
        <p className="mt-1 text-[11px] leading-snug text-ink-title">{momentumRead(signal)}</p>
      </div>

      {/* Earnings / catalyst - live rows or (demo tour only) chipped sample rows */}
      <div className="rounded-cell border border-line-strong bg-panel p-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          <CalendarClock size={12} /> Next catalyst
          {showEvents && eventsSource === 'sample' ? <SampleChip /> : null}
        </p>
        {!showEvents ? (
          <p className="mt-1 text-[11px] leading-snug text-ink-3">
            Live earnings calendar not connected - no date is shown rather than a sample one.
          </p>
        ) : nextEarnings ? (
          <p className="mt-1 text-[11px] leading-snug text-ink-title">
            {nextEarnings.title} - {nextEarnings.date}{' '}
            <span className="text-ink-3">
              ({daysFromToday(nextEarnings.date) === 0 ? 'today' : `in ${daysFromToday(nextEarnings.date)}d`})
            </span>
          </p>
        ) : lastEarnings ? (
          <p className="mt-1 text-[11px] leading-snug text-ink-2">
            Last reported: {lastEarnings.title} - {lastEarnings.date}{' '}
            <span className="text-ink-3">({Math.abs(daysFromToday(lastEarnings.date))}d ago)</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] leading-snug text-ink-3">No scheduled earnings in the window.</p>
        )}
      </div>

      {/* News & intelligence - live rows or (demo tour only) chipped sample rows */}
      <div className="flex-1">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-pending">
          <Newspaper size={12} /> News & intelligence
          {showNews && newsSource === 'sample' ? <SampleChip /> : null}
        </p>
        {!showNews ? (
          <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
            Live news feed not connected. Lyra shows nothing here rather than sample headlines dressed as
            market intelligence.
          </p>
        ) : tickerNews.length > 0 ? (
          <ul className="mt-1.5 space-y-1.5">
            {tickerNews.map((item) => (
              <li key={item.id} className="rounded-cell border border-line bg-panel p-2">
                <div className="flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[item.sentiment]}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-snug text-ink">{item.headline}</p>
                    <p className="mt-0.5 truncate text-[10px] leading-snug text-ink-2">{item.summary}</p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-ink-3">
                      <SourceFavicon domain={item.sourceDomain} sourceName={item.sourceName} />
                      {item.sourceName} · <span className={SENTIMENT_TEXT[item.sentiment]}>{item.sentiment}</span> · {relativeTime(item.publishedAt)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
            No tagged intelligence for {signal.symbol} in the {newsSource === 'live' ? 'live feed' : 'sample feed'}.
          </p>
        )}
      </div>

      <p className="border-t border-line pt-1.5 font-mono text-[10px] text-ink-dim">
        {newsSource === 'live'
          ? 'Deterministic reads + live tagged sources. Research only, never advice.'
          : 'Deterministic reads. Research only, never advice.'}
      </p>
    </section>
  );
}
