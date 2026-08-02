'use client';

import { useEffect, useState } from 'react';
import {
  type TrackRecord,
  type HorizonStat,
  formatPct,
  MIN_SAMPLE_FOR_CONFIDENCE,
} from '@/lib/track-record';
import { ShareButton } from '@/components/native/ShareButton';

interface TrackRecordResponse extends TrackRecord {
  ok: boolean;
  demo?: boolean;
  window: { from: string; to: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  strong_setup: 'Strong setup',
  watchlist_setup: 'Watchlist setup',
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

/** Colour a measured return by sign - green up, red down, muted at n/a. AA on the dark card. */
function returnColour(value: number | null): string {
  if (value === null) return 'text-ink-dim';
  if (value > 0) return 'text-positive';
  if (value < 0) return 'text-negative';
  return 'text-ink';
}

function HorizonCell({ stat }: { stat: HorizonStat }) {
  if (stat.n === 0) {
    return (
      <td className="px-3 py-2 text-center font-mono text-[12px] text-ink-dim">n/a</td>
    );
  }
  return (
    <td className="px-3 py-2 text-center">
      <div className={`font-mono text-[13px] font-semibold ${returnColour(stat.avgReturnPct)}`}>
        {stat.winRatePct === null ? 'n/a' : `${stat.winRatePct.toFixed(0)}%`}
      </div>
      <div className="font-mono text-[10px] text-ink-3">
        avg {formatPct(stat.avgReturnPct)} · med {formatPct(stat.medianReturnPct)}
      </div>
    </td>
  );
}

export function TrackRecordView() {
  const [data, setData] = useState<TrackRecordResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/track-record')
      .then((r) => r.json())
      .then((json: TrackRecordResponse) => {
        if (!alive) return;
        setData(json);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4 pb-28 xl:pb-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-semibold text-ink">Track Record</h1>
          <ShareButton
            title="Lyra - measured signal track record"
            text="How Lyra's signals have actually resolved - real labelled outcomes, not a backtest."
            url="/track-record"
          />
        </div>
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-2">
          How Lyra&apos;s signals have actually resolved, measured from real labelled outcomes - not a
          backtest, not an estimate. Win rate is the share of setups that beat round-trip friction at
          each horizon; avg and median are the mean and middle forward return. This is research, not a
          promise of future results, and a signal that fires is not advice to trade.
        </p>
      </header>

      {state === 'loading' && (
        <div className="terminal-panel rounded-panel p-6 text-[13px] text-ink-3">
          Measuring the record...
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-panel border border-negative/40 bg-negative/10 p-6 text-[13px] text-negative-soft">
          Could not load the track record right now.
        </div>
      )}

      {state === 'ready' && data && (data.provenance === 'empty' || data.groups.length === 0) && (
        <div className="terminal-panel rounded-panel p-6">
          <p className="text-[14px] font-medium text-ink">Not yet measured</p>
          <p className="mt-1 text-[13px] text-ink-3">
            {data.demo
              ? 'Running in demo mode - the live outcome history is not connected here.'
              : 'The outcome-labelling loop has not accumulated enough resolved signals to report yet. This page will fill in as signals mature - it will never show a number that was not measured.'}
          </p>
        </div>
      )}

      {state === 'ready' && data && data.provenance === 'measured' && data.groups.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
            <span>
              <span className="font-mono text-ink-title">{data.totalOutcomes}</span> resolved signals
            </span>
            {data.window && (
              <span>
                {data.window.from} to {data.window.to}
              </span>
            )}
            <span>{data.signalTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}</span>
          </div>

          {data.groups.map((group) => {
            const thin = group.totalRows < MIN_SAMPLE_FOR_CONFIDENCE;
            return (
              <section key={group.signalStatus} className="terminal-panel rounded-panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-ink">{statusLabel(group.signalStatus)}</h2>
                  <span className="font-mono text-[11px] text-ink-3">
                    {group.totalRows} signals{thin ? ' · still measuring' : ''}
                  </span>
                </div>
                {thin ? (
                  <p className="text-[12px] text-accent">
                    Below {MIN_SAMPLE_FOR_CONFIDENCE} resolved signals - too few to read as a rate yet. Shown for
                    transparency, not confidence.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                          <th className="px-3 py-1 text-left font-medium">Horizon</th>
                          <th className="px-3 py-1 text-center font-medium">1 day</th>
                          <th className="px-3 py-1 text-center font-medium">5 days</th>
                          <th className="px-3 py-1 text-center font-medium">20 days</th>
                          <th className="px-3 py-1 text-center font-medium">60 days</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-line">
                          <td className="px-3 py-2 text-left text-[11px] text-ink-2">Win rate</td>
                          {group.horizons.map((h) => (
                            <HorizonCell key={h.horizon} stat={h} />
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}

          <p className="text-[11px] leading-relaxed text-ink-dim">
            Measured from the {data.totalOutcomes} signals the engine has labelled with forward returns.
            Past outcomes do not predict future ones. Nothing here is financial advice.
          </p>
        </>
      )}
    </div>
  );
}
