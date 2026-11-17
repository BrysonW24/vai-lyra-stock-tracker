import type { InstrumentMove, RegionMoves, WorldSnapshot } from '@/lib/world/compute';
import { formatChange, formatLevel, PULSE_WORDS, sessionLabel } from '@/lib/world/text';
import { panelClass, panelSoftClass } from '@/lib/ui';

/**
 * The world board on the Updates page - how every market Lyra reads stands right now: Asia, Europe,
 * the US and Australia, their technology leaders, and the macro gauges. Every figure is two daily
 * closes and a subtraction (src/lib/world/compute.ts); nothing is a forecast. Rises and falls use
 * the app's usual colours, except volatility and yields, whose direction is not good or bad.
 */

const NEUTRAL_KINDS = new Set(['volatility', 'rate']);

function tone(move: InstrumentMove, value: number | null): string {
  if (value === null || NEUTRAL_KINDS.has(move.kind)) return 'text-ink-2';
  return value >= 0 ? 'text-positive' : 'text-negative';
}

function Row({ move }: { move: InstrumentMove }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-x-3 py-1 text-xs">
      <span className="min-w-0 truncate text-ink" title={`${move.label} (${move.market})`}>
        {move.label}
        {move.trading ? <span className="ml-1.5 text-[10px] uppercase tracking-wide text-ink-3">live</span> : null}
      </span>
      <span className="text-right tabular-nums text-ink-2">{formatLevel(move)}</span>
      <span className={`w-14 text-right tabular-nums ${tone(move, move.change1d)}`}>{formatChange(move.change1d, move.unit)}</span>
      <span className={`w-14 text-right tabular-nums ${tone(move, move.change5d)}`}>{formatChange(move.change5d, move.unit)}</span>
    </li>
  );
}

function RegionCard({ region }: { region: RegionMoves }) {
  const status = region.region === 'macro' ? 'Latest' : region.trading ? 'Trading now' : `${sessionLabel(region.session)} close`;
  return (
    <div className={`${panelClass} p-3`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-ink">{region.label}</h3>
        <span className="text-[11px] text-ink-3">{status}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 border-b border-line pb-1 text-[10px] uppercase tracking-wide text-ink-3">
        <span>Market</span>
        <span className="text-right">Level</span>
        <span className="w-14 text-right">Day</span>
        <span className="w-14 text-right">5 days</span>
      </div>
      <ul className="divide-y divide-line/50">
        {region.moves.map((move) => (
          <Row key={move.symbol} move={move} />
        ))}
      </ul>
    </div>
  );
}

export function WorldBoardView({ snapshot }: { snapshot: WorldSnapshot | null }) {
  if (!snapshot || snapshot.moves.length === 0) return null;
  const pulse = snapshot.techPulse;
  const notable = snapshot.notable.filter((move) => move.flags.some((flag) => flag !== 'three_month_high')).slice(0, 5);
  const readAt = new Date(snapshot.asOf).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' });
  return (
    <section className="space-y-3" aria-labelledby="world-board-title">
      <div className="space-y-1">
        <h2 id="world-board-title" className="text-sm font-semibold text-ink">
          The world right now
        </h2>
        <p className="text-xs text-ink-muted">
          Asia, Europe, the US and Australia, with each region&apos;s technology leaders. Daily closes from Yahoo, read at {readAt} Sydney time. Moves over
          five sessions, not forecasts.
        </p>
      </div>

      {pulse.level !== 'unknown' ? (
        <div className={`${panelSoftClass} space-y-1 p-3`}>
          <p className="text-xs text-ink">
            <span className="font-semibold">Tech pulse: {PULSE_WORDS[pulse.level]}.</span> {pulse.down5d} of {pulse.count} technology names and gauges are down over
            five sessions (average {formatChange(pulse.avg5d)}).
          </p>
          {pulse.worst.length ? (
            <p className="text-[11px] text-ink-muted">Biggest falls: {pulse.worst.map((move) => `${move.label} ${formatChange(move.change5d)}`).join(' · ')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {snapshot.regions.map((region) => (
          <RegionCard key={region.region} region={region} />
        ))}
      </div>

      {notable.length ? (
        <div className={`${panelClass} space-y-1 p-3`}>
          <h3 className="text-xs font-semibold text-ink">Worth knowing</h3>
          <ul className="space-y-1">
            {notable.map((move) => (
              <li key={move.symbol} className="text-xs leading-relaxed text-ink-muted">
                <span className="text-ink">{move.label}</span>: {formatChange(move.change1d, move.unit)} on the day, {formatChange(move.change5d, move.unit)} over five sessions
                {move.fromHigh !== null && move.fromHigh < 0 ? `, ${Math.abs(move.fromHigh).toFixed(1)}% below its three-month high` : ''}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.missing.length ? <p className="text-[11px] text-ink-3">Not read this time: {snapshot.missing.join(', ')}.</p> : null}
    </section>
  );
}
