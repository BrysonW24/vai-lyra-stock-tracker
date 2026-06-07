'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@vercel/analytics';

/**
 * Privacy-first usage tracking on top of Vercel Web Analytics.
 *
 * Pageviews / most-visited pages are captured automatically by <Analytics/>. This adds
 * two custom events for the behaviour Bryson asked about:
 *   - `page_time`  → { path, seconds }  (time on screen, flushed on route change + tab hide)
 *   - `ui_click`   → { label, path }    (most-clicked buttons/links, label only)
 *
 * No PII, no content, no cookies - only the element's visible label + the route. `track()`
 * is a safe no-op until Vercel Analytics is enabled, and custom events may require the
 * Vercel Pro plan; default pageviews work on any plan.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const enteredAt = useRef<number>(Date.now());
  const currentPath = useRef<string>(pathname);

  // Flush time spent on the path we are leaving when the route changes.
  useEffect(() => {
    const now = Date.now();
    const seconds = Math.round((now - enteredAt.current) / 1000);
    if (currentPath.current !== pathname && seconds > 0 && seconds < 3600) {
      track('page_time', { path: currentPath.current, seconds });
    }
    enteredAt.current = now;
    currentPath.current = pathname;
  }, [pathname]);

  // Flush on tab hide / page unload so short and abandoned sessions still count.
  useEffect(() => {
    const flush = () => {
      const seconds = Math.round((Date.now() - enteredAt.current) / 1000);
      if (seconds > 0 && seconds < 3600) {
        track('page_time', { path: currentPath.current, seconds });
      }
      enteredAt.current = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Delegated click tracking for buttons + links - captures the visible label only.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const el = target?.closest('button, a[href]') as HTMLElement | null;
      if (!el) return;
      const label =
        el.getAttribute('aria-label') ||
        (el.textContent || '').trim().slice(0, 40) ||
        el.getAttribute('href') ||
        el.tagName.toLowerCase();
      track('ui_click', { label, path: currentPath.current });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
