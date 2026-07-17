'use client';

import { useEffect, useState } from 'react';
import { Banknote, CalendarClock, Cpu, Landmark, Rocket, Timer, type LucideIcon } from 'lucide-react';
import { CATALYSTS, CATALYSTS_CURATED_AS_OF, scoreCatalyst, type CatalystCategory, type ScoredCatalyst } from '@/lib/catalysts';
import { macroEventMeta, type CalendarEvent } from '@/lib/calendar';

/**
 * Epoch ms of a wall-clock time in an IANA zone (the RBA announces at 2:30pm SYDNEY,
 * which is UTC+10 or UTC+11 depending on the season - a fixed offset would drift an
 * hour for half the year). Standard two-pass trick: guess in UTC, measure the zone's
 * rendering of that guess, correct by the difference.
 */
function zonedTimeToMs(dateIso: string, hour: number, minute: number, timeZone: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(guess);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const rendered = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    return guess - (rendered - guess);
  } catch {
    return guess;
  }
}

/** Announcement instants for the seeded macro events, by event-id prefix. */
const MACRO_INSTANT: Array<{ prefix: string; hour: number; minute: number; timeZone: string }> = [
  { prefix: 'rba-decision-', hour: 14, minute: 30, timeZone: 'Australia/Sydney' },
  { prefix: 'rba-minutes-', hour: 11, minute: 30, timeZone: 'Australia/Sydney' },
  { prefix: 'rba-chart-pack-', hour: 11, minute: 30, timeZone: 'Australia/Sydney' },
  { prefix: 'fomc-decision-', hour: 14, minute: 0, timeZone: 'America/New_York' },
];

interface LiveMoment {
  id: string;
  title: string;
  category: CatalystCategory;
  targetMs: number;
  heat: number;
  href: string;
}

/**
 * Live calendar events -> countdown moments. Seeded macro events count down to their
 * actual announcement instant; date-only events (IPOs, earnings) target local midnight,
 * which is the honest reading of a date-only calendar row. Heat is a fixed mapping of
 * the row's importance - no inference.
 */
function liveMoments(events: CalendarEvent[], nowMs: number): LiveMoment[] {
  return events
    .filter((event) => event.type === 'macro' || event.type === 'ipo' || event.type === 'earnings')
    .map((event) => {
      const instant = MACRO_INSTANT.find(({ prefix }) => event.id.startsWith(prefix));
      const targetMs = instant
        ? zonedTimeToMs(event.date, instant.hour, instant.minute, instant.timeZone)
        : new Date(`${event.date}T00:00:00`).getTime();
      const category: CatalystCategory =
        event.type === 'ipo' ? 'ipo' : event.type === 'earnings' ? 'earnings' : 'macro';
      return {
        id: event.id,
        title: macroEventMeta(event) ? event.title : event.ticker ? `${event.ticker}: ${event.title}` : event.title,
        category,
        targetMs,
        heat: event.importance === 'high' ? 88 : event.importance === 'medium' ? 68 : 50,
        href: '/calendar',
      };
    })
    .filter((moment) => moment.targetMs > nowMs);
}

const CATEGORY_ICON: Record<CatalystCategory, LucideIcon> = {
  ipo: Rocket,
  funding: Banknote,
  earnings: CalendarClock,
  product: Cpu,
  launch: Rocket,
  regulatory: Landmark,
  macro: Landmark,
};

function parts(targetMs: number, nowMs: number) {
  let diff = Math.max(0, targetMs - nowMs);
  const d = Math.floor(diff / 86_400_000);
  diff -= d * 86_400_000;
  const h = Math.floor(diff / 3_600_000);
  diff -= h * 3_600_000;
  const m = Math.floor(diff / 60_000);
  diff -= m * 60_000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s };
}

function Seg({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-base font-semibold tabular-nums leading-none text-[#eef3f8] md:text-lg">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#5e6b78]">{label}</span>
    </div>
  );
}

function Colon() {
  return <span className="pb-3 font-mono text-sm text-[#3a4754]">:</span>;
}

/**
 * Catalyst Countdown - the live, ticking hero for the biggest upcoming moments
 * (OpenAI / SpaceX / Anthropic and the like). Surfaces the hottest few catalysts that
 * are still ahead with a second-by-second countdown so Command feels alive and the
 * "set up before it lands" window is impossible to miss. Research framing only.
 */
export function CatalystCountdown({ events = [] }: { events?: CalendarEvent[] }) {
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  // Tick every second, client-only, to avoid any server/client hydration mismatch.
  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted) {
    return <div className="terminal-panel h-[92px] animate-pulse rounded-md" aria-hidden />;
  }

  // Two sources, one board: the hand-curated catalyst list plus the LIVE calendar
  // (seeded RBA/FOMC macro events, IPO listings, earnings) - the calendar side ticks
  // to the actual announcement instant, so "RBA decision in 04:11:32:09" is real.
  const curated: LiveMoment[] = CATALYSTS.map((catalyst) => scoreCatalyst(catalyst, new Date(nowMs)))
    .filter((catalyst: ScoredCatalyst) => catalyst.daysUntil >= 0)
    .map((catalyst) => ({
      id: catalyst.id,
      title: catalyst.title,
      category: catalyst.category,
      targetMs: new Date(`${catalyst.date}T00:00:00`).getTime(),
      heat: catalyst.heat,
      href: '#catalyst-radar',
    }));
  const featured: LiveMoment[] = [...curated, ...liveMoments(events, nowMs)]
    .sort((a, b) => (b.heat !== a.heat ? b.heat - a.heat : a.targetMs - b.targetMs))
    .slice(0, 3);

  // No upcoming moments left in the curated set. Say so honestly (with the curation date) instead of
  // rendering nothing - a silent disappearance reads as "all quiet" when it means "list needs a refresh".
  if (featured.length === 0) {
    return (
      <section className="terminal-panel overflow-hidden rounded-md">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
            <Timer size={13} className="text-[#5e6b78]" /> Big moments
          </p>
          <a href="#catalyst-radar" className="shrink-0 font-mono text-[10px] text-[#8190a0] transition hover:text-[#dbe5ee]">
            All catalysts →
          </a>
        </div>
        <p className="px-3 pb-2.5 text-[11px] leading-snug text-[#a8b5c2]">
          No upcoming moments in the curated set - it was last refreshed on{' '}
          <span className="font-mono text-[#f3a33a]">{CATALYSTS_CURATED_AS_OF}</span> and is due an update. An empty
          countdown means the list needs curating, not that the calendar is clear.
        </p>
      </section>
    );
  }

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
          <Timer size={13} className="text-[#f3a33a]" /> Big moments
          <span className="relative flex h-1.5 w-1.5" title="Counting down to the moments worth positioning for">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f3a33a] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f3a33a]" />
          </span>
          <span className="font-mono text-[8px] tracking-[0.14em] text-[#f3a33a]">counting down</span>
        </p>
        <a href="#catalyst-radar" className="shrink-0 font-mono text-[10px] text-[#8190a0] transition hover:text-[#dbe5ee]">
          All catalysts →
        </a>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto p-2.5">
        {featured.map((catalyst, i) => {
          const Icon = CATEGORY_ICON[catalyst.category];
          const t = parts(catalyst.targetMs, nowMs);
          const hot = i === 0;
          return (
            <a
              key={catalyst.id}
              href={catalyst.href}
              className={`flex min-w-[228px] flex-1 flex-col gap-1.5 rounded-md border p-2.5 transition ${
                hot ? 'border-[#9a6a1f]/70 bg-[#1a1206]' : 'border-[#1b2530] bg-[#0d141c] hover:border-[#3a4754]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={13} className={hot ? 'text-[#f3a33a]' : 'text-[#7fb0ff]'} />
                <span className="rounded border border-[#263241] bg-[#0b1016] px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#a8b5c2]">
                  {catalyst.category}
                </span>
                <span className="ml-auto font-mono text-[9px] text-[#8190a0]">heat {catalyst.heat}</span>
              </div>
              <p className="truncate text-[12px] font-semibold leading-snug text-[#eef3f8]">{catalyst.title}</p>
              <div className="flex items-end gap-1.5">
                <Seg value={t.d} label="days" />
                <Colon />
                <Seg value={t.h} label="hrs" />
                <Colon />
                <Seg value={t.m} label="min" />
                <Colon />
                <Seg value={t.s} label="sec" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
