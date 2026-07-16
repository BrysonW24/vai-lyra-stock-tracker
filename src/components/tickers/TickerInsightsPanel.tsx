import { Activity, CalendarClock, Newspaper } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { demoIntelligenceFeed, type Sentiment } from '@/lib/intelligence';
import { getDemoCalendarEvents } from '@/lib/calendar';
import { SourceFavicon } from '@/components/SourceFavicon';
import { formatNumber, formatSignedNumber, relativeTime } from '@/lib/format';

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-[#43d18b]',
  neutral: 'bg-[#8190a0]',
  negative: 'bg-[#ff6b6b]',
};

const SENTIMENT_TEXT: Record<Sentiment, string> = {
  positive: 'text-[#43d18b]',
  neutral: 'text-[#8190a0]',
  negative: 'text-[#ff6b6b]',
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

/**
 * Ticker insights - the per-name catalyst + intelligence layer that replaces the old
 * score/RSI line chart (redundant with the live TradingView chart + the score-history
 * bars beside it). Surfaces a deterministic momentum read, the next earnings catalyst,
 * and the tagged news/intelligence for this ticker. Research only.
 */
export function TickerInsightsPanel({ signal }: { signal: SignalRow }) {
  const news = demoIntelligenceFeed
    .filter((item) => item.tickers.includes(signal.symbol))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  const earnings = getDemoCalendarEvents().filter((e) => e.type === 'earnings' && e.ticker === signal.symbol);
  const upcoming = earnings.filter((e) => daysFromToday(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = earnings.filter((e) => daysFromToday(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
  const nextEarnings = upcoming[0] ?? null;
  const lastEarnings = past[0] ?? null;

  return (
    <section className="terminal-panel flex flex-col gap-3 rounded-md p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">News, catalysts & momentum</p>
        <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">What is moving {signal.symbol} beyond the chart.</p>
      </div>

      {/* Momentum read */}
      <div className="rounded-md border border-[#263241] bg-[#0d141c] p-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fb0ff]">
          <Activity size={12} /> Momentum read
        </p>
        <p className="mt-1 text-[11px] leading-snug text-[#dbe5ee]">{momentumRead(signal)}</p>
      </div>

      {/* Earnings / catalyst */}
      <div className="rounded-md border border-[#263241] bg-[#0d141c] p-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f3a33a]">
          <CalendarClock size={12} /> Next catalyst
        </p>
        {nextEarnings ? (
          <p className="mt-1 text-[11px] leading-snug text-[#dbe5ee]">
            {nextEarnings.title} - {nextEarnings.date}{' '}
            <span className="text-[#8190a0]">
              ({daysFromToday(nextEarnings.date) === 0 ? 'today' : `in ${daysFromToday(nextEarnings.date)}d`})
            </span>
          </p>
        ) : lastEarnings ? (
          <p className="mt-1 text-[11px] leading-snug text-[#a8b5c2]">
            Last reported: {lastEarnings.title} - {lastEarnings.date}{' '}
            <span className="text-[#8190a0]">({Math.abs(daysFromToday(lastEarnings.date))}d ago)</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] leading-snug text-[#8190a0]">No scheduled earnings in the window.</p>
        )}
      </div>

      {/* News & intelligence */}
      <div className="flex-1">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a78bfa]">
          <Newspaper size={12} /> News & intelligence
        </p>
        {news.length > 0 ? (
          <ul className="mt-1.5 space-y-1.5">
            {news.map((item) => (
              <li key={item.id} className="rounded-md border border-[#1b2530] bg-[#0d141c] p-2">
                <div className="flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[item.sentiment]}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-snug text-[#eef3f8]">{item.headline}</p>
                    <p className="mt-0.5 truncate text-[10px] leading-snug text-[#a8b5c2]">{item.summary}</p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-[#8190a0]">
                      <SourceFavicon domain={item.sourceDomain} sourceName={item.sourceName} />
                      {item.sourceName} · <span className={SENTIMENT_TEXT[item.sentiment]}>{item.sentiment}</span> · {relativeTime(item.publishedAt)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] leading-snug text-[#8190a0]">No tagged intelligence for {signal.symbol} in the current feed.</p>
        )}
      </div>

      <p className="border-t border-[#1b2530] pt-1.5 font-mono text-[10px] text-[#5e6b78]">
        Deterministic reads + tagged sources. Research only, never advice.
      </p>
    </section>
  );
}
