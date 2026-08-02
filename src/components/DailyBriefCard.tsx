'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { DashboardData } from '@/types/scanner';
import type { MarketContextSnapshot } from '@/lib/market-context';
import { buildDailyBrief, type BriefTone } from '@/lib/daily-brief';
import { BriefAiNarration } from '@/components/BriefAiNarration';
import { formatSignedNumber } from '@/lib/format';

const TONE_DOT: Record<BriefTone, string> = {
  pos: 'bg-positive',
  neg: 'bg-negative',
  warn: 'bg-accent',
  neutral: 'bg-ink-dim',
};

const REGIME_CHIP: Record<BriefTone, string> = {
  pos: 'border-positive/40 bg-positive-tint text-positive',
  neg: 'border-negative/50 bg-negative/10 text-negative',
  warn: 'border-accent-border bg-accent-tint text-accent',
  neutral: 'border-line-strong bg-panel text-ink-2',
};

interface LiveLineData {
  id: string;
  label: string;
  text: string;
  tone: BriefTone;
  chip: 'NEW' | 'HOT';
  symbol: string;
}

/** Deterministic pool of injectable lines derived from the latest scan. */
function buildLivePool(data: DashboardData): LiveLineData[] {
  const pool: LiveLineData[] = [];
  for (const s of data.signals) {
    if (Math.abs(s.scoreDelta) >= 4) {
      pool.push({
        id: `sig-${s.symbol}`,
        label: 'Signal',
        text: `${s.symbol} ${s.scoreDelta > 0 ? 'building' : 'cooling'} (${formatSignedNumber(s.scoreDelta, 0)}) - score ${s.score}, RSI ${Math.round(s.rsi)}.`,
        tone: s.scoreDelta > 0 ? 'pos' : 'warn',
        chip: Math.abs(s.scoreDelta) >= 8 || s.status === 'strong_setup' ? 'HOT' : 'NEW',
        symbol: s.symbol,
      });
    }
    if (s.volumeRatio >= 1.5) {
      pool.push({
        id: `vol-${s.symbol}`,
        label: 'Mover',
        text: `${s.symbol} trading ${s.volumeRatio.toFixed(1)}x average volume - participation is real.`,
        tone: 'pos',
        chip: s.volumeRatio >= 2 ? 'HOT' : 'NEW',
        symbol: s.symbol,
      });
    }
  }
  for (const w of data.watchlist) {
    pool.push({
      id: `wl-${w.symbol}`,
      label: 'Watchlist',
      text: `${w.symbol} ${Math.abs(w.distanceToTarget).toFixed(1)}% from trigger - score ${w.signalScore} ${formatSignedNumber(w.scoreDelta, 0)}.`,
      tone: w.triggerState === 'approaching' || w.triggerState === 'triggered' ? 'pos' : 'neutral',
      chip: w.triggerState === 'triggered' ? 'HOT' : 'NEW',
      symbol: w.symbol,
    });
  }
  return pool;
}

/** One injected line - slides in and its highlight tint fades out over ~1.5s. */
function LiveLine({ line }: { line: LiveLineData }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 60);
    return () => window.clearTimeout(id);
  }, []);
  const hot = line.chip === 'HOT';
  return (
    <Link
      href={`/tickers/${line.symbol}?view=setup`}
      className={`flex items-start gap-2 px-3 py-1.5 transition-colors duration-[1500ms] hover:bg-line/30 ${
        settled ? 'bg-transparent' : hot ? 'bg-accent-tint' : 'bg-positive-tint'
      }`}
      style={{ animation: 'tableRowSlide 420ms ease-out' }}
    >
      <span className="relative mt-1 flex h-1.5 w-1.5 shrink-0">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${TONE_DOT[line.tone]}`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${TONE_DOT[line.tone]}`} />
      </span>
      <p className="min-w-0 flex-1 text-xs leading-snug text-ink-title">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">{line.label}</span>
        <span
          className={`mx-1.5 inline-block -translate-y-px rounded border px-1 py-px font-mono text-[8px] font-semibold uppercase tracking-[0.1em] ${
            hot ? 'border-accent-border bg-accent-tint text-accent' : 'border-positive/40 bg-positive-tint text-positive'
          }`}
        >
          {line.chip}
        </span>
        {line.text}
      </p>
      <ArrowUpRight size={12} className="mt-1 shrink-0 text-ink-dim" />
    </Link>
  );
}

interface DailyBriefCardProps {
  data: DashboardData;
  market: MarketContextSnapshot;
}

/**
 * Daily brief - the deterministic morning read, now a living thread: a pulsing
 * listening indicator, and fresh signal/watchlist lines that slide in with a NEW or
 * HOT chip and a colour wash that settles. All lines come from the deterministic
 * scan; nothing here is AI-invented.
 */
export function DailyBriefCard({ data, market }: DailyBriefCardProps) {
  const brief = useMemo(() => buildDailyBrief(data, market), [data, market]);
  const pool = useMemo(() => buildLivePool(data), [data]);
  const [liveLines, setLiveLines] = useState<LiveLineData[]>([]);
  const cursor = useRef(0);

  useEffect(() => {
    if (pool.length === 0) return;
    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* ignore */
    }
    if (reduced) return;
    const push = () => {
      const next = pool[cursor.current % pool.length];
      cursor.current += 1;
      setLiveLines((prev) => [next, ...prev.filter((l) => l.id !== next.id)].slice(0, 3));
    };
    const first = window.setTimeout(push, 5000);
    const id = window.setInterval(push, 14000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [pool]);

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-accent">
            <Sparkles size={14} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Daily brief
              <span className="relative flex h-1.5 w-1.5" title="Listening for new signals">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
              <span className="font-mono text-[8px] tracking-[0.14em] text-positive">listening</span>
            </p>
            <p className="mt-0.5 text-[13px] font-semibold leading-snug text-ink">{brief.headline}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${REGIME_CHIP[brief.regimeTone]}`}>
          {brief.regimeLabel}
        </span>
      </div>

      {/* AI narration appears here when enabled in Account; otherwise nothing renders. */}
      <BriefAiNarration brief={brief} />

      <div className="divide-y divide-line/70">
        {liveLines.map((line) => (
          <LiveLine key={line.id} line={line} />
        ))}
        {brief.lines.map((line) => {
          const key = `${line.label}-${line.text}`;
          const inner = (
            <>
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[line.tone]}`} />
              <p className="min-w-0 flex-1 text-xs leading-snug text-ink-title">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">{line.label}</span>
                <span className="mx-1.5 text-line-hair">·</span>
                {line.text}
              </p>
              {line.symbol && <ArrowUpRight size={12} className="mt-1 shrink-0 text-ink-dim" />}
            </>
          );
          return line.symbol ? (
            <Link key={key} href={`/tickers/${line.symbol}?view=setup`} className="flex items-start gap-2 px-3 py-1.5 transition hover:bg-line/30">
              {inner}
            </Link>
          ) : (
            <div key={key} className="flex items-start gap-2 px-3 py-1.5">
              {inner}
            </div>
          );
        })}
      </div>

      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        Auto-generated from the latest scan. Enable AI in Account to have it written for you.
      </p>
    </section>
  );
}
