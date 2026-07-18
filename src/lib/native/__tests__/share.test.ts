/**
 * Pins the share pipeline: system sheet first, clipboard fallback, and - the
 * safety-critical part - a user CANCELLING the share sheet must surface as
 * 'dismissed', never as a success state or a surprise clipboard write.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { absoluteShareUrl, shareCapability, shareLink } from '@/lib/native/share';

afterEach(() => {
  vi.unstubAllGlobals();
});

const abortError = () => {
  const error = new Error('canceled');
  error.name = 'AbortError';
  return error;
};

describe('shareCapability', () => {
  it("is 'none' on the server", () => {
    expect(shareCapability()).toBe('none');
  });

  it("is 'share' when navigator.share exists", () => {
    vi.stubGlobal('navigator', { share: async () => undefined });
    expect(shareCapability()).toBe('share');
  });

  it("is 'clipboard' when only the clipboard exists", () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => undefined } });
    expect(shareCapability()).toBe('clipboard');
  });

  it("is 'none' when neither exists", () => {
    vi.stubGlobal('navigator', {});
    expect(shareCapability()).toBe('none');
  });
});

describe('absoluteShareUrl', () => {
  it('resolves paths against the current origin, not a hardcoded domain', () => {
    vi.stubGlobal('window', { location: { origin: 'https://selfhost.example.com' } });
    expect(absoluteShareUrl('/tickers/NVDA')).toBe('https://selfhost.example.com/tickers/NVDA');
  });

  it('passes absolute URLs through untouched', () => {
    expect(absoluteShareUrl('https://lyra.vivacityai.com.au/track-record')).toBe(
      'https://lyra.vivacityai.com.au/track-record'
    );
  });
});

describe('shareLink', () => {
  const DATA = { title: 'NVDA - Lyra', url: 'https://lyra.vivacityai.com.au/tickers/NVDA' };

  it('uses the system sheet when available', async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { share });
    await expect(shareLink(DATA)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: DATA.title, text: undefined, url: DATA.url });
  });

  it("reports 'dismissed' when the user cancels the sheet - no clipboard write", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', {
      share: async () => {
        throw abortError();
      },
      clipboard: { writeText },
    });
    await expect(shareLink(DATA)).resolves.toBe('dismissed');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to clipboard when the sheet fails for another reason', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', {
      share: async () => {
        throw new Error('NotAllowedError');
      },
      clipboard: { writeText },
    });
    await expect(shareLink(DATA)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(DATA.url);
  });

  it('copies when there is no share sheet at all', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(shareLink(DATA)).resolves.toBe('copied');
  });

  it("reports 'failed' when nothing works", async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async () => {
          throw new Error('blocked');
        },
      },
    });
    await expect(shareLink(DATA)).resolves.toBe('failed');
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', {});
    await expect(shareLink(DATA)).resolves.toBe('failed');
  });
});
