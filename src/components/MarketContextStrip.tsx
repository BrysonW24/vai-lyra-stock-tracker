'use client';

import { useMemo } from 'react';
import type { MarketContextSnapshot } from '@/lib/market-context';
import { formatNumber } from '@/lib/format';

export interface MarketContextStripProps {
  data: MarketContextSnapshot;
}

interface TapeEntry {
  key: string;
  label: string;
  value: string;
  change: string;
  changeTone: string;
  href: string;
}

/**
 * Market context as a ticker-tape (same UX as the Intel marquee): the regime badge
 * sits fixed on the left while indices, vol, yields, commodities and sentiment
 * stream behind it. Every item is tappable and opens its primary source. Pauses on
 * hover; honours prefers-reduced-motion.
 */
export function MarketContextStrip({ data }: MarketContextStripProps) {
  const regime = useMemo(() => {
    switch (data.regime) {
      case 'risk_on':
        return { text: 'text-[#43d18b]', dot: 'bg-[#43d18b]' };
      case 'risk_off':
        return { text: 'text-[#ff6b6b]', dot: 'bg-[#ff6b6b]' };
      case 'neutral':
      default:
        return { text: 'text-[#60a5fa]', dot: 'bg-[#60a5fa]' };
    }
  }, [data.regime]);

  const items = useMemo<TapeEntry[]>(() => {
    const tone = (pct: number | null) => (pct === null ? 'text-[#a8b5c2]' : pct >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]');
    const pct = (val: number | null) => (val === null ? '-' : `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`);

    const out: TapeEntry[] = [];
    if (data.sp500Price !== null)
      out.push({ key: 'spx', label: 'S&P 500', value: formatNumber(data.sp500Price), change: pct(data.sp500ChangePct), changeTone: tone(data.sp500ChangePct), href: 'https://finance.yahoo.com/quote/%5EGSPC/' });
    if (data.nasdaqPrice !== null)
      out.push({ key: 'ndx', label: 'Nasdaq', value: formatNumber(data.nasdaqPrice), change: pct(data.nasdaqChangePct), changeTone: tone(data.nasdaqChangePct), href: 'https://finance.yahoo.com/quote/%5EIXIC/' });
    if (data.dowPrice !== null)
      out.push({ key: 'dji', label: 'Dow', value: formatNumber(data.dowPrice), change: pct(data.dowChangePct), changeTone: tone(data.dowChangePct), href: 'https://finance.yahoo.com/quote/%5EDJI/' });
    if (data.vixPrice !== null)
      out.push({ key: 'vix', label: 'VIX', value: formatNumber(data.vixPrice, 2), change: pct(data.vixChangePct), changeTone: tone(data.vixChangePct), href: 'https://finance.yahoo.com/quote/%5EVIX/' });
    if (data.yield10y !== null)
      out.push({ key: '10y', label: '10Y yield', value: `${data.yield10y.toFixed(2)}%`, change: pct(data.yield10yChangePct), changeTone: tone(data.yield10yChangePct), href: 'https://finance.yahoo.com/quote/%5ETNX/' });
    if (data.goldPrice !== null)
      out.push({ key: 'gold', label: 'Gold', value: `$${formatNumber(data.goldPrice)}`, change: pct(data.goldChangePct), changeTone: tone(data.goldChangePct), href: 'https://finance.yahoo.com/quote/GC%3DF/' });
    if (data.oilPrice !== null)
      out.push({ key: 'oil', label: 'Oil', value: `$${formatNumber(data.oilPrice, 2)}`, change: pct(data.oilChangePct), changeTone: tone(data.oilChangePct), href: 'https://finance.yahoo.com/quote/CL%3DF/' });
    if (data.btcPrice !== null)
      out.push({ key: 'btc', label: 'BTC', value: `$${formatNumber(data.btcPrice)}`, change: pct(data.btcChangePct), changeTone: tone(data.btcChangePct), href: 'https://finance.yahoo.com/quote/BTC-USD/' });
    if (data.fearGreedIndex !== null)
      out.push({ key: 'fg', label: 'Fear & Greed', value: String(data.fearGreedIndex), change: data.fearGreedLabel || '-', changeTone: 'text-[#8190a0]', href: 'https://edition.cnn.com/markets/fear-and-greed' });
    return out;
  }, [data]);

  return (
    <div className="intel-marquee terminal-panel glass-hero relative flex items-center overflow-hidden rounded-md">
      {/* Fixed feed title - same treatment as the Intel tape. Dot stays regime-coloured. */}
      <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-[#1b2530] bg-[#0b1016] px-3 py-2">
        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${regime.dot}`} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8aa2ff]">Markets</span>
      </div>

      {/* Scrolling track (items duplicated for a seamless loop) */}
      <div className="relative min-w-0 flex-1 overflow-hidden py-2">
        <div className="context-track flex w-max items-center">
          {[...items, ...items].map((item, i) => (
            <a
              key={`${item.key}-${i}`}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open source for ${item.label}`}
              className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-[#1b2530] px-4 font-mono transition hover:bg-[#101720]"
            >
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{item.label}</span>
              <span className="text-xs font-semibold text-[#dbe5ee]">{item.value}</span>
              <span className={`text-[11px] ${item.changeTone}`}>{item.change}</span>
            </a>
          ))}
        </div>
        {/* Right edge fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0b1016] to-transparent" />
      </div>
    </div>
  );
}
