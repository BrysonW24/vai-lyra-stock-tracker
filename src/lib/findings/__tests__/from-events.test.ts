import { describe, it, expect } from 'vitest';
import {
  findingFromEvent,
  findingsFromEvents,
  isInvestigableEvent,
  type NotificationEventRow,
} from '../from-events';

/**
 * Behavioral pin for the live findings projection (2026-07-27 audit V10 P2: from-events.ts owned the
 * /findings + /graph correctness path unpinned). The load-bearing honesty invariant: relevance_score
 * (DB-defaults to 100, a dedupe metric) must NEVER become the headline `total`, or every finding would
 * read as a fabricated 100/100. Also: event-type whitelist filtering and dismissed/state lifecycle.
 */
function ev(overrides: Partial<NotificationEventRow> = {}): NotificationEventRow {
  return {
    id: 'evt-1',
    type: 'signal_alert',
    title: 'NVDA setup firming',
    body: 'RSI reset, volume confirming.',
    relevance_score: 100,
    created_at: '2026-07-20T09:00:00Z',
    ...overrides,
  };
}

describe('findingFromEvent - score projection honesty', () => {
  it('takes total from the deterministic signal_score, not from relevance_score', () => {
    const f = findingFromEvent(ev({ symbol: 'nvda', relevance_score: 100, payload: { signal_score: 76, volume_ratio: 2.14 } }));
    expect(f.scores.total).toBe(76);
    // relevance is surfaced as confidence only - never as the headline score.
    expect(f.scores.confidence).toBe(100);
    expect(f.scores.total).not.toBe(100);
    // symbol is upper-cased.
    expect(f.symbol).toBe('NVDA');
    // volume_ratio (a ratio, not a 0-100 score) must NOT fill the 0-100 'Vol' breakdown chip.
    expect(f.scores.volume).toBeUndefined();
  });

  it('uses a real 0-100 volume score for the Vol chip when the event provides one', () => {
    const f = findingFromEvent(ev({ payload: { signal_score: 70, volume: 68, volume_ratio: 2.1 } }));
    expect(f.scores.volume).toBe(68);
  });

  it('gives a non-scanner finding total 0 (renders NR) rather than a fake 100', () => {
    const f = findingFromEvent(ev({ type: 'gov_award', relevance_score: 100, payload: { agency: 'DoD', amount_usd: 1850000 } }));
    expect(f.type).toBe('government_contract');
    expect(f.scores.total).toBe(0);
    expect(f.scores.confidence).toBe(100);
  });

  it('creates a theme entity + exposure relationship when the event names a theme', () => {
    const f = findingFromEvent(ev({ symbol: 'BKSY', theme: 'space-intelligence' }));
    expect(f.entities.some((e) => e.id === 'BKSY' && e.type === 'company')).toBe(true);
    expect(f.entities.some((e) => e.id === 'theme:space-intelligence' && e.type === 'theme')).toBe(true);
    expect(f.relationships.some((r) => r.fromEntityId === 'BKSY' && r.toEntityId === 'theme:space-intelligence')).toBe(true);
  });

  it('invents no numbers when the payload is empty (total 0, no volume)', () => {
    const f = findingFromEvent(ev({ payload: {} }));
    expect(f.scores.total).toBe(0);
    expect(f.scores.volume).toBeUndefined();
  });
});

describe('isInvestigableEvent - whitelist', () => {
  it('accepts real finding event types', () => {
    expect(isInvestigableEvent('signal_alert')).toBe(true);
    expect(isInvestigableEvent('gov_award')).toBe(true);
    expect(isInvestigableEvent('small_cap_discovery')).toBe(true);
  });

  it('rejects system/test/channel events that are not findings', () => {
    expect(isInvestigableEvent('test_notification')).toBe(false);
    expect(isInvestigableEvent('channel_verification')).toBe(false);
    expect(isInvestigableEvent('')).toBe(false);
  });
});

describe('findingsFromEvents - filtering + lifecycle', () => {
  it('drops non-investigable events so junk cards never reach the feed/graph', () => {
    const findings = findingsFromEvents([
      ev({ id: 'a', type: 'signal_alert' }),
      ev({ id: 'b', type: 'test_notification', title: 'Lyra test alert' }),
    ]);
    expect(findings.map((f) => f.id)).toEqual(['a']);
  });

  it('drops a dismissed finding and applies a promoted state override', () => {
    const findings = findingsFromEvents(
      [ev({ id: 'keep' }), ev({ id: 'gone' })],
      [
        { finding_key: 'gone', dismissed_at: '2026-07-21T00:00:00Z' },
        { finding_key: 'keep', state: 'Paper-bot research queue' },
      ],
    );
    expect(findings.map((f) => f.id)).toEqual(['keep']);
    expect(findings[0].state).toBe('Paper-bot research queue');
  });
});
