import { describe, expect, it } from 'vitest';
import {
  buildTelegramTextForEvent,
  escapeHtml,
  scoreBar,
  TELEGRAM_MESSAGE_LIMIT,
} from '../telegram-templates';
import type { NotificationEvent } from '../types';

const event = (over: Partial<NotificationEvent> = {}): NotificationEvent => ({
  id: 'evt-1',
  type: 'signal_alert',
  severity: 'medium',
  userId: 'u1',
  triggerReason: 'RSI reset to 44.2 and the MACD histogram turned up for a 3rd straight hour.',
  title: 'AMD 71/100 - oversold recovery confirming',
  body: 'AMD crossed from building into a strong setup on the 1H scan.',
  evidenceRefs: ['scan:1h:amd'],
  relatedEntityType: 'symbol',
  relatedEntityId: 'amd',
  url: 'https://example.com/ticker/AMD',
  relevanceScore: 71,
  dedupeKey: 'signal_alert:AMD:2026-07-17',
  idempotencyKey: 'idem-1',
  createdAt: '2026-07-17T00:00:00.000Z',
  ...over,
});

describe('escapeHtml', () => {
  it('neutralises every character that can break Telegram HTML parsing', () => {
    expect(escapeHtml('<b>x</b> & "y" \'z\'')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot; &#39;z&#39;');
  });

  it('escapes ampersands before angle brackets so entities are not double-broken', () => {
    // A naive ordering turns "<" into "&lt;" then "&" into "&amp;lt;" - check we do not.
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });
});

describe('scoreBar', () => {
  it('colours by band: green strong, amber middling, red weak', () => {
    expect(scoreBar(71)).toContain('🟩');
    expect(scoreBar(55)).toContain('🟨');
    expect(scoreBar(12)).toContain('🟥');
  });

  it('always renders exactly `cells` cells and fills proportionally', () => {
    expect([...scoreBar(70)].filter((c) => c === '🟩')).toHaveLength(7);
    expect([...scoreBar(70)].filter((c) => c === '⬜')).toHaveLength(3);
  });

  it('clamps out-of-range scores instead of over/under-filling', () => {
    expect([...scoreBar(999)].filter((c) => c === '⬜')).toHaveLength(0);
    expect([...scoreBar(-50)].filter((c) => c === '⬜')).toHaveLength(10);
  });
});

describe('buildTelegramTextForEvent', () => {
  it('leads with the type emoji, label and an uppercased symbol chip', () => {
    const text = buildTelegramTextForEvent(event());
    expect(text.startsWith('🎯 <b>Signal</b> · <code>$AMD</code>')).toBe(true);
  });

  it('always carries the deterministic trigger reason in a blockquote', () => {
    const text = buildTelegramTextForEvent(event());
    expect(text).toContain('<blockquote>💡 <b>Why:</b> RSI reset to 44.2');
  });

  it('escapes hostile content in the title and body rather than emitting raw tags', () => {
    const text = buildTelegramTextForEvent(
      event({ title: '<script>alert(1)</script>', body: 'a & b < c' }),
    );
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('a &amp; b &lt; c');
  });

  it('drops a non-http url instead of rendering it as a link', () => {
    const text = buildTelegramTextForEvent(event({ url: 'javascript:alert(1)' }));
    expect(text).not.toContain('javascript:');
    expect(text).not.toContain('Open in Lyra');
  });

  it('adds the research suffix to research types and withholds it from account activity', () => {
    expect(buildTelegramTextForEvent(event())).toContain('Research, not advice.');
    const paper = buildTelegramTextForEvent(event({ type: 'paper_trade_opened' }));
    expect(paper).not.toContain('Research, not advice.');
    expect(paper).toContain('Paper trade - no real money moved.');
  });

  it('shows severity only when it is high or critical', () => {
    expect(buildTelegramTextForEvent(event({ severity: 'high' }))).toContain('🔴 High priority');
    expect(buildTelegramTextForEvent(event({ severity: 'low' }))).not.toContain('High priority');
  });

  it('stays within the Telegram budget even when the body is enormous', () => {
    const text = buildTelegramTextForEvent(event({ body: 'x'.repeat(20_000) }));
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
  });

  it('keeps provenance and the research suffix when the body is truncated away', () => {
    const text = buildTelegramTextForEvent(event({ body: 'x'.repeat(20_000) }));
    expect(text).toContain('<b>Why:</b>');
    expect(text).toContain('Research, not advice.');
  });

  it('omits the symbol chip when the event is not about a symbol', () => {
    const text = buildTelegramTextForEvent(
      event({ type: 'daily_digest', relatedEntityType: undefined, relatedEntityId: undefined }),
    );
    expect(text).not.toContain('<code>$');
    expect(text.startsWith('☕ <b>Daily digest</b>')).toBe(true);
  });
});
