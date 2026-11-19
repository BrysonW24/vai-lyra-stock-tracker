/**
 * The world snapshot - pure: each instrument's daily bars in, a description of how it moved out.
 *
 * Everything here is arithmetic on closing prices, so the same bars always give the same snapshot
 * and every figure a read or a chat answer quotes can be traced to two closes. Nothing is a
 * forecast: "a sell-off week" means the last five sessions fell by more than a stated amount, not
 * that the next five will.
 *
 * The rules, all in one place so they can be read and tested:
 *   change1d / 5d / 20d   last close against the close 1, 5 and 20 sessions earlier, in percent
 *                         (for a yield, in percentage points - a yield's own percent change is noise)
 *   fromHigh              last close against the highest close of the last 60 sessions (about three
 *                         months), in percent - 0 at a high, negative below it
 *   flags                 THRESHOLDS below, by kind of instrument: a share moves more than an index,
 *                         so the same word needs a bigger move
 *   tech pulse            the average five-session change of every technology instrument read
 *                         (TECH_PULSE below), with how many fell - never computed from fewer than six
 *   a region's day        the session most of its exchanges last traded (indices, shares and funds -
 *                         not futures, which trade through the night)
 *
 * An instrument whose bars could not be read is left out and named in `missing` - never filled in
 * with a remembered or sample value. So is one whose last bar is more than MAX_SESSIONS_BEHIND
 * weekdays older than its region's day: its feed has stopped, and its last move is not news. One that
 * trails by less (Tokyo shut for a holiday while Seoul trades) is kept, but its figures belong to its
 * own day: every line that prints it says that day, and it earns no "worth knowing" line and no place
 * in the tech pulse's day figure.
 */
import { REGION_LABEL, REGION_ORDER, WORLD_INSTRUMENTS, type InstrumentKind, type WorldInstrument, type WorldRegion } from './instruments';

/** One instrument's daily history as the fetcher read it. */
export interface DailyBars {
  /** Closing prices, oldest first, with any bar that had no close already removed. */
  closes: number[];
  /** Epoch seconds of each bar, the same length as `closes`. */
  times: number[];
  /** The exchange's own timezone (IANA), which decides which day a bar belongs to. */
  timezone: string;
  /** The regular session the source calls current, in epoch seconds, when it said. */
  period: { start: number; end: number } | null;
}

export type MoveFlag =
  | 'sharp_drop'
  | 'sharp_rise'
  | 'week_selloff'
  | 'week_rally'
  | 'correction'
  | 'bear_market'
  | 'three_month_high'
  | 'stress';

export interface InstrumentMove {
  symbol: string;
  label: string;
  region: WorldRegion;
  market: string;
  kind: InstrumentKind;
  tech: boolean;
  smallCap: boolean;
  /** The latest close (or the latest price while the session is open). */
  last: number;
  /** The trading day of the latest bar, in the exchange's own timezone: YYYY-MM-DD. */
  session: string;
  /** The exchange's regular session is open now, so `last` and the day's change are still moving. */
  trading: boolean;
  /** 'points' for a yield (percentage points), 'percent' for everything else. */
  unit: 'percent' | 'points';
  change1d: number | null;
  change5d: number | null;
  change20d: number | null;
  /** Percent below the highest close of the last 60 sessions; null with fewer than 20 sessions. */
  fromHigh: number | null;
  flags: MoveFlag[];
  /**
   * The day its region is dated by (RegionMoves.session), on the board's moves. When `session` is a
   * different day, these figures are that day's, not the region's, and the text says so. Absent on a
   * holding priced on its own.
   */
  regionSession?: string | null;
}

export type TechPulseLevel = 'selloff' | 'weak' | 'steady' | 'firm' | 'rally' | 'unknown';

export interface TechPulse {
  level: TechPulseLevel;
  /** Average five-session change of the technology instruments read, in percent. */
  avg5d: number | null;
  avg1d: number | null;
  /** How many of them fell over five sessions, of how many were read. */
  down5d: number;
  count: number;
  byRegion: Array<{ region: WorldRegion; label: string; avg5d: number | null; count: number }>;
  /** The three biggest five-session falls and rises among them. */
  worst: InstrumentMove[];
  best: InstrumentMove[];
}

export interface RegionMoves {
  region: WorldRegion;
  label: string;
  /**
   * The day most of its exchanges last traded (their own timezones; indices, shares and funds - not
   * futures). A move whose own session differs carries its own date wherever it is printed.
   */
  session: string | null;
  /** At least one of its exchanges is in its regular session now. */
  trading: boolean;
  moves: InstrumentMove[];
}

export interface WorldSnapshot {
  /** When this snapshot was computed (ISO). */
  asOf: string;
  moves: InstrumentMove[];
  /** Labels of the instruments that could not be read this time. */
  missing: string[];
  regions: RegionMoves[];
  techPulse: TechPulse;
  /** Every move that carries a flag worth a line, most severe first. */
  notable: InstrumentMove[];
}

/** How big a move must be to earn each word, by kind of instrument. Percent, or points for a yield. */
export const THRESHOLDS: Record<InstrumentKind, { day: number; week: number; correction: number | null; bear: number | null }> = {
  index: { day: 2, week: 4, correction: 10, bear: 20 },
  fund: { day: 2.5, week: 5, correction: 10, bear: 20 },
  future: { day: 1.5, week: 4, correction: null, bear: null },
  stock: { day: 5, week: 10, correction: 20, bear: 35 },
  fx: { day: 1, week: 2.5, correction: null, bear: null },
  commodity: { day: 3, week: 7, correction: null, bear: null },
  crypto: { day: 6, week: 15, correction: 20, bear: 35 },
  rate: { day: 0.15, week: 0.3, correction: null, bear: null },
  volatility: { day: 20, week: 40, correction: null, bear: null },
};

/** A VIX reading at or above this is a stressed market, whatever its change. */
export const VIX_STRESS_LEVEL = 25;

export const TECH_PULSE = { minCount: 6, selloff: -5, weak: -2, firm: 2, rally: 5 } as const;

/**
 * How many weekdays a series may trail its region's day and still be shown, with its own date. A
 * market shut for a holiday trails by one or two; a feed that has stopped trails by more, and its
 * last move is history, so it is named as missing instead.
 */
export const MAX_SESSIONS_BEHIND = 3;

const HIGH_WINDOW = 60;
const MIN_FOR_HIGH = 20;
const DAY_MS = 86_400_000;

/** The kinds that date a region: exchanges with a closing bell. Futures trade through the night. */
const DATED_KINDS: ReadonlySet<InstrumentKind> = new Set(['index', 'stock', 'fund']);

/** The day an epoch-seconds instant falls on in a timezone, as YYYY-MM-DD. */
export function dayIn(epochSeconds: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(epochSeconds * 1000));
  } catch {
    return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
  }
}

/**
 * Bars cleaned for arithmetic: finite positive closes only, and one bar per trading day (a source
 * sometimes sends the open day twice - the later one is the latest price).
 */
export function cleanBars(bars: DailyBars): { closes: number[]; days: string[] } {
  const closes: number[] = [];
  const days: string[] = [];
  for (let i = 0; i < bars.closes.length; i++) {
    const close = bars.closes[i];
    const time = bars.times[i];
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0 || typeof time !== 'number' || !Number.isFinite(time)) continue;
    const day = dayIn(time, bars.timezone);
    if (days.length && days[days.length - 1] === day) {
      closes[closes.length - 1] = close;
      continue;
    }
    closes.push(close);
    days.push(day);
  }
  return { closes, days };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * The latest price at the precision a reader needs: whole points for a level in the thousands,
 * cents for a share, four decimals under 10 - and four significant figures under 1, because fixed
 * decimals would round a share trading at a fraction of a cent to zero, and null is not zero.
 */
function keepLast(last: number): number {
  if (last >= 1000) return round(last, 0);
  if (last >= 10) return round(last, 2);
  if (last >= 1) return round(last, 4);
  return Number(last.toPrecision(4));
}

function changeOver(closes: number[], sessions: number, unit: 'percent' | 'points'): number | null {
  const last = closes.length - 1;
  if (last - sessions < 0) return null;
  const then = closes[last - sessions]!;
  const now = closes[last]!;
  if (unit === 'points') return round(now - then, 2);
  return then > 0 ? round((now / then - 1) * 100, 1) : null;
}

/** One instrument's move, or null when there are too few sessions to say anything. */
export function describeMove(instrument: WorldInstrument, bars: DailyBars, nowMs: number): InstrumentMove | null {
  const { closes, days } = cleanBars(bars);
  if (closes.length < 2) return null;
  const unit: 'percent' | 'points' = instrument.kind === 'rate' ? 'points' : 'percent';
  const last = closes[closes.length - 1]!;
  const change1d = changeOver(closes, 1, unit);
  const change5d = changeOver(closes, 5, unit);
  const change20d = changeOver(closes, 20, unit);
  const window = closes.slice(-HIGH_WINDOW);
  const high = Math.max(...window);
  const fromHigh = closes.length >= MIN_FOR_HIGH && unit === 'percent' ? round((last / high - 1) * 100, 1) : null;

  const nowSec = nowMs / 1000;
  const sessionKinds: ReadonlySet<InstrumentKind> = new Set(['index', 'stock', 'fund']);
  const trading = sessionKinds.has(instrument.kind) && bars.period !== null && nowSec >= bars.period.start && nowSec < bars.period.end;

  const t = THRESHOLDS[instrument.kind];
  const flags: MoveFlag[] = [];
  if (change1d !== null && change1d <= -t.day) flags.push('sharp_drop');
  if (change1d !== null && change1d >= t.day) flags.push('sharp_rise');
  if (change5d !== null && change5d <= -t.week) flags.push('week_selloff');
  if (change5d !== null && change5d >= t.week) flags.push('week_rally');
  if (fromHigh !== null && t.bear !== null && fromHigh <= -t.bear) flags.push('bear_market');
  else if (fromHigh !== null && t.correction !== null && fromHigh <= -t.correction) flags.push('correction');
  if (fromHigh !== null && fromHigh >= 0 && window.length >= HIGH_WINDOW && instrument.kind !== 'volatility') flags.push('three_month_high');
  if (instrument.kind === 'volatility' && last >= VIX_STRESS_LEVEL) flags.push('stress');

  return {
    symbol: instrument.symbol,
    label: instrument.label,
    region: instrument.region,
    market: instrument.market,
    kind: instrument.kind,
    tech: Boolean(instrument.tech),
    smallCap: Boolean(instrument.smallCap),
    last: keepLast(last),
    session: days[days.length - 1]!,
    trading,
    unit,
    change1d,
    change5d,
    change20d,
    fromHigh,
    flags,
  };
}

function average(values: number[]): number | null {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 1) : null;
}

/**
 * How technology moved over five sessions, across every region read. `onTheDay` says which moves'
 * day figures belong to their region's day: the day average leaves out a market that has not
 * traded since an earlier session, whose day move is that session's.
 */
export function techPulse(moves: InstrumentMove[], onTheDay: (move: InstrumentMove) => boolean = () => true): TechPulse {
  const tech = moves.filter((move) => move.tech && move.change5d !== null);
  const fives = tech.map((move) => move.change5d as number);
  const avg5d = average(fives);
  const avg1d = average(tech.filter((move) => move.change1d !== null && onTheDay(move)).map((move) => move.change1d as number));
  let level: TechPulseLevel = 'unknown';
  if (tech.length >= TECH_PULSE.minCount && avg5d !== null) {
    level = avg5d <= TECH_PULSE.selloff ? 'selloff' : avg5d <= TECH_PULSE.weak ? 'weak' : avg5d >= TECH_PULSE.rally ? 'rally' : avg5d >= TECH_PULSE.firm ? 'firm' : 'steady';
  }
  const sorted = [...tech].sort((a, b) => (a.change5d as number) - (b.change5d as number));
  const byRegion = REGION_ORDER.filter((region) => region !== 'macro').map((region) => {
    const inRegion = tech.filter((move) => move.region === region);
    return { region, label: REGION_LABEL[region], avg5d: average(inRegion.map((move) => move.change5d as number)), count: inRegion.length };
  });
  return {
    level,
    avg5d,
    avg1d,
    down5d: fives.filter((value) => value < 0).length,
    count: tech.length,
    byRegion: byRegion.filter((entry) => entry.count > 0),
    worst: sorted.filter((move) => (move.change5d as number) < 0).slice(0, 3),
    best: sorted.filter((move) => (move.change5d as number) > 0).reverse().slice(0, 3),
  };
}

const FLAG_WEIGHT: Record<MoveFlag, number> = {
  bear_market: 6,
  stress: 5,
  week_selloff: 5,
  sharp_drop: 4,
  correction: 3,
  week_rally: 3,
  sharp_rise: 2,
  three_month_high: 1,
};

function severity(move: InstrumentMove): number {
  return Math.max(0, ...move.flags.map((flag) => FLAG_WEIGHT[flag]));
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && value > best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Weekdays after `from`, up to and including `to` (both YYYY-MM-DD): the sessions an exchange could
 * have traded in between. Counted on the calendar, not from other series, so a coin's weekend bars
 * never make a share look further behind. Stops once past `stopAt`.
 */
function weekdaysAfter(from: string, to: string, stopAt: number): number {
  const end = Date.parse(`${to}T00:00:00Z`);
  let count = 0;
  for (let t = Date.parse(`${from}T00:00:00Z`) + DAY_MS; t <= end && count <= stopAt; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/** The move's figures are from an earlier session than its region's day (a market that has not traded since). */
export function behindItsRegion(move: Pick<InstrumentMove, 'session' | 'regionSession'>): boolean {
  return typeof move.regionSession === 'string' && move.session < move.regionSession;
}

/** The snapshot of every instrument that could be read. `bars` is keyed by Yahoo symbol. */
export function buildWorldSnapshot(
  bars: ReadonlyMap<string, DailyBars>,
  nowMs: number,
  instruments: readonly WorldInstrument[] = WORLD_INSTRUMENTS,
): WorldSnapshot {
  const described = instruments.map((instrument) => {
    const series = bars.get(instrument.symbol);
    return { instrument, move: series ? describeMove(instrument, series, nowMs) : null };
  });
  const read = described.flatMap((entry) => (entry.move ? [entry.move] : []));

  // Each region's day: the session most of its exchanges last traded. A tie goes to the later day.
  const regionDay = new Map<WorldRegion, string | null>();
  for (const region of REGION_ORDER) {
    const inRegion = read.filter((move) => move.region === region);
    const dated = inRegion.filter((move) => DATED_KINDS.has(move.kind));
    regionDay.set(region, mostCommon((dated.length ? dated : inRegion).map((move) => move.session)));
  }

  // A series well behind its region's day has stopped updating: it is missing, not last week's news.
  const moves: InstrumentMove[] = [];
  const missing: string[] = [];
  for (const { instrument, move } of described) {
    const day = move ? (regionDay.get(move.region) ?? null) : null;
    const stale = move !== null && day !== null && move.session < day && weekdaysAfter(move.session, day, MAX_SESSIONS_BEHIND) > MAX_SESSIONS_BEHIND;
    if (!move || stale) missing.push(instrument.label);
    else moves.push({ ...move, regionSession: day });
  }

  const regions: RegionMoves[] = REGION_ORDER.map((region) => {
    const inRegion = moves.filter((move) => move.region === region);
    return { region, label: REGION_LABEL[region], session: regionDay.get(region) ?? null, trading: inRegion.some((move) => move.trading), moves: inRegion };
  }).filter((region) => region.moves.length > 0);

  // A move from an earlier session than its region's day is shown with its own date, but it is not
  // news of that day: it earns no "worth knowing" line, and its day move stays out of the pulse's.
  const onTheDay = (move: InstrumentMove) => !behindItsRegion(move);
  const notable = moves
    .filter((move) => onTheDay(move) && severity(move) >= 2)
    .sort((a, b) => severity(b) - severity(a) || Math.abs(b.change5d ?? 0) - Math.abs(a.change5d ?? 0));
  return { asOf: new Date(nowMs).toISOString(), moves, missing, regions, techPulse: techPulse(moves, onTheDay), notable };
}
