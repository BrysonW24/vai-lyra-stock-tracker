'use client';

import { useMemo, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { SignalDrawer } from '@/components/SignalDrawer';
import { TickerLogo } from '@/components/TickerLogo';
import { FullSetupLink } from '@/components/FullSetupLink';
import { PrimeSetupsHelp } from '@/components/PrimeSetupsHelp';
import { derivePrimeSetups, type PrimeSetup } from '@/lib/prime-setups';
import { formatSignedNumber } from '@/lib/format';

function SetupRow({ item, onOpen }: { item: PrimeSetup; onOpen: (s: SignalRow) => void }) {
  const s = item.signal;
  const isPrime = item.tier === 'prime';
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 transition hover:bg-line/30">
      <button type="button" onClick={() => onOpen(s)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <TickerLogo symbol={s.symbol} companyName={s.companyName} size={14} />
          <span className="font-mono text-[12px] font-semibold text-ink">{s.symbol}</span>
          <span className="font-mono text-[11px] text-ink-2">{s.score}</span>
          <span className={`font-mono text-[10px] ${s.scoreDelta >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatSignedNumber(s.scoreDelta, 0)}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] ${
              isPrime ? 'border-positive/40 bg-positive-tint text-positive' : 'border-accent-border bg-accent-tint text-accent'
            }`}
          >
            {isPrime ? 'Prime' : 'Watch'}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-dim">{item.confirming}/4 confirming</span>
        </div>
        <p className="truncate text-[10px] leading-snug text-ink-2">
          {item.reasons.length > 0 ? item.reasons.join(' · ') : 'Structure in place, momentum not yet confirming.'}
        </p>
      </button>
      <FullSetupLink symbol={s.symbol} />
    </div>
  );
}

/**
 * Prime Setups - the deterministic "what is worth acting on" surface. It calls out the
 * strongest confirming setups now ("worth a look") and the names closing in to a trigger
 * ("watch"), each with the plain-English reasons. The engine flags structure + momentum;
 * it never says buy or sell. Research only.
 */
export function PrimeSetupsBoard({ signals }: { signals: SignalRow[] }) {
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const { prime, approaching } = useMemo(() => derivePrimeSetups(signals), [signals]);
  const total = prime.length + approaching.length;

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-positive">
            <Crosshair size={14} />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Prime setups
              <span className="relative flex h-1.5 w-1.5" title="Strongest confirming setups + names closing in">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
              The strongest confirming setups now, and the names closing in to watch.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[10px] text-ink-3">{total} flagged</span>
          <PrimeSetupsHelp />
        </div>
      </div>

      {total === 0 ? (
        <div className="px-3 py-3">
          <p className="text-[11px] leading-snug text-ink-3">
            Nothing prime or close right now - the radar is quiet. This is honest: no setup is being forced.
          </p>
        </div>
      ) : (
        <div>
          <div className="border-b border-line/70">
            <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" /> Worth a look now
            </p>
            {prime.length === 0 ? (
              <p className="px-3 pb-2 text-[10px] text-ink-3">No fully-confirmed prime setup right now - watch the names below.</p>
            ) : (
              <div className="divide-y divide-line/70">
                {prime.map((item) => (
                  <SetupRow key={item.signal.symbol} item={item} onOpen={setSelected} />
                ))}
              </div>
            )}
          </div>

          {approaching.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Closing in - watch
              </p>
              <div className="divide-y divide-line/70">
                {approaching.map((item) => (
                  <SetupRow key={item.signal.symbol} item={item} onOpen={setSelected} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        Deterministic - flags structure + momentum, never a buy/sell instruction. Research only.
      </p>
      <SignalDrawer signal={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
