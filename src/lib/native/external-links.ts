/**
 * External-link policy for the native shell.
 *
 * An off-origin navigation inside the WKWebView would trap the user: the
 * remote shell has no browser chrome, no address bar, no back button.
 * Capacitor 8 already ejects off-app navigations and target=_blank popups to
 * the system browser natively (WKUIDelegate / decidePolicyFor), so the web
 * layer's job is to guarantee the same policy independent of native config
 * drift: external http(s) clicks go to `window.open` (routed out of the app
 * by the native handler), everything else navigates normally. This module
 * holds the pure decision logic so it can be unit-tested in the node
 * environment; the DOM listener lives in
 * `src/components/native/ExternalLinkBoundary.tsx`.
 */

/**
 * Decide whether an anchor href must escape the shell. Returns the absolute
 * URL to open externally, or null when the link should navigate normally
 * (same-origin pages, hash/relative links, and non-http schemes like mailto:
 * which the WKWebView already hands to the OS).
 */
export function resolveExternalHref(href: string, baseHref: string): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, baseHref);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  let base: URL;
  try {
    base = new URL(baseHref);
  } catch {
    return null;
  }
  if (url.origin === base.origin) return null;
  return url.href;
}
