import { describe, expect, it } from 'vitest';
import { MAX_HOLDINGS, describeSubscription, isValidEmail, normaliseHoldings, normaliseTopics, telegramDeepLink } from '../subscribe';

describe('subscribe-by-link rules', () => {
  it('normalises holdings as people type them', () => {
    expect(normaliseHoldings('nvda, $qqq crwd;brk.b rio.ax nvda')).toEqual(['NVDA', 'QQQ', 'CRWD', 'BRK.B', 'RIO.AX']);
    expect(normaliseHoldings(['aapl', 'not a ticker!', '', 7 as unknown as string])).toEqual(['AAPL']);
    expect(normaliseHoldings(Array.from({ length: 30 }, (_, i) => `S${i}`))).toHaveLength(MAX_HOLDINGS);
    expect(normaliseHoldings(undefined)).toEqual([]);
  });

  it('keeps only known topics, once, in the order given', () => {
    expect(normaliseTopics(['holdings', 'gossip', 'ai_release', 'holdings'])).toEqual(['holdings', 'ai_release']);
    expect(normaliseTopics('ai_release')).toEqual([]);
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
    expect(describeSubscription([], [])).toBe('everything in the briefing');
    expect(describeSubscription(['ai_release', 'investment'], ['NVDA', 'QQQ'])).toBe('ai releases, deals and listings, with NVDA, QQQ flagged first');
  });
});
