/**
 * The paper-bot flag feed is owner-scoped. The store was one process-global array, so on a multi-user
 * deploy any signed-in user read (and could mark-read) another operator's fills/approvals. These pin
 * the fix: flags are bucketed by owner and never cross. Each went RED against the old global store.
 */
import { describe, it, expect } from 'vitest';
import { recordFlag, listFlags, unreadCount, markAllRead, maybeFlagPositionMove } from '../notifications-store';

describe('paper-bot flag store is owner-scoped (no cross-user leak)', () => {
  it('one owner never sees another owner flags', () => {
    recordFlag('leak-A', { kind: 'fill', message: 'A filled NVDA' });
    recordFlag('leak-B', { kind: 'fill', message: 'B filled TSLA' });

    const a = listFlags('leak-A');
    const b = listFlags('leak-B');
    expect(a.some((f) => f.message.includes('NVDA'))).toBe(true);
    expect(a.some((f) => f.message.includes('TSLA'))).toBe(false); // B's flag is invisible to A
    expect(b.some((f) => f.message.includes('TSLA'))).toBe(true);
    expect(b.some((f) => f.message.includes('NVDA'))).toBe(false);
  });

  it('markAllRead(owner) clears only that owner unread badge', () => {
    recordFlag('mr-A', { kind: 'fill', message: 'A' });
    recordFlag('mr-B', { kind: 'fill', message: 'B' });
    expect(unreadCount('mr-A')).toBeGreaterThan(0);
    expect(unreadCount('mr-B')).toBeGreaterThan(0);

    markAllRead('mr-A');
    expect(unreadCount('mr-A')).toBe(0);
    expect(unreadCount('mr-B')).toBeGreaterThan(0); // B untouched
  });

  it('an unknown owner sees an empty feed (no shared default)', () => {
    expect(listFlags('nobody-here')).toEqual([]);
    expect(unreadCount('nobody-here')).toBe(0);
  });

  it('position-move flags land under the owner passed and dedupe per owner+symbol', () => {
    maybeFlagPositionMove('pm-A', 'NVDA', 12); // crosses +bucket -> one flag
    maybeFlagPositionMove('pm-A', 'NVDA', 13); // same bucket -> deduped
    const moves = listFlags('pm-A').filter((f) => f.kind === 'position_move' && f.symbol === 'NVDA');
    expect(moves.length).toBe(1);
    expect(listFlags('pm-B').length).toBe(0); // a different owner is unaffected
  });
});
