'use client';

import Link from 'next/link';
import { bumpAiUsage } from '@/lib/usage-store';
import { useEffect, useState } from 'react';
import { ArrowUpRight, LineChart } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import { TradingViewChart } from '@/components/TradingViewChart';
import { DetailDrawer } from '@/components/DetailDrawer';
import { StatusBadge } from '@/components/StatusBadge';
import { TickerLogo } from '@/components/TickerLogo';
import { loadAi } from '@/lib/account';
import { buildScoreBreakdown } from '@/lib/score-breakdown';
import { formatNumber, formatSignedNumber, toneClass, trendArrow } from '@/lib/format';

// Plain-English "what is this" for the metrics that drive the score.
const HELP = {
  score: 'A 0-100 oversold-recovery score built from RSI, MACD, price location, trend and volume. Higher = a more beaten-down name showing an early turn (RSI in the reset band, a still-negative-but-improving MACD histogram, price near its 60-day low) - a dip catch, not buying strength. Research, not advice.',
  rsi: 'RSI (0-100): how hard the stock has been bought or sold lately. Low and turning up can mean it is recovering; very high can mean it has run hot.',
  macd: 'MACD histogram: recent momentum vs the slightly longer trend. Shrinking toward zero / turning up means selling pressure is easing - an early turn signal.',
  volume: 'Volume vs its own average. Above 1x means heavier-than-usual participation confirming the move.',
};

function Bar({ label, value, max, pct }: { label: string; value: number; max: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] text-ink-3">
        <span>{label}</span>
        <span className="text-ink-title">{value}/{max}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-deep to-positive" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface FreshSignal {
  asOf: string;
  signal: Partial<SignalRow>;
  outcome: { summary: string; sampleSize: number; source: 'live' | 'sample' } | null;
}

/**
 * Optional AI phrasing of the open signal. Grounding is server-owned (the route
 * recomputes the signal deterministically from the symbol alone), so this can never
 * show a number the engine did not produce. Renders nothing when AI is unavailable.
 */
function SignalAiNarration({ symbol }: { symbol: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    const ai = loadAi();
    const hasKey = !!ai.apiKey?.trim();
    const serverBacked = ai.provider === 'openai' || ai.provider === 'google';
    if (!hasKey && !serverBacked) return;

    let cancelled = false;
    bumpAiUsage();
    fetch('/api/ai/explain-signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol, ai }),
    })
      .then((res) => res.json())
      .then((data: { ok?: boolean; text?: string }) => {
        if (!cancelled && data?.ok && data.text) setText(data.text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!text) return null;

  return (
    <div className="rounded-cell border border-accent-border/60 bg-accent-tint/60 p-2.5">
      <AiGeneratedLabel size={11} />
      <p className="mt-1 text-[11px] leading-snug text-ink-title">{text}</p>
    </div>
  );
}

/**
 * Signal explainer drawer - tap a row to learn what the Score / RSI / MACD / Volume
 * actually mean for this stock, the component breakdown, the plain-English read, why the
 * setup fired, and what is still missing. Built on the reusable DetailDrawer.
 *
 * On open it refetches its ONE symbol from /api/signals/[symbol] so a drawer opened
 * minutes after page load shows current engine numbers, plus how similar past setups
 * actually resolved - falling back silently to the page-load snapshot.
 */
export function SignalDrawer({ signal: snapshot, onClose }: { signal: SignalRow | null; onClose: () => void }) {
  const symbol = snapshot?.symbol ?? null;
  const [fresh, setFresh] = useState<FreshSignal | null>(null);

  useEffect(() => {
    setFresh(null);
    if (!symbol) return;
    let cancelled = false;
    fetch(`/api/signals/${symbol}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean } & Partial<FreshSignal>) => {
        if (!cancelled && data?.ok && data.signal && data.asOf) {
          setFresh({ asOf: data.asOf, signal: data.signal, outcome: data.outcome ?? null });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!snapshot) return null;

  const signal: SignalRow = fresh?.signal ? { ...snapshot, ...fresh.signal } : snapshot;
  const b = signal.scoreBreakdown;

  // Quick actions - the full interactive chart + the ticker page. Rendered both at the top (so a
  // strong setup opens straight to "see the chart") and beside the embedded chart at the bottom.
  const actionLinks = (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/tickers/${signal.symbol}?view=setup`}
        className="inline-flex items-center gap-1.5 rounded-cell border border-blue-deep bg-blue-tint px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-pending transition hover:bg-blue-deep/30"
      >
        <LineChart size={13} /> Full setup chart
      </Link>
      <Link
        href={`/tickers/${signal.symbol}`}
        className="inline-flex items-center gap-1 rounded-cell border border-line-strong bg-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2 transition hover:text-ink"
      >
        Open {signal.symbol} <ArrowUpRight size={12} />
      </Link>
    </div>
  );

  return (
    <DetailDrawer
      open={!!signal}
      onClose={onClose}
      title={`${signal.symbol} · ${signal.score}/100`}
      subtitle={signal.companyName}
      badge={
        <span className="mb-1 inline-flex items-center gap-1.5">
          <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={16} />
          <StatusBadge status={signal.status} />
          <span className={`font-mono text-[11px] ${toneClass(signal.scoreDelta)}`}>{formatSignedNumber(signal.scoreDelta, 0)}</span>
        </span>
      }
    >
      <p className="text-[11px] leading-snug text-ink-2">{HELP.score}</p>

      <p className="font-mono text-[10px] text-ink-dim">
        {fresh
          ? `Refreshed ${new Date(fresh.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - live engine numbers`
          : 'As of last page load - refreshing live numbers…'}
      </p>

      {/* Quick actions up top so a strong setup opens straight into the chart / ticker page. */}
      {actionLinks}

      {/* Score component breakdown - point contribution per factor (value / max),
          shared with the ticker page via buildScoreBreakdown so they never drift.
          NOT the raw indicator readings - those are in the section below. */}
      <div className="space-y-2 rounded-cell border border-line-strong bg-panel p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">What makes the score</p>
        <p className="-mt-1 text-[10px] leading-snug text-ink-dim">
          Points each factor added, out of its max - they sum to the {signal.score} score. Your live RSI / MACD / volume are below.
        </p>
        {buildScoreBreakdown(b).map((c) => (
          <Bar key={c.label} label={c.label} value={c.value} max={c.max} pct={c.pct} />
        ))}
      </div>

      {/* Live metric values + plain-English help */}
      <div className="space-y-2">
        {[
          { k: 'RSI', v: `${formatNumber(signal.rsi)} ${trendArrow(signal.rsiDelta)}`, help: HELP.rsi },
          { k: 'MACD hist', v: `${formatNumber(signal.macdHistogram, 2)} ${trendArrow(signal.histDelta)}`, help: HELP.macd },
          { k: 'Volume', v: `${formatNumber(signal.volumeRatio, 2)}x`, help: HELP.volume },
        ].map((m) => (
          <div key={m.k} className="rounded-cell border border-line-strong bg-panel p-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-ink-3">{m.k}</span>
              <span className="text-ink">{m.v}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-2">{m.help}</p>
          </div>
        ))}
      </div>

      {/* Plain-English read */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">The read</p>
        <div className="space-y-1.5 text-[11px] leading-snug text-ink-title">
          <p>{signal.summary.rsi}</p>
          <p>{signal.summary.macd}</p>
          <p>{signal.summary.volume}</p>
          <p>{signal.summary.trend}</p>
        </div>
      </div>

      <SignalAiNarration symbol={signal.symbol} />

      {/* Why it fired / what's missing / risks */}
      {signal.explanation.triggeredBecause.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-positive">Why this setup</p>
          <ul className="space-y-1 text-[11px] leading-snug text-ink-title">
            {signal.explanation.triggeredBecause.map((t) => (
              <li key={t} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-positive" />{t}</li>
            ))}
          </ul>
        </div>
      )}
      {signal.explanation.missingConfirmation.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Still missing</p>
          <ul className="space-y-1 text-[11px] leading-snug text-ink-title">
            {signal.explanation.missingConfirmation.map((t) => (
              <li key={t} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded-cell border border-line-strong bg-panel px-3 py-2 font-mono text-xs">
        <span className="text-ink-3">Action state</span>
        <span className="text-accent">{signal.actionState.replaceAll('_', ' ')}</span>
      </div>

      {/* How similar setups resolved - live rows are engine-measured, sample rows are illustrative; the badge says which. */}
      {fresh?.outcome && (
        <div className="rounded-cell border border-line-strong bg-panel p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">How setups like this resolved</p>
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">
              {fresh.outcome.source === 'live' ? 'measured history' : 'sample data'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ink-title">{fresh.outcome.summary}</p>
          <p className="mt-1 text-[10px] leading-snug text-ink-dim">Past resolution is not a prediction. Research, not advice.</p>
        </div>
      )}

      {/* The chart itself, embedded - the essentials (candles + BB / RSI / MACD), the same
          full-setup studies the ?view=setup page opens with. So you can inspect the setup
          without leaving the drawer; the links open the full interactive version. */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Setup chart</p>
        <div className="overflow-hidden rounded-cell border border-line-strong">
          <TradingViewChart
            symbol={signal.symbol}
            companyName={signal.companyName}
            compact
            indicators={{ bb: true, rsi: true, macd: true }}
          />
        </div>
      </div>

      {actionLinks}
    </DetailDrawer>
  );
}
