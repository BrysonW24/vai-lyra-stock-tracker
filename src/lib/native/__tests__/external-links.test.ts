/**
 * Pins the external-link escape policy for the native shell. A false positive
 * (same-origin link treated as external) would kick users out of the app to
 * Safari mid-navigation; a false negative (external link kept in the shell)
 * traps them in a WKWebView with no back button. Both directions are pinned.
 */
import { describe, expect, it } from 'vitest';
import { resolveExternalHref } from '@/lib/native/external-links';

const BASE = 'https://lyra.vivacityai.com.au/tickers/NVDA';

describe('resolveExternalHref', () => {
  it('keeps same-origin absolute links in the shell', () => {
    expect(resolveExternalHref('https://lyra.vivacityai.com.au/alerts', BASE)).toBeNull();
  });

  it('keeps relative and hash links in the shell', () => {
    expect(resolveExternalHref('/track-record', BASE)).toBeNull();
    expect(resolveExternalHref('../alerts', BASE)).toBeNull();
    expect(resolveExternalHref('#score', BASE)).toBeNull();
    expect(resolveExternalHref('?view=setup', BASE)).toBeNull();
  });

  it('escapes external http(s) links to the exact absolute URL', () => {
    expect(resolveExternalHref('https://finance.yahoo.com/quote/%5EGSPC', BASE)).toBe(
      'https://finance.yahoo.com/quote/%5EGSPC'
    );
    expect(resolveExternalHref('http://example.com/page', BASE)).toBe('http://example.com/page');
  });

  it('treats a different subdomain or port as external', () => {
    expect(resolveExternalHref('https://docs.vivacityai.com.au/', BASE)).toBe(
      'https://docs.vivacityai.com.au/'
    );
    expect(resolveExternalHref('https://lyra.vivacityai.com.au:8443/x', BASE)).toBe(
      'https://lyra.vivacityai.com.au:8443/x'
    );
  });

  it('resolves protocol-relative links against the base scheme', () => {
    expect(resolveExternalHref('//github.com/BrysonW24', BASE)).toBe('https://github.com/BrysonW24');
  });

  it('leaves non-http schemes to the OS', () => {
    expect(resolveExternalHref('mailto:alerts@vivacity.ai', BASE)).toBeNull();
    expect(resolveExternalHref('tel:+61400000000', BASE)).toBeNull();
    expect(resolveExternalHref('sms:+61400000000', BASE)).toBeNull();
  });

  it('ignores empty, unparseable, and javascript hrefs', () => {
    expect(resolveExternalHref('', BASE)).toBeNull();
    expect(resolveExternalHref('https://', BASE)).toBeNull();
    expect(resolveExternalHref('javascript:void(0)', BASE)).toBeNull();
    expect(resolveExternalHref('https://example.com', 'not a url')).toBeNull();
  });
});
