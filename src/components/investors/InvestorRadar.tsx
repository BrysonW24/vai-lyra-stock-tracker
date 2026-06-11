'use client';

import { TickerLogo } from '@/components/TickerLogo';
import { FILING_CAVEAT, type Investor, type InvestorAction } from '@/lib/world-radar';

interface InvestorRadarProps {
  investors: Investor[];
  themesBySlug: Record<string, { name: string; emoji: string }>;
  smallCapSymbols: string[];
}

/** Colour-coded chip tones per disclosed action. Accumulation greens, distribution amber/red. */
const ACTION_CHIP: Record<InvestorAction, string> = {
  new: 'border-[#1f5132] bg-[#0f2417] text-[#43d18b]',
  increase: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  hold: 'border-[#3a4754] bg-[#0d141c] text-[#a8b5c2]',
  reduce: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  exit: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
};

const ACTION_LABEL: Record<InvestorAction, string> = {
  new: 'NEW',
  increase: 'ADD',
  hold: 'HOLD',
  reduce: 'TRIM',
  exit: 'EXIT',
};

const NOT_SHOWN: string[] = [
  'Short positions - a long position here can be one leg of a hedged pair you cannot see.',
  'Options detail beyond basic put/call disclosure - strikes, expiries and intent stay hidden.',
  'Private positions - venture stakes and non-public holdings never appear.',
  'Non-US listings - international books are invisible to 13F.',
  'Timing - filings land up to 45 days after quarter end, and positions may have changed since.',
];

/**
 * Investor Radar - what tracked elite managers disclosed in their latest filings.
 * The point of this page is the overlap between disciplined money and small caps:
 * a manager with a real research budget showing up in a small name is the signal.
 * All filing data is delayed and incomplete - research context, never copy-trading.
 */
export function InvestorRadar({ investors, themesBySlug, smallCapSymbols }: InvestorRadarProps) {
  const smallCapSet = new Set(smallCapSymbols);

  const newPositions = investors.reduce(
    (acc, inv) => acc + inv.moves.filter((m) => m.action === 'new').length,
    0,
  );
  const smallCapMoves = investors.reduce(
    (acc, inv) => acc + inv.moves.filter((m) => smallCapSet.has(m.symbol)).length,
    0,
  );

  const holdersBySymbol = new Map<string, Set<string>>();
  for (const inv of investors) {
    for (const move of inv.moves) {
      const holders = holdersBySymbol.get(move.symbol) ?? new Set<string>();
      holders.add(inv.id);
      holdersBySymbol.set(move.symbol, holders);
    }
  }
  const convergence = [...holdersBySymbol.entries()]
    .filter(([, holders]) => holders.size >= 2)
    .map(([symbol, holders]) => ({ symbol, count: holders.size }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-[#9a6a1f] bg-[#2a1f0f] p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#f3a33a]">Delayed filing data</p>
        <p className="mt-1 text-[10px] leading-4 text-[#d9c9a8]">{FILING_CAVEAT}</p>
      </section>

      <div className="grid grid-cols-3 gap-1.5">
        {([
          ['Managers tracked', investors.length, 'text-[#eef3f8]'],
          ['New positions', newPositions, 'text-[#43d18b]'],
          ['Small caps held', smallCapMoves, 'text-[#a78bfa]'],
        ] as const).map(([label, count, tone]) => (
          <div className="rounded-md border border-[#263241] bg-[#0d141c] p-2" key={label}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
            <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{count}</p>
          </div>
        ))}
      </div>

      {investors.map((inv) => (
        <section className="terminal-panel rounded-md p-3" key={inv.id}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-[13px] font-semibold text-[#eef3f8]">{inv.name}</h2>
            <span className="text-[10px] text-[#8190a0]">{inv.firm}</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[#8190a0]">
            {inv.filingType} - period ended {inv.periodEnd} - filed {inv.filingDate}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[#a8b5c2]">{inv.strategy}</p>

          {inv.themes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {inv.themes.map((slug) => {
                const theme = themesBySlug[slug];
                return (
                  <span
                    className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 text-[9px] text-[#a8b5c2]"
                    key={slug}
                  >
                    {theme ? `${theme.emoji} ${theme.name}` : slug}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-2 space-y-1">
            {inv.moves.map((move, i) => (
              <div
                className="rounded-md border border-[#1b2530] bg-[#0d1117] px-2 py-1.5"
                key={`${move.symbol}-${move.action}-${i}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] ${ACTION_CHIP[move.action]}`}
                  >
                    {ACTION_LABEL[move.action]}
                  </span>
                  <TickerLogo symbol={move.symbol} companyName={move.name} size={13} />
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-[#eef3f8]">{move.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-[#8190a0]">{move.name}</span>
                  {smallCapSet.has(move.symbol) && (
                    <span className="shrink-0 rounded border border-[#4c3a7a] bg-[#1a1430] px-1 py-px font-mono text-[8px] tracking-[0.08em] text-[#a78bfa]">
                      SMALL CAP
                    </span>
                  )}
                  {typeof move.weightPct === 'number' && (
                    <span className="shrink-0 font-mono text-[10px] text-[#a8b5c2]">
                      {move.weightPct.toFixed(1)}% of book
                    </span>
                  )}
                </div>
                {move.note && <p className="mt-1 text-[10px] leading-4 text-[#8190a0]">{move.note}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="terminal-panel rounded-md p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Across managers</p>
        <p className="mt-1 text-[10px] leading-4 text-[#a8b5c2]">
          Symbols touched by 2+ tracked managers. Convergence reads as conviction - but it is also how crowding starts.
        </p>
        {convergence.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {convergence.map(({ symbol, count }) => (
              <span
                className="rounded border border-[#2a4a7a] bg-[#0f1a2c] px-1.5 py-0.5 font-mono text-[10px] text-[#7fb0ff]"
                key={symbol}
              >
                {symbol} x{count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[10px] text-[#8190a0]">No symbol overlap across tracked managers this period.</p>
        )}
      </section>

      <section className="terminal-panel rounded-md p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">What 13F does not show</p>
        <ul className="mt-1.5 space-y-1 text-[10px] leading-4 text-[#8190a0]">
          {NOT_SHOWN.map((item) => (
            <li className="flex gap-1.5" key={item}>
              <span className="shrink-0 text-[#3a4754]">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
