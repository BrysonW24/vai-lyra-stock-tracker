import { describe, expect, it } from 'vitest';
import themes from '@/lib/generated/themes.json';
import { BRIEFING_THEMES, STANDING_DESKS } from '../briefing';
import { MAX_HOLDINGS, SUBSCRIBE_TOPICS, describeSubscription, isValidEmail, normaliseHoldings, normaliseTopics, telegramDeepLink } from '../subscribe';

describe('subscribe-by-link rules', () => {
  it('offers the briefing spine as topics: every theme page, every standing desk, and holdings', () => {
    const slugs = (themes as Array<{ slug: string }>).map((theme) => theme.slug);
    expect(SUBSCRIBE_TOPICS.filter((topic) => topic.group === 'theme').map((topic) => topic.id)).toEqual(BRIEFING_THEMES.filter((theme) => theme !== 'other'));
    expect(new Set(BRIEFING_THEMES.filter((theme) => theme !== 'other'))).toEqual(new Set(slugs));
    expect(SUBSCRIBE_TOPICS.filter((topic) => topic.group === 'desk').map((topic) => topic.id)).toEqual(STANDING_DESKS);
    expect(SUBSCRIBE_TOPICS.at(-1)?.id).toBe('holdings');
  });

  it('normalises holdings as people type them', () => {
    expect(normaliseHoldings('nvda, $qqq crwd;brk.b rio.ax nvda')).toEqual(['NVDA', 'QQQ', 'CRWD', 'BRK.B', 'RIO.AX']);
    expect(normaliseHoldings(['aapl', 'not a ticker!', '', 7 as unknown as string])).toEqual(['AAPL']);
    expect(normaliseHoldings(Array.from({ length: 30 }, (_, i) => `S${i}`))).toHaveLength(MAX_HOLDINGS);
    expect(normaliseHoldings(undefined)).toEqual([]);
  });

  it('keeps only known topics, once, in the order given', () => {
    expect(normaliseTopics(['holdings', 'gossip', 'agi-infrastructure', 'ipo', 'holdings', 'other'])).toEqual(['holdings', 'agi-infrastructure', 'ipo']);
    expect(normaliseTopics('agi-infrastructure')).toEqual([]);
  });

  it('accepts plausible addresses only - the confirmation link proves the inbox', () => {
    expect(isValidEmail('friend@example.com')).toBe(true);
    expect(isValidEmail('friend@example')).toBe(false);
    expect(isValidEmail('no spaces@example.com')).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });

  it('builds the deep link the bot answers for', () => {
    expect(telegramDeepLink('@viva_lyra_trading_bot', 'abc')).toBe('https://t.me/viva_lyra_trading_bot?start=sabc');
  });

  it('describes a subscription in plain words', () => {
    expect(describeSubscription([], [])).toBe('every theme and every desk');
    expect(describeSubscription(['agi-infrastructure', 'ipo'], ['NVDA', 'QQQ'])).toBe('AI labs and infrastructure, IPOs and filings, with NVDA, QQQ flagged first');
  });
});
