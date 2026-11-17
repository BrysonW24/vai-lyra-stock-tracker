import { describe, expect, it } from 'vitest';
import { buildWorldSnapshot, cleanBars, dayIn, describeMove, techPulse, THRESHOLDS, type DailyBars, type InstrumentMove } from '../compute';
import { parseChart, QUOTE_SYMBOL_RE } from '../fetch';
import { instrumentsMentioned, WORLD_INSTRUMENTS, type WorldInstrument } from '../instruments';
import { formatChange, formatLevel, regionHtml, techPulseHtml, worldFactsText } from '../text';

// Absolute instants only - these tests must pass on a UTC runner and in Sydney alike.
const DAY = 86_400;
const START = Date.parse('2026-08-03T14:30:00Z') / 1000; // a New York open
const NOW = Date.parse('2026-11-18T03:00:00Z');

function bars(closes: number[], timezone = 'America/New_York', start = START, period: DailyBars['period'] = null): DailyBars {
  return { closes, times: closes.map((_, i) => start + i * DAY), timezone, period };
}

const INDEX: WorldInstrument = { symbol: '^TEST', label: 'Test Index', region: 'us', market: 'US', kind: 'index' };
const STOCK: WorldInstrument = { symbol: 'TST', label: 'Test Co', region: 'asia', market: 'Japan', kind: 'stock', tech: true };

/** A flat series of `n` closes at 100 that ends with the given closes. */
function endingWith(n: number, tail: number[]): number[] {
  return [...Array.from({ length: n - tail.length }, () => 100), ...tail];
}

describe('world compute', () => {
  it('measures day, five- and twenty-session changes from closes', () => {
    const closes = endingWith(70, [100, 100, 100, 100, 100, 95]);
    const move = describeMove(INDEX, bars(closes), NOW)!;
    expect(move.change1d).toBe(-5);
    expect(move.change5d).toBe(-5);
    expect(move.change20d).toBe(-5);
    expect(move.fromHigh).toBe(-5);
    expect(move.last).toBe(95);
  });

  it('gives an index the sell-off words at index bands and a share only at share bands', () => {
    const fall = endingWith(70, [100, 99, 98, 97, 96.5, 95.5]); // 1d about -1%, 5d -4.5%
    const asIndex = describeMove(INDEX, bars(fall), NOW)!;
    expect(asIndex.flags).toContain('week_selloff');
    expect(asIndex.flags).not.toContain('sharp_drop');
    const asStock = describeMove(STOCK, bars(fall), NOW)!;
    expect(asStock.flags).not.toContain('week_selloff');
    expect(THRESHOLDS.stock.week).toBeGreaterThan(THRESHOLDS.index.week);
  });

  it('names a correction and a bear market from the three-month high', () => {
    const correction = describeMove(INDEX, bars(endingWith(70, [100, 88])), NOW)!;
    expect(correction.flags).toContain('correction');
    const bear = describeMove(INDEX, bars(endingWith(70, [100, 75])), NOW)!;
    expect(bear.flags).toContain('bear_market');
    expect(bear.flags).not.toContain('correction');
  });

  it('marks a three-month high only with a full window behind it', () => {
    const rising = Array.from({ length: 70 }, (_, i) => 100 + i);
    expect(describeMove(INDEX, bars(rising), NOW)!.flags).toContain('three_month_high');
    expect(describeMove(INDEX, bars(rising.slice(-30)), NOW)!.flags).not.toContain('three_month_high');
  });

  it('measures a yield in percentage points, never as a percent change', () => {
    const tnx: WorldInstrument = { symbol: '^TNX', label: 'US 10-year yield', region: 'macro', market: 'US', kind: 'rate' };
    const move = describeMove(tnx, bars(endingWith(30, [4.1, 4.3])), NOW)!;
    expect(move.unit).toBe('points');
    expect(move.change1d).toBe(0.2);
    expect(move.fromHigh).toBeNull();
    expect(formatChange(move.change1d, move.unit)).toBe('+0.20 pts');
  });

  it('dates a bar by the exchange day, not the reader day', () => {
    // 00:00 UTC is 09:00 in Tokyo the same day and 11:00 in Sydney - but 19:00 the day before in New York.
    const instant = Date.parse('2026-11-18T00:00:00Z') / 1000;
    expect(dayIn(instant, 'Asia/Tokyo')).toBe('2026-11-18');
    expect(dayIn(instant, 'America/New_York')).toBe('2026-11-17');
  });

  it('keeps one bar per exchange day and drops closes that are not prices', () => {
    const t = Date.parse('2026-11-17T00:00:00Z') / 1000;
    const cleaned = cleanBars({ closes: [10, Number.NaN, 0, 11, 12], times: [t, t + DAY, t + 2 * DAY, t + 2 * DAY, t + 2 * DAY + 600], timezone: 'Asia/Tokyo', period: null });
    expect(cleaned.closes).toEqual([10, 12]);
    expect(cleaned.days).toEqual(['2026-11-17', '2026-11-19']);
  });

  it('says a market is trading only inside its regular session, and never for a future', () => {
    const nowSec = NOW / 1000;
    const open = { start: nowSec - 3600, end: nowSec + 3600 };
    expect(describeMove(STOCK, bars(endingWith(30, [100]), 'Asia/Tokyo', START, open), NOW)!.trading).toBe(true);
    expect(describeMove(STOCK, bars(endingWith(30, [100]), 'Asia/Tokyo', START, { start: nowSec + 60, end: nowSec + 7200 }), NOW)!.trading).toBe(false);
    const future: WorldInstrument = { ...INDEX, kind: 'future' };
    expect(describeMove(future, bars(endingWith(30, [100]), 'America/New_York', START, open), NOW)!.trading).toBe(false);
  });

  it('calls a tech sell-off from the average five-session move, and refuses with too few names', () => {
    const tech = (label: string, change5d: number): InstrumentMove => ({
      symbol: label, label, region: 'asia', market: 'X', kind: 'stock', tech: true, smallCap: false, last: 1, session: '2026-11-18', trading: false, unit: 'percent', change1d: 0, change5d, change20d: null, fromHigh: null, flags: [],
    });
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((label, i) => tech(label, -4 - i));
    const pulse = techPulse(six);
    expect(pulse.level).toBe('selloff');
    expect(pulse.down5d).toBe(6);
    expect(pulse.worst.map((move) => move.label)).toEqual(['f', 'e', 'd']);
    expect(techPulse(six.slice(0, 5)).level).toBe('unknown');
    expect(techPulse(six.map((move) => ({ ...move, change5d: 1 }))).level).toBe('steady');
  });

  it('names every instrument it could not read instead of filling it in', () => {
    const only = new Map<string, DailyBars>([['^N225', bars(endingWith(30, [100, 101]), 'Asia/Tokyo')]]);
    const snapshot = buildWorldSnapshot(only, NOW);
    expect(snapshot.moves.map((move) => move.symbol)).toEqual(['^N225']);
    expect(snapshot.missing).toHaveLength(WORLD_INSTRUMENTS.length - 1);
    expect(snapshot.missing).toContain('KOSPI');
    expect(worldFactsText(snapshot)).toContain('NOT READ THIS TIME: ');
  });

  it('puts the most severe moves first', () => {
    const map = new Map<string, DailyBars>([
      ['^N225', bars(endingWith(70, [100, 97.5]), 'Asia/Tokyo')], // sharp day
      ['^KS11', bars(endingWith(70, [100, 100, 100, 100, 100, 80]), 'Asia/Seoul')], // bear market
    ]);
    const snapshot = buildWorldSnapshot(map, NOW);
    expect(snapshot.notable[0]!.symbol).toBe('^KS11');
  });
});

describe('world text', () => {
  const map = new Map<string, DailyBars>([
    ['^N225', bars(endingWith(70, [100, 100, 100, 100, 100, 59662]).map((v) => v), 'Asia/Tokyo')],
    ['2330.TW', bars(endingWith(70, [100, 100, 100, 100, 100, 91]), 'Asia/Taipei')],
  ]);
  const snapshot = buildWorldSnapshot(map, NOW);

  it('quotes each figure in the facts exactly as the message prints it', () => {
    const facts = worldFactsText(snapshot);
    const asia = snapshot.regions.find((region) => region.region === 'asia')!;
    const html = regionHtml(asia);
    expect(html).toContain('TSMC -9.0%');
    expect(facts).toContain('day -9.0%');
    expect(facts).toContain('TSMC (Taiwan)');
  });

  it('formats levels the way people read them', () => {
    expect(formatLevel({ last: 59662, kind: 'index' })).toBe('59,662');
    expect(formatLevel({ last: 4.123, kind: 'rate' })).toBe('4.12%');
    expect(formatLevel({ last: 0.6512, kind: 'fx' })).toBe('0.6512');
    expect(formatChange(null)).toBe('n/a');
    expect(formatChange(0)).toBe('0.0%');
  });

  it('escapes what it prints into Telegram HTML', () => {
    const odd: WorldInstrument = { symbol: 'ODD', label: 'S&P <test>', region: 'us', market: 'US', kind: 'index' };
    const snap = buildWorldSnapshot(new Map([['ODD', bars(endingWith(30, [100, 101]))]]), NOW, [odd]);
    expect(regionHtml(snap.regions[0]!)).toContain('S&amp;P &lt;test&gt;');
  });

  it('prints no tech pulse line when it cannot say', () => {
    expect(techPulseHtml(snapshot.techPulse)).toBe('');
  });
});

describe('world fetch parsing', () => {
  it('reads closes with their stamps and the regular session, skipping null bars', () => {
    const parsed = parseChart({
      chart: {
        result: [
          {
            timestamp: [1, 2, 3],
            meta: { exchangeTimezoneName: 'Asia/Seoul', currentTradingPeriod: { regular: { start: 10, end: 20 } } },
            indicators: { quote: [{ close: [5, null, 6] }] },
          },
        ],
      },
    });
    expect(parsed).toEqual({ closes: [5, 6], times: [1, 3], timezone: 'Asia/Seoul', period: { start: 10, end: 20 } });
  });

  it('fills a just-closed session whose bar has no close yet from the latest trade', () => {
    // Nikkei, 2026-11-18 morning in Sydney: Tuesday's bar exists with a null close; the quote has it.
    const mon = Date.parse('2026-11-16T00:00:00Z') / 1000;
    const tue = Date.parse('2026-11-17T00:00:00Z') / 1000;
    const parsed = parseChart({
      chart: {
        result: [
          {
            timestamp: [mon - 86_400, mon, tue],
            meta: { exchangeTimezoneName: 'Asia/Tokyo', regularMarketPrice: 58860.43, regularMarketTime: Date.parse('2026-11-17T06:45:03Z') / 1000 },
            indicators: { quote: [{ close: [61142.35, 59662.02, null] }] },
          },
        ],
      },
    })!;
    expect(parsed.closes).toEqual([61142.35, 59662.02, 58860.43]);
    expect(parsed.times[2]).toBe(tue);
  });

  it('adds the day when the source has a trade for it but no bar at all, and never doubles a day it has', () => {
    const mon = Date.parse('2026-11-16T00:00:00Z') / 1000;
    const appended = parseChart({
      chart: { result: [{ timestamp: [mon - 86_400, mon], meta: { exchangeTimezoneName: 'Asia/Seoul', regularMarketPrice: 4968.48, regularMarketTime: Date.parse('2026-11-17T06:35:00Z') / 1000 }, indicators: { quote: [{ close: [5290.53, 5100.5] }] } }] },
    })!;
    expect(appended.closes).toEqual([5290.53, 5100.5, 4968.48]);
    const same = parseChart({
      chart: { result: [{ timestamp: [mon - 86_400, mon], meta: { exchangeTimezoneName: 'Asia/Seoul', regularMarketPrice: 5101, regularMarketTime: mon + 3_600 }, indicators: { quote: [{ close: [5290.53, 5100.5] }] } }] },
    })!;
    expect(same.closes).toEqual([5290.53, 5100.5]);
  });

  it('is null for a response with too little to say anything', () => {
    expect(parseChart({ chart: { result: [{ timestamp: [1], indicators: { quote: [{ close: [5] }] } }] } })).toBeNull();
    expect(parseChart({ chart: { result: null } })).toBeNull();
    expect(parseChart('not json')).toBeNull();
  });

  it('accepts tickers as people type them across exchanges', () => {
    for (const symbol of ['NVDA', 'CBA.AX', '005930.KS', 'ES=F', '^N225', 'BRK-B']) expect(QUOTE_SYMBOL_RE.test(symbol)).toBe(true);
    for (const symbol of ['', 'nvda; drop', '<script>', 'A'.repeat(20)]) expect(QUOTE_SYMBOL_RE.test(symbol)).toBe(false);
  });
});

describe('instruments mentioned in a question', () => {
  it('finds the markets and names a reader asks about', () => {
    const labels = instrumentsMentioned("How's Korea doing, and what happened to TSMC and the semis?").map((instrument) => instrument.label);
    expect(labels).toEqual(expect.arrayContaining(['KOSPI', 'TSMC', 'US semiconductors (SOX)']));
  });

  it('does not match a short alias inside another word', () => {
    expect(instrumentsMentioned('what about saps and the dowager').map((instrument) => instrument.label)).not.toContain('SAP');
  });
});
