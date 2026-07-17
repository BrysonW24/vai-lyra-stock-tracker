import { describe, expect, it } from 'vitest';
import {
  buildTelegramTextForEvent,
  escapeHtml,
  formatPct,
  performanceBadge,
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

describe('performanceBadge', () => {
  it('escalates cash-with-wings across the 5 / 10 / 15% gain tiers', () => {
    expect(performanceBadge(5)).toBe('💸');
    expect(performanceBadge(10)).toBe('💸💸');
    expect(performanceBadge(15)).toBe('💸💸💸');
    expect(performanceBadge(42)).toBe('💸💸💸');
  });

  it('holds the boundaries exactly - 4.9 is not a 5% win', () => {
    expect(performanceBadge(4.9)).toBe('🟢');
    expect(performanceBadge(9.9)).toBe('💸');
    expect(performanceBadge(14.9)).toBe('💸💸');
  });

  it('never dresses up a flat or losing period as a win', () => {
    expect(performanceBadge(0)).toBe('➖');
    expect(performanceBadge(-0.1)).toBe('🔻');
    expect(performanceBadge(-30)).toBe('🔻');
  });
});

describe('formatPct', () => {
  it('is always explicit about direction', () => {
    expect(formatPct(12.44)).toBe('+12.4%');
    expect(formatPct(-6.15)).toBe('-6.2%');
    expect(formatPct(0)).toBe('0.0%');
  });
});

describe('review types', () => {
  it('puts the performance badge in the header so a good period reads from the chat list', () => {
    const text = buildTelegramTextForEvent(
      event({ type: 'monthly_review', performancePct: 12.4, relatedEntityType: undefined, relatedEntityId: undefined }),
    );
    expect(text.startsWith('🗓 <b>Monthly review</b> · 💸💸 <b>+12.4%</b>')).toBe(true);
  });

  it('renders a losing month honestly rather than hiding it', () => {
    const text = buildTelegramTextForEvent(
      event({ type: 'quarterly_review', performancePct: -8.3, relatedEntityType: undefined, relatedEntityId: undefined }),
    );
    expect(text).toContain('🔻 <b>-8.3%</b>');
    expect(text).not.toContain('💸');
  });

  it('gives every review period its own mark', () => {
    const mk = (type: 'weekly_report' | 'monthly_review' | 'quarterly_review' | 'yearly_review') =>
      buildTelegramTextForEvent(event({ type, relatedEntityType: undefined, relatedEntityId: undefined }));
    expect(mk('weekly_report').startsWith('📊')).toBe(true);
    expect(mk('monthly_review').startsWith('🗓')).toBe(true);
    expect(mk('quarterly_review').startsWith('📆')).toBe(true);
    expect(mk('yearly_review').startsWith('🏆')).toBe(true);
  });

  it('treats reviews as research output, so they carry the suffix', () => {
    for (const type of ['monthly_review', 'quarterly_review', 'yearly_review'] as const) {
      expect(buildTelegramTextForEvent(event({ type }))).toContain('Research, not advice.');
    }
  });

  it('omits the badge on types that carry no measured outcome', () => {
    const text = buildTelegramTextForEvent(event({ type: 'signal_alert', performancePct: 12.4 }));
    expect(text).not.toContain('💸');
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
