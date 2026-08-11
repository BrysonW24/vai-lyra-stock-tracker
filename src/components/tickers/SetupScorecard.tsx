import type { ScoreBreakdown, SignalRow, SignalStatus } from '@/types/scanner';
import { buildScoreBreakdown } from '@/lib/score-breakdown';
import { formatSignedPercent } from '@/lib/format';

/**
 * Setup read - the decision panel that replaced the fabricated 7-bar "score history"
 * (which invented a lead-in and only pinned the final bar to truth). Every value here is
 * REAL: the five score factors are the server-computed breakdown, each annotated with the
 * live metric that drove it and the band Lyra's oversold-recovery strategy wants to see.
 * A trader reads this to know WHY the name scores what it does and which factors are missing.
 * Research only - a high score means beaten-down and turning up, never "breaking out".
 */

const VERDICT: Record<SignalStatus, { line: string; tone: string }> = {
  strong_setup: { line: 'Valid oversold-recovery setup - the factors are aligned', tone: 'text-positive' },
  watchlist_setup: { line: 'Setup forming - not every factor has confirmed yet', tone: 'text-accent' },
  weakening: { line: 'Setup breaking down - momentum is rolling over', tone: 'text-negative' },
  overextended: { line: 'Past the reset zone - too extended for a fresh entry', tone: 'text-negative' },
  invalidated: { line: 'Setup invalidated - the thesis no longer holds', tone: 'text-negative' },
  no_signal: { line: 'No oversold-recovery setup on this name right now', tone: 'text-ink-2' },
};

/** The live metric + target band behind each factor, read straight off the signal. */
function reading(signal: SignalRow, key: keyof ScoreBreakdown): { metric: string; band: string } {
  switch (key) {
    case 'rsiScore':
      return { metric: `RSI ${signal.rsi.toFixed(1)}`, band: 'reset band 35-50' };
    case 'macdScore':
      return { metric: `hist ${signal.macdHistogram.toFixed(2)} · ${signal.macdState.toLowerCase()}`, band: 'negative, turning up' };
    case 'priceLocationScore':
      return { metric: `${signal.distanceFromLow.toFixed(1)}% above 60d low`, band: 'within ~10%' };
    case 'trendScore':
      return { metric: `${formatSignedPercent(signal.priceVsSma200)} vs 200MA`, band: 'constructive trend' };
    case 'volumeScore':
      return { metric: `${signal.volumeRatio.toFixed(2)}x volume`, band: '0.8x+ confirms' };
    default:
      return { metric: '', band: '' };
  }
}

/** Pass / partial / missing from the factor's share of its own max - the server's call, not ours. */
function tone(pct: number): { bar: string; text: string; tag: string } {
  if (pct >= 66) return { bar: 'bg-positive', text: 'text-positive', tag: 'in band' };
  if (pct >= 33) return { bar: 'bg-accent', text: 'text-accent', tag: 'partial' };
  return { bar: 'bg-negative', text: 'text-negative', tag: 'missing' };
}

export function SetupScorecard({ signal }: { signal: SignalRow }) {
  const factors = buildScoreBreakdown(signal.scoreBreakdown);
  const verdict = VERDICT[signal.status];
  const inBand = factors.filter((f) => f.pct >= 66).length;

  return (
    <section className="terminal-panel flex flex-col gap-3 rounded-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Setup read · oversold-recovery</p>
          <p className={`mt-1 text-[12px] leading-snug ${verdict.tone}`}>{verdict.line}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-semibold leading-none tabular-nums text-ink">
            {signal.score}
            <span className="text-sm text-ink-3">/100</span>
          </div>
          <p className="mt-1 text-[10px] text-ink-3">{inBand} of {factors.length} factors in band</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {factors.map((f) => {
          const t = tone(f.pct);
          const r = reading(signal, f.key);
          return (
            <div key={f.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-ink">{f.label}</span>
                <span className={`font-mono text-[11px] tabular-nums ${t.text}`}>{f.value}/{f.max}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-line/70">
                <div className={`h-full ${t.bar}`} style={{ width: `${f.pct}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-tight">
                <span className="truncate text-ink-3">{r.metric}</span>
                <span className={`shrink-0 ${t.text}`}>{r.band}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-line pt-2 text-[10px] leading-snug text-ink-dim">
        Five factors, scored server-side and summed to the {signal.score}. A high score means beaten-down and turning up,
        not breaking out. Research only, never advice.
      </p>
    </section>
  );
}
