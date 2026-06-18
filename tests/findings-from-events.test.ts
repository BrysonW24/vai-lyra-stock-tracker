import { describe, expect, it } from 'vitest';
import { findingFromEvent, findingsFromEvents, type NotificationEventRow } from '@/lib/findings/from-events';

const baseEvent: NotificationEventRow = {
  id: 'evt-1',
  type: 'signal_alert',
  severity: 'high',
  title: 'NVDA strong setup',
  body: 'Oversold-recovery setup firing; volume 2.1x; RSI resetting.',
  trigger_reason: 'Score crossed 70; volume surge; MACD improving',
  evidence_refs: [],
  symbol: 'nvda',
  theme: 'AGI infrastructure',
  related_entity_type: 'supply_chain_node',
  related_entity_id: 'node:ai-compute',
  relevance_score: 88,
  url: null,
  payload: { signal_score: 76, volume_ratio: 2.1, theme_fit: 80 },
  created_at: '2026-06-18T09:00:00Z',
};

describe('findingFromEvent', () => {
  const f = findingFromEvent(baseEvent);

  it('maps a signal_alert to a scanner_signal finding, symbol uppercased', () => {
    expect(f.type).toBe('scanner_signal');
    expect(f.symbol).toBe('NVDA');
    expect(f.id).toBe('evt-1');
  });

  it('takes every score from the event/payload - never invents one', () => {
    expect(f.scores.total).toBe(76); // payload.signal_score
    expect(f.scores.volume).toBe(2.1); // payload.volume_ratio
    expect(f.scores.themeFit).toBe(80); // payload.theme_fit
    expect(f.scores.confidence).toBe(88); // relevance_score
  });

  it('builds entities + relationships the event names', () => {
    expect(f.entities.find((e) => e.id === 'NVDA')?.type).toBe('company');
    expect(f.entities.find((e) => e.id === 'theme:AGI infrastructure')?.type).toBe('theme');
    expect(f.entities.find((e) => e.id === 'node:ai-compute')).toBeTruthy();
    expect(f.relationships.some((r) => r.fromEntityId === 'NVDA' && r.toEntityId === 'theme:AGI infrastructure' && r.relationshipType === 'exposed_to')).toBe(true);
  });

  it('always carries the honesty line + every evidence link resolves to an entity', () => {
    for (const ev of f.evidence) {
      expect(ev.whatItDoesNotProve.length).toBeGreaterThan(0);
      for (const id of ev.linkedEntityIds) expect(f.entities.some((e) => e.id === id)).toBe(true);
    }
  });

  it('starts in Monitor and never proposes a Buy action', () => {
    expect(f.state).toBe('Monitor');
    expect(f.actions.every((a) => a.label.toLowerCase() !== 'buy' && a.kind !== ('buy' as never))).toBe(true);
  });

  it('does NOT promote relevance_score to the headline total (no fake 100), keeps it as confidence', () => {
    // relevance_score DB-defaults to 100; surfacing it as total would make every non-scanner finding
    // read as a max-confidence setup. With no real composite in the payload, total is 0 (-> "NR").
    const g = findingFromEvent({ ...baseEvent, payload: {}, relevance_score: 100 });
    expect(g.scores.total).toBe(0);
    expect(g.scores.confidence).toBe(100);
    expect(Number.isNaN(g.scores.total)).toBe(false);
  });
});

describe('findingsFromEvents', () => {
  it('drops dismissed findings and applies a promoted state', () => {
    const events = [baseEvent, { ...baseEvent, id: 'evt-2', symbol: 'amd' }];
    const out = findingsFromEvents(events, [
      { finding_key: 'evt-1', dismissed_at: '2026-06-18T10:00:00Z' },
      { finding_key: 'evt-2', state: 'Watchlist candidate' },
    ]);
    expect(out.find((f) => f.id === 'evt-1')).toBeUndefined();
    expect(out.find((f) => f.id === 'evt-2')?.state).toBe('Watchlist candidate');
  });
});
