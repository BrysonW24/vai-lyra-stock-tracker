import { describe, it, expect } from 'vitest';
import { asCategory, asSentiment, asRelevance, asTrend, sourceTypeFor, slugId } from '@/lib/intelligence-live';

/**
 * 2026-07-27 audit V9: the intelligence live-read module (which carries the fabrication fix - real
 * feed vs honest sample) had no direct tests. These pin the DB-row -> IntelligenceItem mapping: each
 * validator must default unknown/absent DB text to a safe member, never trust it raw, and the
 * category -> sourceType derivation must be stable.
 */
describe('intelligence-live field validators', () => {
  it('keeps known values and defaults unknown ones', () => {
    expect(asCategory('Earnings')).toBe('Earnings');
    expect(asCategory('garbage')).toBe('Macro');
    expect(asCategory(undefined)).toBe('Macro');

    expect(asSentiment('positive')).toBe('positive');
    expect(asSentiment('bullish')).toBe('neutral'); // not a member -> default
    expect(asSentiment(null)).toBe('neutral');

    expect(asRelevance('high')).toBe('high');
    expect(asRelevance('critical')).toBe('medium');

    expect(asTrend('rising')).toBe('rising');
    expect(asTrend('exploding')).toBe('steady');
  });
});

describe('sourceTypeFor', () => {
  it('maps each category group to its source type', () => {
    expect(sourceTypeFor('Earnings')).toBe('earnings');
    expect(sourceTypeFor('Guidance')).toBe('earnings');
    expect(sourceTypeFor('Analyst upgrade')).toBe('analyst');
    expect(sourceTypeFor('Analyst downgrade')).toBe('analyst');
    expect(sourceTypeFor('Product launch')).toBe('press_release');
    expect(sourceTypeFor('AI announcement')).toBe('press_release');
    expect(sourceTypeFor('Regulatory')).toBe('sec_filing');
    expect(sourceTypeFor('M&A')).toBe('sec_filing');
    expect(sourceTypeFor('Macro')).toBe('macro');
  });
});

describe('slugId', () => {
  it('produces a stable, url-safe, bounded id', () => {
    const id = slugId('Goldman elevates NVDA to conviction buy', 'Bloomberg');
    expect(id.startsWith('live-')).toBe(true);
    expect(id).toMatch(/^live-[a-z0-9-]+$/);
    expect(id.length).toBeLessThanOrEqual(85);
    // Deterministic - same inputs, same id (dedupe key).
    expect(slugId('Goldman elevates NVDA to conviction buy', 'Bloomberg')).toBe(id);
  });
});
