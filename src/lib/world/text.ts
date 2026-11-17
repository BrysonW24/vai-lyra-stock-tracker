/**
 * The world snapshot in words - for a person (Telegram HTML) and for a model (the facts it is
 * grounded on). Both are written by code from the same snapshot, so the figure a reader sees and the
 * figure the model was given are the same characters: the prose guard checks a model's numbers
 * against exactly this text.
 *
 * Wording rules: a move is described, never interpreted ("down 9.1% over five sessions", not
 * "crashing"), the day a figure belongs to is always said, a market that is still trading says so,
 * and nothing here suggests what to do.
 */
import { escapeHtml } from '@/lib/notifications/telegram-templates';
import type { InstrumentMove, MoveFlag, RegionMoves, TechPulse, WorldSnapshot } from './compute';
import { REGION_LABEL, type WorldRegion } from './instruments';

const SIGN = (value: number) => (value > 0 ? '+' : value < 0 ? '-' : '');

/** "+1.2%", "-0.15 pts" (a yield), or "n/a". */
export function formatChange(value: number | null, unit: 'percent' | 'points' = 'percent'): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  if (unit === 'points') return `${SIGN(value)}${Math.abs(value).toFixed(2)} pts`;
  return `${SIGN(value)}${Math.abs(value).toFixed(1)}%`;
}

/** A level as people read it: 59,662 for an index, 4.12% for a yield, 1,236.80 for a share. */
export function formatLevel(move: Pick<InstrumentMove, 'last' | 'kind'>): string {
  if (move.kind === 'rate') return `${move.last.toFixed(2)}%`;
  if (move.kind === 'fx') return move.last.toFixed(4);
  const places = move.last >= 1000 ? 0 : 2;
  return move.last.toLocaleString('en-AU', { minimumFractionDigits: places, maximumFractionDigits: places });
}

const FLAG_WORDS: Record<MoveFlag, string> = {
  sharp_drop: 'a sharp fall on the day',
  sharp_rise: 'a sharp rise on the day',
  week_selloff: 'a sell-off week',
  week_rally: 'a rally week',
  correction: 'more than 10% below its three-month high',
  bear_market: 'more than 20% below its three-month high',
  three_month_high: 'at a three-month high',
  stress: 'volatility at a stressed level',
};

/** Stocks have wider bands: their "correction" line says the band that applies to them. */
function flagWords(move: InstrumentMove, flag: MoveFlag): string {
  if (move.kind === 'stock' && flag === 'correction') return 'more than 20% below its three-month high';
  if (move.kind === 'stock' && flag === 'bear_market') return 'more than 35% below its three-month high';
  return FLAG_WORDS[flag];
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

function moveFact(move: InstrumentMove): string {
  const parts = [`day ${formatChange(move.change1d, move.unit)}`, `5 sessions ${formatChange(move.change5d, move.unit)}`];
  if (move.change20d !== null) parts.push(`20 sessions ${formatChange(move.change20d, move.unit)}`);
  if (move.fromHigh !== null) parts.push(move.fromHigh >= 0 ? 'at its 3-month high' : `${Math.abs(move.fromHigh).toFixed(1)}% below its 3-month high`);
  return `${move.label} (${move.market}) ${formatLevel(move)}: ${parts.join(', ')}${move.trading ? ' - still trading' : ''}`;
}

/**
 * The facts block a model is grounded on: every figure it may quote, labelled, with its session.
 * Plain text, one line per instrument, grouped by region.
 */
export function worldFactsText(snapshot: WorldSnapshot): string {
  const lines: string[] = [`WORLD MARKETS (daily closes from Yahoo; computed ${snapshot.asOf}):`];
  for (const region of snapshot.regions) {
    lines.push(`${region.label} - session ${region.session ?? 'unknown'}${region.trading ? ', a market is trading now' : ', closed'}:`);
    for (const move of region.moves) lines.push(`- ${moveFact(move)}`);
  }
  const pulse = snapshot.techPulse;
  lines.push(
    `TECH PULSE: ${PULSE_WORDS[pulse.level]} - average 5-session change ${formatChange(pulse.avg5d)} across ${pulse.count} technology names and gauges, ${pulse.down5d} of ${pulse.count} down.`,
  );
  for (const entry of pulse.byRegion) lines.push(`- ${entry.label} tech average over 5 sessions: ${formatChange(entry.avg5d)} (${entry.count} names)`);
  if (snapshot.notable.length) {
    lines.push('NOTABLE MOVES:');
    for (const move of snapshot.notable.slice(0, 10)) lines.push(`- ${move.label}: ${move.flags.map((flag) => flagWords(move, flag)).join('; ')}`);
  }
  if (snapshot.missing.length) lines.push(`NOT READ THIS TIME: ${snapshot.missing.join(', ')}`);
  return lines.join('\n');
}

// --- Telegram ---------------------------------------------------------------------------------

function chip(move: InstrumentMove, period: '1d' | '5d' = '1d'): string {
  const value = period === '1d' ? move.change1d : move.change5d;
  return `${escapeHtml(move.label)} ${formatChange(value, move.unit)}`;
}

const REGION_EMOJI: Record<WorldRegion, string> = { asia: '🌏', europe: '🌍', us: '🌎', australia: '🇦🇺', macro: '🧭' };

/** One region as two or three short lines: its indices, then its technology names. */
export function regionHtml(region: RegionMoves): string {
  const headline = region.moves.filter((move) => (move.kind === 'index' || move.kind === 'future') && !move.tech && !move.smallCap);
  const tech = region.moves.filter((move) => move.tech);
  const small = region.moves.filter((move) => move.smallCap);
  const status = region.region === 'macro' ? '' : region.trading ? ' - trading now' : ` - ${sessionLabel(region.session)} close`;
  const lines = [`${REGION_EMOJI[region.region]} <b>${escapeHtml(region.label)}</b>${escapeHtml(status)}`];
  if (region.region === 'macro') {
    lines.push(region.moves.map((move) => `${escapeHtml(move.label)} ${escapeHtml(formatLevel(move))} (${formatChange(move.change1d, move.unit)})`).join(' · '));
    return lines.join('\n');
  }
  if (headline.length) lines.push(headline.map((move) => chip(move)).join(' · '));
  if (tech.length) lines.push(`Tech: ${tech.map((move) => chip(move)).join(' · ')}`);
  if (small.length) lines.push(`Small caps: ${small.map((move) => `${chip(move)} (5 sessions ${formatChange(move.change5d)})`).join(' · ')}`);
  return lines.join('\n');
}

/** The tech pulse line: the description, then the biggest falls and rises behind it. */
export function techPulseHtml(pulse: TechPulse): string {
  if (pulse.level === 'unknown') return '';
  const icon = pulse.level === 'selloff' ? '⚠️' : pulse.level === 'weak' ? '🔻' : pulse.level === 'rally' || pulse.level === 'firm' ? '🔺' : '➖';
  const lines = [
    `${icon} <b>Tech pulse: ${escapeHtml(PULSE_WORDS[pulse.level])}</b> - ${pulse.down5d} of ${pulse.count} tech names and gauges are down over five sessions (average ${formatChange(pulse.avg5d)}).`,
  ];
  if (pulse.worst.length) lines.push(`Biggest falls: ${pulse.worst.map((move) => chip(move, '5d')).join(' · ')}`);
  if (pulse.best.length && (pulse.level === 'firm' || pulse.level === 'rally' || pulse.level === 'steady')) lines.push(`Biggest rises: ${pulse.best.map((move) => chip(move, '5d')).join(' · ')}`);
  return lines.join('\n');
}

/** Moves that earned a word, as short lines - at most `limit`. */
export function notableHtml(snapshot: WorldSnapshot, limit = 5): string {
  const lines = snapshot.notable
    .filter((move) => move.flags.some((flag) => flag !== 'three_month_high'))
    .slice(0, limit)
    .map((move) => `• ${escapeHtml(move.label)}: ${escapeHtml(move.flags.filter((flag) => flag !== 'three_month_high').map((flag) => flagWords(move, flag)).join('; '))} (${formatChange(move.change1d, move.unit)} day, ${formatChange(move.change5d, move.unit)} over 5 sessions)`);
  return lines.length ? `<b>Worth knowing</b>\n${lines.join('\n')}` : '';
}

/** The regions in a read's order, for the evening (Asia first) or the morning (the US first). */
export function regionsFor(snapshot: WorldSnapshot, order: readonly WorldRegion[]): RegionMoves[] {
  return order.map((region) => snapshot.regions.find((entry) => entry.region === region)).filter((entry): entry is RegionMoves => Boolean(entry));
}

export { REGION_LABEL };
