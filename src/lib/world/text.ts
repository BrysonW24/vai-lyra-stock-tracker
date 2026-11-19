/**
 * The world snapshot in words - for a person (Telegram HTML) and for a model (the facts it is
 * grounded on). Both are written by code from the same snapshot, so the figure a reader sees and the
 * figure the model was given are the same characters: the prose guard checks a model's numbers
 * against exactly this text.
 *
 * Wording rules: a move is described, never interpreted ("down 9.1% over five sessions", not
 * "crashing"), the day a figure belongs to is always said, a market that is still trading says so,
 * and nothing here suggests what to do. A move from another day than its region's carries that day
 * beside its figures (Tokyo shut for a holiday while Seoul trades: "As of Fri 20 Nov: Nikkei 225
 * -1.4%"), and index futures, which trade through the night, stand on their own line under their own
 * date - never under the cash market's close.
 */
import { escapeHtml } from '@/lib/notifications/telegram-templates';
import { THRESHOLDS, type InstrumentMove, type MoveFlag, type RegionMoves, type TechPulse, type WorldSnapshot } from './compute';
import { REGION_LABEL, type WorldRegion } from './instruments';

const SIGN = (value: number) => (value > 0 ? '+' : value < 0 ? '-' : '');

/** "+1.2%", "-0.15 pts" (a yield), or "n/a". */
export function formatChange(value: number | null, unit: 'percent' | 'points' = 'percent'): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  if (unit === 'points') return `${SIGN(value)}${Math.abs(value).toFixed(2)} pts`;
  return `${SIGN(value)}${Math.abs(value).toFixed(1)}%`;
}

/**
 * A price under 1: four significant figures, never fewer than two decimals - 0.50, 0.004, 0.0035.
 * Fixed cents would print a share trading at a fraction of a cent as 0.00, a price of nothing.
 */
function smallLevel(value: number): string {
  const places = Math.min(20, Math.max(2, 3 - Math.floor(Math.log10(value))));
  return value.toFixed(places).replace(/(\.\d{2,}?)0+$/, '$1');
}

/** A level as people read it: 59,662 for an index, 4.12% for a yield, 236.80 for a share, 0.004 for a share under a cent. */
export function formatLevel(move: Pick<InstrumentMove, 'last' | 'kind'>): string {
  if (move.kind === 'rate') return `${move.last.toFixed(2)}%`;
  if (move.kind === 'fx') return move.last.toFixed(4);
  if (move.last > 0 && move.last < 1) return smallLevel(move.last);
  const places = move.last >= 1000 ? 0 : 2;
  return move.last.toLocaleString('en-AU', { minimumFractionDigits: places, maximumFractionDigits: places });
}

const FLAG_WORDS: Record<Exclude<MoveFlag, 'correction' | 'bear_market'>, string> = {
  sharp_drop: 'a sharp fall on the day',
  sharp_rise: 'a sharp rise on the day',
  week_selloff: 'a sell-off week',
  week_rally: 'a rally week',
  three_month_high: 'at a three-month high',
  stress: 'volatility at a stressed level',
};

/**
 * A drawdown flag says the band that set it, and the bands differ by kind (THRESHOLDS in compute.ts):
 * 10% and 20% for an index, 20% and 35% for a share or a coin.
 */
function flagWords(move: InstrumentMove, flag: MoveFlag): string {
  if (flag !== 'correction' && flag !== 'bear_market') return FLAG_WORDS[flag];
  const band = flag === 'correction' ? THRESHOLDS[move.kind].correction : THRESHOLDS[move.kind].bear;
  // Only a kind with a band can carry the flag; the words still say something true if one ever does not.
  return band === null ? 'well below its three-month high' : `more than ${band}% below its three-month high`;
}

/** "Tue 18 Nov" for a YYYY-MM-DD session. */
export function sessionLabel(session: string | null): string {
  if (!session) return 'latest session';
  const date = new Date(`${session}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? session
    : date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const PULSE_WORDS: Record<TechPulse['level'], string> = {
  selloff: 'a technology sell-off',
  weak: 'technology under pressure',
  steady: 'technology steady',
  firm: 'technology firm',
  rally: 'a technology rally',
  unknown: 'not enough technology names read to say',
};

/** The day a move's figures belong to when it is not `against`, the day its line is dated by - else null. */
function ownDay(move: InstrumentMove, against: string | null | undefined): string | null {
  return against && move.session !== against ? move.session : null;
}

/** The day a snapshot's move is dated by: its region's, from the snapshot, else what the move carries. */
function regionDayOf(snapshot: WorldSnapshot, move: InstrumentMove): string | null {
  return snapshot.regions.find((region) => region.region === move.region)?.session ?? move.regionSession ?? null;
}

/** A region's moves as its lines print them. */
export interface RegionParts {
  /** On the region's day - or a later one, and each of those carries its own date. */
  current: InstrumentMove[];
  /**
   * From an earlier session than the region's day (a market shut for a holiday), newest first. Their
   * day move is that session's, so it is printed under that session's date, never as the region's day.
   */
  earlier: Array<{ session: string; moves: InstrumentMove[] }>;
  /**
   * Index futures, apart from the cash market, newest session first. `live` when they are already
   * trading the next session, or trading alongside an open cash market.
   */
  futures: Array<{ session: string; live: boolean; moves: InstrumentMove[] }>;
}

export function regionParts(region: RegionMoves): RegionParts {
  const current: InstrumentMove[] = [];
  const earlier = new Map<string, InstrumentMove[]>();
  const futures = new Map<string, InstrumentMove[]>();
  const add = (groups: Map<string, InstrumentMove[]>, move: InstrumentMove) => groups.set(move.session, [...(groups.get(move.session) ?? []), move]);
  for (const move of region.moves) {
    if (move.kind === 'future') add(futures, move);
    else if (region.session !== null && move.session < region.session) add(earlier, move);
    else current.push(move);
  }
  const newestFirst = (groups: Map<string, InstrumentMove[]>) => [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  const day = region.session;
  return {
    current,
    earlier: newestFirst(earlier).map(([session, moves]) => ({ session, moves })),
    futures: newestFirst(futures).map(([session, moves]) => ({
      session,
      live: day !== null && (session > day || (session === day && region.trading)),
      moves,
    })),
  };
}

/** Where the facts tie a figure to its own day, when that is not the day of the block it sits in. */
function ownSessionFact(move: InstrumentMove, against: string | null): string {
  const own = ownDay(move, against);
  if (!own || !against) return '';
  return own < against ? `, last session read ${own} (not ${against})` : `, session ${own} (not ${against})`;
}

function moveFact(move: InstrumentMove, against: string | null): string {
  const parts = [`day ${formatChange(move.change1d, move.unit)}`, `5 sessions ${formatChange(move.change5d, move.unit)}`];
  if (move.change20d !== null) parts.push(`20 sessions ${formatChange(move.change20d, move.unit)}`);
  if (move.fromHigh !== null) parts.push(move.fromHigh >= 0 ? 'at its 3-month high' : `${Math.abs(move.fromHigh).toFixed(1)}% below its 3-month high`);
  return `${move.label} (${move.market}) ${formatLevel(move)}${ownSessionFact(move, against)}: ${parts.join(', ')}${move.trading ? ' - still trading' : ''}`;
}

/**
 * The facts block a model is grounded on: every figure it may quote, labelled, with its session.
 * Plain text, one line per instrument, grouped by region - a line from another session than its
 * region's names that session, and futures are grouped apart under their own.
 */
export function worldFactsText(snapshot: WorldSnapshot): string {
  const lines: string[] = [`WORLD MARKETS (daily closes from Yahoo; computed ${snapshot.asOf}):`];
  for (const region of snapshot.regions) {
    const { current, earlier, futures } = regionParts(region);
    const cash = [...current, ...earlier.flatMap((group) => group.moves)];
    if (cash.length) {
      lines.push(`${region.label} - session ${region.session ?? 'unknown'}${region.trading ? ', a market is trading now' : ', closed'}:`);
      for (const move of cash) lines.push(`- ${moveFact(move, region.session)}`);
    }
    for (const group of futures) {
      const cashDay = cash.length && region.session && region.session !== group.session ? `; the cash session above is ${region.session}` : '';
      const state = group.live ? 'trading now - a live price, not a close' : 'latest price';
      lines.push(`${region.label} futures - session ${group.session}, ${state}${cashDay}:`);
      for (const move of group.moves) lines.push(`- ${moveFact(move, group.session)}`);
    }
  }
  const pulse = snapshot.techPulse;
  lines.push(
    `TECH PULSE: ${PULSE_WORDS[pulse.level]} - average 5-session change ${formatChange(pulse.avg5d)} across ${pulse.count} technology names and gauges, ${pulse.down5d} of ${pulse.count} down.`,
  );
  for (const entry of pulse.byRegion) lines.push(`- ${entry.label} tech average over 5 sessions: ${formatChange(entry.avg5d)} (${entry.count} names)`);
  if (snapshot.notable.length) {
    lines.push('NOTABLE MOVES:');
    for (const move of snapshot.notable.slice(0, 10)) {
      const own = ownDay(move, regionDayOf(snapshot, move));
      lines.push(`- ${move.label}${own ? ` (session ${own})` : ''}: ${move.flags.map((flag) => flagWords(move, flag)).join('; ')}`);
    }
  }
  if (snapshot.missing.length) lines.push(`NOT READ THIS TIME: ${snapshot.missing.join(', ')}`);
  return lines.join('\n');
}

// --- Telegram ---------------------------------------------------------------------------------

/** "Nikkei 225 -1.4%" - and its own day when that is not the day its line is dated by: "Nikkei 225 +0.4% (Mon 23 Nov)". */
function chip(move: InstrumentMove, period: '1d' | '5d', against: string | null | undefined): string {
  const value = period === '1d' ? move.change1d : move.change5d;
  const own = ownDay(move, against);
  return `${escapeHtml(move.label)} ${formatChange(value, move.unit)}${own ? ` (${escapeHtml(sessionLabel(own))})` : ''}`;
}

/** A macro gauge: its level and day move - "VIX volatility 18.20 (+3.1%)", with its own day when it differs. */
function gauge(move: InstrumentMove, against: string | null): string {
  const own = ownDay(move, against);
  return `${escapeHtml(move.label)} ${escapeHtml(formatLevel(move))} (${formatChange(move.change1d, move.unit)}${own ? `, ${escapeHtml(sessionLabel(own))}` : ''})`;
}

const REGION_EMOJI: Record<WorldRegion, string> = { asia: '🌏', europe: '🌍', us: '🌎', australia: '🇦🇺', macro: '🧭' };

/**
 * One region as a few short lines: its indices, its futures (their own session, never under the cash
 * close), its technology names, its small caps, then anything from an earlier session under that
 * session's date.
 */
export function regionHtml(region: RegionMoves): string {
  const { current, earlier, futures } = regionParts(region);
  // A region read only through its futures has no close to name: the futures line carries its own date.
  const cash = current.length > 0 || earlier.length > 0;
  const status = region.region === 'macro' || !cash ? '' : region.trading ? ' - trading now' : ` - ${sessionLabel(region.session)} close`;
  const lines = [`${REGION_EMOJI[region.region]} <b>${escapeHtml(region.label)}</b>${escapeHtml(status)}`];
  const asOf = (group: { session: string; moves: InstrumentMove[] }, format: (move: InstrumentMove) => string) =>
    `As of ${escapeHtml(sessionLabel(group.session))}: ${group.moves.map(format).join(' · ')}`;
  if (region.region === 'macro') {
    if (current.length) lines.push(current.map((move) => gauge(move, region.session)).join(' · '));
    for (const group of earlier) lines.push(asOf(group, (move) => gauge(move, group.session)));
    return lines.join('\n');
  }
  const headline = current.filter((move) => move.kind === 'index' && !move.tech && !move.smallCap);
  const tech = current.filter((move) => move.tech);
  const small = current.filter((move) => move.smallCap);
  if (headline.length) lines.push(headline.map((move) => chip(move, '1d', region.session)).join(' · '));
  for (const group of futures) {
    lines.push(`${group.live ? 'Futures now' : 'Futures'}, ${escapeHtml(sessionLabel(group.session))}: ${group.moves.map((move) => chip(move, '1d', group.session)).join(' · ')}`);
  }
  if (tech.length) lines.push(`Tech: ${tech.map((move) => chip(move, '1d', region.session)).join(' · ')}`);
  if (small.length) lines.push(`Small caps: ${small.map((move) => `${chip(move, '1d', region.session)} (5 sessions ${formatChange(move.change5d)})`).join(' · ')}`);
  for (const group of earlier) lines.push(asOf(group, (move) => chip(move, '1d', group.session)));
  return lines.join('\n');
}

/** The tech pulse line: the description, then the biggest falls and rises behind it. */
export function techPulseHtml(pulse: TechPulse): string {
  if (pulse.level === 'unknown') return '';
  const icon = pulse.level === 'selloff' ? '⚠️' : pulse.level === 'weak' ? '🔻' : pulse.level === 'rally' || pulse.level === 'firm' ? '🔺' : '➖';
  const lines = [
    `${icon} <b>Tech pulse: ${escapeHtml(PULSE_WORDS[pulse.level])}</b> - ${pulse.down5d} of ${pulse.count} tech names and gauges are down over five sessions (average ${formatChange(pulse.avg5d)}).`,
  ];
  if (pulse.worst.length) lines.push(`Biggest falls: ${pulse.worst.map((move) => chip(move, '5d', move.regionSession)).join(' · ')}`);
  if (pulse.best.length && (pulse.level === 'firm' || pulse.level === 'rally' || pulse.level === 'steady')) {
    lines.push(`Biggest rises: ${pulse.best.map((move) => chip(move, '5d', move.regionSession)).join(' · ')}`);
  }
  return lines.join('\n');
}

/** Moves that earned a word, as short lines - at most `limit`. */
export function notableHtml(snapshot: WorldSnapshot, limit = 5): string {
  const lines = snapshot.notable
    .filter((move) => move.flags.some((flag) => flag !== 'three_month_high'))
    .slice(0, limit)
    .map((move) => {
      const own = ownDay(move, regionDayOf(snapshot, move));
      const words = move.flags.filter((flag) => flag !== 'three_month_high').map((flag) => flagWords(move, flag)).join('; ');
      return `• ${escapeHtml(move.label)}${own ? ` (${escapeHtml(sessionLabel(own))})` : ''}: ${escapeHtml(words)} (${formatChange(move.change1d, move.unit)} day, ${formatChange(move.change5d, move.unit)} over 5 sessions)`;
    });
  return lines.length ? `<b>Worth knowing</b>\n${lines.join('\n')}` : '';
}

/** The regions in a read's order, for the evening (Asia first) or the morning (the US first). */
export function regionsFor(snapshot: WorldSnapshot, order: readonly WorldRegion[]): RegionMoves[] {
  return order.map((region) => snapshot.regions.find((entry) => entry.region === region)).filter((entry): entry is RegionMoves => Boolean(entry));
}

export { REGION_LABEL };
