'use client';

import { bestTrade, worstTrade, formatSnapshot } from '@/lib/trade-snapshots';
import { formatCurrency, formatSignedPercent, formatNumber, toneClass } from '@/lib/format';

interface TradeSnapshotExplainerProps {
  onNext: () => void;
}

/**
 * Onboarding step 6 - explains the Trade Day Snapshot concept using the real
 * demo best/worst examples from the snapshot engine. Compact: a one-paragraph
 * explainer + two squashed example cards (inline metrics + inline outcomes).
 */
export function TradeSnapshotExplainer({ onNext }: TradeSnapshotExplainerProps) {
  const best = formatSnapshot(bestTrade());
  const worst = formatSnapshot(worstTrade());

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-snug text-ink-2">
        Add a buy date to a holding and Lyra reconstructs the market context on your entry day - RSI, MACD, volume,
        MA position, signal score - then tracks what happened after. Your own history becomes lessons.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        {[
          { label: 'Strong entry', snap: best, accent: 'var(--lyra-positive)' },
          { label: 'Overextended', snap: worst, accent: 'var(--lyra-negative)' },
        ].map(({ label, snap, accent }) => (
          <div className="terminal-panel rounded-cell p-2.5" key={snap.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] font-semibold text-ink">{snap.symbol}</span>
              <span
                className="rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                style={{ borderColor: accent, color: accent }}
              >
                {label}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-3">
              Entry {snap.purchase_date} @ {formatCurrency(snap.entry_price)}
            </p>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed tabular-nums text-ink-title">
              RSI {formatNumber(snap.rsi_on_entry ?? 0)} · MACD {snap.macd_state_on_entry} · Vol{' '}
              {formatNumber(snap.volume_ratio_on_entry ?? 0, 2)}x · {formatSignedPercent(snap.price_vs_sma_50_on_entry ?? 0)} vs
              50MA · Score {formatNumber(snap.signal_score_on_entry ?? 0, 0)}
            </p>
            <div className="mt-1.5 flex items-center gap-3 border-t border-line pt-1.5 font-mono text-[11px] tabular-nums">
              {[
                ['20D', snap.return_20d ?? 0],
                ['60D', snap.return_60d ?? 0],
                ['Max DD', snap.max_drawdown_after_entry ?? 0],
              ].map(([k, v]) => (
                <span key={k as string} className="flex items-baseline gap-1">
                  <span className="text-[9px] uppercase tracking-[0.1em] text-ink-3">{k}</span>
                  <span className={toneClass(v as number)}>{formatSignedPercent(v as number)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
