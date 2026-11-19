// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { buildWorldSnapshot, type DailyBars } from '@/lib/world/compute';
import { sessionLabel } from '@/lib/world/text';
import { WorldBoardLoader, WorldBoardView } from '../WorldBoardView';

afterEach(cleanup);

// Absolute instants only - the repo rule.
const NOW = Date.parse('2026-11-17T22:00:00Z');
function bars(closes: number[], timezone: string): DailyBars {
  const start = Date.parse('2026-07-01T01:00:00Z') / 1000;
  return { closes, times: closes.map((_, i) => start + i * 86_400), timezone, period: null };
}
const series = (tail: number[]) => [...Array.from({ length: 70 - tail.length }, () => 100), ...tail];

/** One bar per weekday, the last on `lastDay`, stamped at `hourUtc` (so each falls on that day in the exchange's zone). */
function weekdayBars(tail: number[], lastDay: string, timezone: string, hourUtc: number, extra?: { close: number; at: string }): DailyBars {
  const closes = series(tail);
  const times: number[] = [];
  let t = Date.parse(`${lastDay}T${String(hourUtc).padStart(2, '0')}:00:00Z`);
  while (times.length < closes.length) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) times.unshift(t / 1000);
    t -= 86_400_000;
  }
  return extra
    ? { closes: [...closes, extra.close], times: [...times, Date.parse(extra.at) / 1000], timezone, period: null }
    : { closes, times, timezone, period: null };
}

/** The card a region heading sits in. */
const card = (label: string) => screen.getByText(label).closest('div.p-3') as HTMLElement;

describe('WorldBoardView', () => {
  it('renders nothing when the board could not be read', () => {
    const { container } = render(<WorldBoardView snapshot={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows each region with its day and five-session moves, and names what was not read', () => {
    const snapshot = buildWorldSnapshot(
      new Map([
        ['^N225', bars(series([100, 97]), 'Asia/Tokyo')],
        ['^GDAXI', bars(series([100, 101]), 'Europe/Berlin')],
        ['^VIX', bars(series([20, 26]), 'America/Chicago')],
      ]),
      NOW,
    );
    render(<WorldBoardView snapshot={snapshot} />);
    expect(screen.getByText('The world right now')).toBeTruthy();
    expect(screen.getByText('Asia')).toBeTruthy();
    expect(screen.getByText('Europe')).toBeTruthy();
    const nikkeiDay = screen.getAllByText('-3.0%')[0]!;
    expect(nikkeiDay.className).toContain('text-negative');
    expect(screen.getAllByText('+1.0%')[0]!.className).toContain('text-positive');
    // Volatility rising is not "good": it stays neutral.
    expect(screen.getByText('+30.0%').className).toContain('text-ink-2');
    expect(screen.getByText(/Not read this time:/).textContent).toContain('KOSPI');
  });

  it('shows the futures under their own live session, apart from the cash close', () => {
    // 3:15am Wednesday in New York: Tuesday's cash close, futures trading Wednesday's session.
    const snapshot = buildWorldSnapshot(
      new Map([
        ['^GSPC', weekdayBars([100, 100.6], '2026-11-17', 'America/New_York', 21)],
        ['ES=F', weekdayBars([100], '2026-11-17', 'America/New_York', 21, { close: 99.6, at: '2026-11-18T08:00:00Z' })],
      ]),
      Date.parse('2026-11-18T08:15:00Z'),
    );
    render(<WorldBoardView snapshot={snapshot} />);
    const us = card('United States');
    expect(us.textContent).toContain(`${sessionLabel('2026-11-17')} close`);
    // The first list is the cash market's, under its close: the futures are not in it.
    expect(us.querySelector('ul')!.textContent).toContain('S&P 500');
    expect(us.querySelector('ul')!.textContent).not.toContain('futures');
    const futures = screen.getByText(`Futures now, ${sessionLabel('2026-11-18')}`).parentElement!;
    expect(futures.textContent).toContain('S&P 500 futures');
    expect(futures.textContent).toContain('-0.4%');
  });

  it("dates a market that did not trade on its region's day by its own session", () => {
    // Monday 23 Nov is a holiday in Tokyo: Japan's last session is Friday's while Seoul trades.
    const snapshot = buildWorldSnapshot(
      new Map([
        ['^KS11', weekdayBars([100, 101], '2026-11-23', 'Asia/Seoul', 6)],
        ['^HSI', weekdayBars([100, 101], '2026-11-23', 'Asia/Hong_Kong', 6)],
        ['^N225', weekdayBars([100, 94], '2026-11-20', 'Asia/Tokyo', 6)],
        ['^VIX', weekdayBars([20, 21], '2026-11-20', 'America/Chicago', 21)],
        ['GC=F', weekdayBars([100, 101], '2026-11-20', 'America/New_York', 21)],
        ['BTC-USD', weekdayBars([100, 102], '2026-11-23', 'UTC', 6)],
      ]),
      Date.parse('2026-11-23T08:15:00Z'),
    );
    render(<WorldBoardView snapshot={snapshot} />);
    const asia = card('Asia');
    expect(asia.textContent).toContain(`${sessionLabel('2026-11-23')} close`);
    expect(asia.querySelector('ul')!.textContent).not.toContain('Nikkei');
    expect(screen.getByText(`As of ${sessionLabel('2026-11-20')}`).parentElement!.textContent).toContain('Nikkei 225');
    // Friday's sharp fall is not Monday's news (the VIX line, on its own day, still is).
    const worth = screen.getByText('Worth knowing').parentElement!;
    expect(worth.textContent).toContain('VIX volatility');
    expect(worth.textContent).not.toContain('Nikkei');
    // A gauge on a later day than the rest carries that day beside its name.
    const bitcoin = screen.getByText('Bitcoin').closest('li')!;
    expect(bitcoin.textContent).toContain(sessionLabel('2026-11-23'));
  });
});

describe('WorldBoardLoader', () => {
  it('renders the board once its snapshot arrives', async () => {
    const snapshot = buildWorldSnapshot(new Map([['^N225', bars(series([100, 97]), 'Asia/Tokyo')]]), NOW);
    render(await WorldBoardLoader({ load: async () => snapshot }));
    expect(screen.getByText('The world right now')).toBeTruthy();
  });

  it('renders nothing when the board cannot be read', async () => {
    const { container } = render(
      await WorldBoardLoader({
        load: async () => {
          throw new Error('source down');
        },
      }),
    );
    expect(container.innerHTML).toBe('');
  });
});
