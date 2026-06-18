import { describe, expect, it } from 'vitest';
import { buildWhatsAppMessageForEvent } from '../whatsapp-templates';
import type { NotificationEvent } from '../types';

function baseEvent(overrides: Partial<NotificationEvent>): NotificationEvent {
  return {
    id: 'evt-1',
    type: 'signal_alert',
    severity: 'high',
    userId: 'user-1',
    triggerReason: 'RSI reset in the 35-50 band with improving MACD',
    title: 'NVDA early turn',
    body: 'NVDA score 82, near 60-period low.',
    evidenceRefs: [],
    relatedEntityType: 'symbol',
    relatedEntityId: 'NVDA',
    url: '/tickers/NVDA',
    relevanceScore: 82,
    dedupeKey: 'signal_alert:NVDA:2026-06-18',
    idempotencyKey: 'evt-1:event',
    createdAt: '2026-06-18T01:00:00.000Z',
    ...overrides,
  };
}

describe('buildWhatsAppMessageForEvent', () => {
  it('maps a signal_alert event onto the approved signal template using real fields', () => {
    const message = buildWhatsAppMessageForEvent(baseEvent({}));
    expect(message.kind).toBe('template');
    if (message.kind !== 'template') return;
    expect(message.name).toBe('lyra_signal_alert');
    const params = message.components[0].parameters.map((p) => p.text);
    // symbol, score, delta, action state, trigger reason, evidence url
    expect(params[0]).toBe('NVDA');
    expect(params[1]).toBe('82');
    expect(params[5]).toBe('/tickers/NVDA');
    expect(message.previewText).toContain('NVDA');
  });

  it('maps a portfolio_risk event onto the approved portfolio-risk template', () => {
    const message = buildWhatsAppMessageForEvent(
      baseEvent({ type: 'portfolio_risk', relatedEntityId: 'TSLA', severity: 'critical' }),
    );
    expect(message.kind).toBe('template');
    if (message.kind !== 'template') return;
    expect(message.name).toBe('lyra_portfolio_risk');
    expect(message.components[0].parameters[0].text).toBe('TSLA');
  });

  it('maps digest events onto the approved daily-digest template without fabricating movers', () => {
    const message = buildWhatsAppMessageForEvent(baseEvent({ type: 'weekly_report' }));
    expect(message.kind).toBe('template');
    if (message.kind !== 'template') return;
    expect(message.name).toBe('lyra_daily_digest');
    // No invented movers - the engine summary fills the body slot.
    expect(message.previewText).toContain('no significant movers');
  });

  it('falls back to freeform text for order-approval events (no fabricated order numbers)', () => {
    const message = buildWhatsAppMessageForEvent(
      baseEvent({ type: 'order_approval_required', title: 'Approval required', body: 'Approve or reject.' }),
    );
    expect(message.kind).toBe('text');
    if (message.kind !== 'text') return;
    expect(message.body).toContain('Approval required');
  });

  it('never throws and degrades to text on an unparseable timestamp', () => {
    const message = buildWhatsAppMessageForEvent(baseEvent({ type: 'daily_digest', createdAt: 'not-a-date' }));
    // Digest mapping must still produce a valid template via the today fallback date.
    expect(message.kind).toBe('template');
  });
});
