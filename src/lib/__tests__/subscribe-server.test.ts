import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkSignature, newSubscriberToken, signatureMatches, signedLink, subscribeAvailability, telegramBotUsername } from '../subscribe-server';

describe('subscribe links and tokens', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('signs links exactly as the worker does (vector pinned in tests/test_briefing_subscribers.py)', () => {
    expect(linkSignature('secret', 'unsubscribe', 'abc')).toBe('3b344de38afdc6e558b5eaf733bd1798');
    expect(linkSignature('secret', 'confirm', 'abc')).toBe('a0ddedb65b050dec7ce83e2b32110f0e');
    expect(signedLink('https://lyra.example/', 'unsubscribe', 'secret', 'abc')).toBe('https://lyra.example/api/subscribe/unsubscribe?id=abc&sig=3b344de38afdc6e558b5eaf733bd1798');
  });

  it('verifies a signature for its own purpose only, in constant time', () => {
    expect(signatureMatches('secret', 'unsubscribe', 'abc', '3b344de38afdc6e558b5eaf733bd1798')).toBe(true);
    expect(signatureMatches('secret', 'unsubscribe', 'abc', '3b344de38afdc6e558b5eaf733bd1799')).toBe(false);
    expect(signatureMatches('secret', 'confirm', 'abc', '3b344de38afdc6e558b5eaf733bd1798')).toBe(false);
    expect(signatureMatches('secret', 'unsubscribe', 'abd', '3b344de38afdc6e558b5eaf733bd1798')).toBe(false);
    expect(signatureMatches('secret', 'unsubscribe', 'abc', null)).toBe(false);
    expect(signatureMatches('secret', 'unsubscribe', 'abc', 'short')).toBe(false);
  });

  it('mints 22-character url-safe tokens that do not repeat', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newSubscriberToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('offers Telegram only when the bot can answer /start, and email only with a Resend key', () => {
    vi.stubEnv('TELEGRAM_BOT_USERNAME', '@viva_lyra_trading_bot');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(telegramBotUsername()).toBe('viva_lyra_trading_bot');
    expect(subscribeAvailability()).toEqual({ telegram: false, email: false });
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token');
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'whsec');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    expect(subscribeAvailability()).toEqual({ telegram: true, email: true });
  });
});
