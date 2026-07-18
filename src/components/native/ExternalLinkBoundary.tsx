'use client';

/**
 * Link-policy boundary for the native shell. Mounted once in the root layout;
 * renders nothing and installs nothing in normal browsers - the listener only
 * ever attaches when isNativeShell() is true, so web behavior is untouched.
 *
 * In-shell it enforces two rules at the web layer, via one capture-phase
 * click listener:
 *
 * 1. Off-origin http(s) links open in the system browser (window.open, which
 *    Capacitor's native WKUIDelegate routes out of the app). Capacitor 8
 *    already bounces off-app navigations and target=_blank popups to Safari
 *    natively, so this is defense-in-depth: the escape survives any future
 *    allowNavigation/config drift instead of depending on it.
 * 2. Same-origin target=_blank links stay IN the shell (navigate in place).
 *    Without this, the native _blank handler would eject the user to Safari
 *    showing the same site. No such link exists in src today - this closes
 *    the trap before one does.
 */
import { useEffect } from 'react';
import { isNativeShell } from '@/lib/native/platform';
import { resolveExternalHref } from '@/lib/native/external-links';

export default function ExternalLinkBoundary() {
  useEffect(() => {
    if (!isNativeShell()) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      const external = resolveExternalHref(href, window.location.href);
      if (external) {
        event.preventDefault();
        window.open(external, '_blank', 'noopener');
        return;
      }
      if (anchor.getAttribute('target') === '_blank') {
        let url: URL;
        try {
          url = new URL(href, window.location.href);
        } catch {
          return;
        }
        if (url.origin === window.location.origin) {
          event.preventDefault();
          window.location.assign(url.href);
        }
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
