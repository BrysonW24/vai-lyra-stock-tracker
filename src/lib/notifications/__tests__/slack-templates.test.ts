import { describe, expect, it } from 'vitest';
import { SLACK_MESSAGE_LIMIT, buildSlackTextForEvent } from '../slack-templates';
import { buildDedupeKey, buildIdempotencyKey } from '../router';
import { RESEARCH_SUFFIX } from '../templates';
import type { NotificationEvent } from '../types';

function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: 'evt-1',
    type: 'signal_alert',
    userId: 'user-1',
    triggerReason: 'score crossed 80 with volume 2.4x average',
    title: 'NVDA oversold-recovery signal',
    body: 'NVDA entered the reset band on rising volume.',
    evidenceRefs: ['signal:NVDA:2026-07-16', 'ohlcv:NVDA:1h'],
    relatedEntityType: 'symbol',
    relatedEntityId: 'NVDA',
    relevanceScore: 85,
    dedupeKey: buildDedupeKey('signal_alert', 'NVDA', '2026-07-16'),
    idempotencyKey: buildIdempotencyKey('evt-1', 'slack'),
    createdAt: '2026-07-16T14:00:00.000Z',
    ...overrides,
  };
}

describe('buildSlackTextForEvent - per-type structure', () => {
  it('renders a signal alert with emoji, framing, provenance, and every data grain', () => {
    const text = buildSlackTextForEvent(event({ url: 'https://lyra.example/tickers/NVDA' }));
    expect(text).toContain(':dart: *Signal*');
    expect(text).toContain('_A setup crossed your alert threshold._');
    expect(text).toContain('*NVDA oversold-recovery signal*');
    expect(text).toContain('> *Why:* score crossed 80 with volume 2.4x average');
    expect(text).toContain('> *Symbol:* `NVDA`');
    expect(text).toContain('> *Relevance:* 85/100');
    expect(text).toContain('> *Evidence:* 2 linked items');
    expect(text).toContain('<https://lyra.example/tickers/NVDA|Open in Lyra>');
    expect(text).toContain(`_${RESEARCH_SUFFIX}_`);
  });

  it('gives approval events an action line and no research suffix', () => {
    const text = buildSlackTextForEvent(
      event({ type: 'order_approval_required', relatedEntityType: 'order', relatedEntityId: 'ord-77' }),
    );
    expect(text).toContain(':bell: *Approval required*');
    expect(text).toContain(':point_right: *Action needed:* approve or reject `ord-77`');
    expect(text).not.toContain(RESEARCH_SUFFIX);
  });

  it('marks paper-bot events as simulated', () => {
    const text = buildSlackTextForEvent(event({ type: 'paper_trade_opened' }));
    expect(text).toContain(':large_green_circle: *Paper trade opened*');
    expect(text).toContain('_Paper trade - no real money moved._');
    expect(text).not.toContain(RESEARCH_SUFFIX);
  });

  it('escalates the header for critical severity', () => {
    const text = buildSlackTextForEvent(event({ type: 'kill_switch_enabled', severity: 'critical' }));
    expect(text).toContain(':electric_plug: *Kill switch* - :rotating_light: *CRITICAL*');
    expect(text).toContain('Automated activity halted until manually re-enabled.');
  });

  it('uses a different voice per event family', () => {
    const digest = buildSlackTextForEvent(event({ type: 'daily_digest' }));
    const watchlist = buildSlackTextForEvent(event({ type: 'watchlist_price_move' }));
    expect(digest).toContain(':coffee: *Daily digest*');
    expect(digest).toContain('_Your day in one message._');
    expect(watchlist).toContain(':eyes: *Watchlist move*');
    expect(watchlist).toContain('_A watched name is on the move._');
  });

  it('omits grains the event does not carry and stays inside the length cap', () => {
    const sparse = buildSlackTextForEvent(
      event({ relatedEntityType: undefined, relatedEntityId: undefined, evidenceRefs: [], url: undefined }),
    );
    expect(sparse).not.toContain('*Symbol:*');
    expect(sparse).not.toContain('*Evidence:*');
    expect(sparse).not.toContain('Open in Lyra');

    const huge = buildSlackTextForEvent(event({ body: 'x'.repeat(10_000) }));
    expect(huge.length).toBeLessThanOrEqual(SLACK_MESSAGE_LIMIT);
  });
});
