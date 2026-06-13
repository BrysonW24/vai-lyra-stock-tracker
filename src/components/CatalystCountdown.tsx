'use client';

import { useEffect, useState } from 'react';
import { Banknote, CalendarClock, Cpu, Landmark, Rocket, Timer, type LucideIcon } from 'lucide-react';
import { CATALYSTS, scoreCatalyst, type CatalystCategory, type ScoredCatalyst } from '@/lib/catalysts';

const CATEGORY_ICON: Record<CatalystCategory, LucideIcon> = {
  ipo: Rocket,
  funding: Banknote,
  earnings: CalendarClock,
  product: Cpu,
  launch: Rocket,
  regulatory: Landmark,
  macro: Landmark,
};

function parts(targetISO: string, nowMs: number) {
  const target = new Date(`${targetISO}T00:00:00`).getTime();
  let diff = Math.max(0, target - nowMs);
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
export function CatalystCountdown() {
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

  const featured: ScoredCatalyst[] = CATALYSTS.map((catalyst) => scoreCatalyst(catalyst, new Date(nowMs)))
    .filter((catalyst) => catalyst.daysUntil >= 0)
    .sort((a, b) => (b.heat !== a.heat ? b.heat - a.heat : a.daysUntil - b.daysUntil))
    .slice(0, 3);

  if (featured.length === 0) return null;

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
          const t = parts(catalyst.date, nowMs);
          const hot = i === 0;
          return (
            <a
              key={catalyst.id}
              href="#catalyst-radar"
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
