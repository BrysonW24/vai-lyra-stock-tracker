// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { buildWorldSnapshot, type DailyBars } from '@/lib/world/compute';
import { WorldBoardView } from '../WorldBoardView';

afterEach(cleanup);

// Absolute instants only - the repo rule.
const NOW = Date.parse('2026-11-17T22:00:00Z');
function bars(closes: number[], timezone: string): DailyBars {
  const start = Date.parse('2026-07-01T01:00:00Z') / 1000;
  return { closes, times: closes.map((_, i) => start + i * 86_400), timezone, period: null };
}
const series = (tail: number[]) => [...Array.from({ length: 70 - tail.length }, () => 100), ...tail];

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
});
