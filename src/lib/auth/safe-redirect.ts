/**
 * Only a same-origin relative path is a safe post-login redirect. A raw `next` like `@evil.com`
 * or `//evil.com` is resolved by the browser as a different host (userinfo / protocol-relative),
 * so `${origin}${next}` becomes an open redirect off the trusted domain. Accept only a path that
 * starts with a single `/` and is not `//` or `/\`; everything else falls back to `/`.
 */
export function safeInternalPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
