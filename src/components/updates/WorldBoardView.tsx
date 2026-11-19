import type { InstrumentMove, RegionMoves, WorldSnapshot } from '@/lib/world/compute';
import { getWorldSnapshot } from '@/lib/world/fetch';
import { formatChange, formatLevel, PULSE_WORDS, regionParts, sessionLabel } from '@/lib/world/text';
import { panelClass, panelSoftClass } from '@/lib/ui';

/**
 * The world board on the Updates page - how every market Lyra reads stands right now: Asia, Europe,
 * the US and Australia, their technology leaders, and the macro gauges. Every figure is two daily
 * closes and a subtraction (src/lib/world/compute.ts); nothing is a forecast. Rises and falls use
 * the app's usual colours, except volatility and yields, whose direction is not good or bad.
 *
 * Each card is headed by its region's day. A market from another day says so: a later one carries
 * its date beside its name, an earlier one (shut for a holiday) sits under "As of" that day, and the
 * index futures sit under their own session - live overnight, never under the cash market's close.
 */

const NEUTRAL_KINDS = new Set(['volatility', 'rate']);

function tone(move: InstrumentMove, value: number | null): string {
  if (value === null || NEUTRAL_KINDS.has(move.kind)) return 'text-ink-2';
  return value >= 0 ? 'text-positive' : 'text-negative';
}

/** The move's own day when it is not `against`, the day the rows around it are dated by. */
function ownDay(move: InstrumentMove, against: string | null | undefined): string | null {
  return against && move.session !== against ? move.session : null;
}

function Row({ move, against }: { move: InstrumentMove; against: string | null }) {
  const own = ownDay(move, against);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-x-3 py-1 text-xs">
      <span className="min-w-0 truncate text-ink" title={`${move.label} (${move.market})`}>
        {move.label}
        {move.trading ? <span className="ml-1.5 text-[10px] uppercase tracking-wide text-ink-3">live</span> : null}
        {own ? <span className="ml-1.5 text-[10px] text-ink-3">{sessionLabel(own)}</span> : null}
      </span>
      <span className="text-right tabular-nums text-ink-2">{formatLevel(move)}</span>
      <span className={`w-14 text-right tabular-nums ${tone(move, move.change1d)}`}>{formatChange(move.change1d, move.unit)}</span>
      <span className={`w-14 text-right tabular-nums ${tone(move, move.change5d)}`}>{formatChange(move.change5d, move.unit)}</span>
    </li>
  );
}

/** Rows that belong to one other session than the card's, under a line naming it. */
function Group({ title, moves }: { title: string; moves: InstrumentMove[] }) {
  return (
    <div className="mt-1.5 border-t border-line pt-1">
      <p className="text-[10px] uppercase tracking-wide text-ink-3">{title}</p>
      <ul className="divide-y divide-line/50">
        {moves.map((move) => (
          <Row key={move.symbol} move={move} against={null} />
        ))}
      </ul>
    </div>
  );
}

function RegionCard({ region }: { region: RegionMoves }) {
  const { current, earlier, futures } = regionParts(region);
  // A region read only through its futures has no close to name: the futures carry their own date.
  const cash = current.length > 0 || earlier.length > 0;
  const status = region.region === 'macro' ? 'Latest' : !cash ? '' : region.trading ? 'Trading now' : `${sessionLabel(region.session)} close`;
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
      {current.length ? (
        <ul className="divide-y divide-line/50">
          {current.map((move) => (
            <Row key={move.symbol} move={move} against={region.session} />
          ))}
        </ul>
      ) : null}
      {futures.map((group) => (
        <Group key={`futures-${group.session}`} title={`${group.live ? 'Futures now' : 'Futures'}, ${sessionLabel(group.session)}`} moves={group.moves} />
      ))}
      {earlier.map((group) => (
        <Group key={`earlier-${group.session}`} title={`As of ${sessionLabel(group.session)}`} moves={group.moves} />
      ))}
    </div>
  );
}

/** "Tokyo Electron -8.0%", with its own day when that is not its region's: "Tokyo Electron -8.0% (Fri 20 Nov)". */
function pulseChip(move: InstrumentMove): string {
  const own = ownDay(move, move.regionSession);
  return `${move.label} ${formatChange(move.change5d)}${own ? ` (${sessionLabel(own)})` : ''}`;
}

export function WorldBoardView({ snapshot }: { snapshot: WorldSnapshot | null }) {
  if (!snapshot || snapshot.moves.length === 0) return null;
  const pulse = snapshot.techPulse;
  const notable = snapshot.notable.filter((move) => move.flags.some((flag) => flag !== 'three_month_high')).slice(0, 5);
  const regionDay = (move: InstrumentMove) => snapshot.regions.find((region) => region.region === move.region)?.session ?? move.regionSession ?? null;
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
          {pulse.worst.length ? <p className="text-[11px] text-ink-muted">Biggest falls: {pulse.worst.map(pulseChip).join(' · ')}</p> : null}
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
            {notable.map((move) => {
              const own = ownDay(move, regionDay(move));
              return (
                <li key={move.symbol} className="text-xs leading-relaxed text-ink-muted">
                  <span className="text-ink">{move.label}</span>
                  {own ? ` (${sessionLabel(own)})` : ''}: {formatChange(move.change1d, move.unit)} on the day, {formatChange(move.change5d, move.unit)} over five sessions
                  {move.fromHigh !== null && move.fromHigh < 0 ? `, ${Math.abs(move.fromHigh).toFixed(1)}% below its three-month high` : ''}.
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {snapshot.missing.length ? <p className="text-[11px] text-ink-3">Not read this time: {snapshot.missing.join(', ')}.</p> : null}
    </section>
  );
}

/**
 * The board as the Updates page streams it in, behind its own Suspense boundary: the market read
 * above it renders at once and never waits for forty quotes. The board's own read is bounded
 * (BOARD_DEADLINE_MS in src/lib/world/fetch.ts), and a board that cannot be read is no board.
 */
export async function WorldBoardLoader({ load = () => getWorldSnapshot() }: { load?: () => Promise<WorldSnapshot> }) {
  const snapshot = await load().catch(() => null);
  return <WorldBoardView snapshot={snapshot} />;
}
