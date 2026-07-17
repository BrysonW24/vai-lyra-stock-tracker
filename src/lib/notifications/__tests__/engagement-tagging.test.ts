/**
 * Engagement tagging contract: internal alert deep links carry nid+ch so opening them
 * becomes a recorded engagement; external links are never touched (the beacon only runs
 * inside Lyra, and foreign params on foreign sites are noise at best).
 */
import { describe, expect, it } from 'vitest';
import { tagEngagementUrl } from '../dispatch';

describe('tagEngagementUrl', () => {
  it('tags internal links with nid and channel', () => {
    expect(tagEngagementUrl('/tickers/NVDA', 'ev-1', 'telegram')).toBe('/tickers/NVDA?nid=ev-1&ch=telegram');
  });

  it('appends with & when a query already exists', () => {
    expect(tagEngagementUrl('/radar?view=top', 'ev-2', 'push')).toBe('/radar?view=top&nid=ev-2&ch=push');
  });

  it('never touches external or protocol-relative urls', () => {
    expect(tagEngagementUrl('https://example.com/x', 'ev-3', 'slack')).toBe('https://example.com/x');
    expect(tagEngagementUrl('//evil.example/x', 'ev-3', 'slack')).toBe('//evil.example/x');
  });

  it('passes undefined through', () => {
    expect(tagEngagementUrl(undefined, 'ev-4', 'push')).toBeUndefined();
  });
});
