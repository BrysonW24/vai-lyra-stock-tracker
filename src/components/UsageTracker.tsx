'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@vercel/analytics';
import { ensureSession, recordSurfaceVisit, accrueSurfaceDwell } from '@/lib/usage-store';

/**
 * Usage tracking - two complementary layers:
 *
 *  1. LOCAL (private, in-app): feeds the "Your Activity" page from the user's OWN browser storage -
 *     sessions, per-surface visits + dwell (the heatmap), all on-device, no server, no plan needed.
 *  2. VERCEL Web Analytics (owner-side aggregate): default pageviews are captured by <Analytics/>;
 *     this adds `page_time` and `ui_click` custom events (visible in the Vercel dashboard). `track()`
 *     is a safe no-op until Vercel Analytics is enabled, and custom events may require the Pro plan.
 *
 * No PII, no content, no cookies - only the route + a visible label. Both layers are best-effort and
 * never block the app.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const enteredAt = useRef<number>(Date.now());
  const currentPath = useRef<string>(pathname);

  // One local session per browser session (deduped in the store).
  useEffect(() => {
    ensureSession();
  }, []);

  // On route change: flush time on the path we are leaving (Vercel + local dwell), then count the
  // local visit to the new surface.
  useEffect(() => {
    const now = Date.now();
    const ms = now - enteredAt.current;
    const seconds = Math.round(ms / 1000);
    if (currentPath.current !== pathname) {
      if (seconds > 0 && seconds < 3600) track('page_time', { path: currentPath.current, seconds });
      accrueSurfaceDwell(currentPath.current, ms);
    }
    recordSurfaceVisit(pathname, 0);
    enteredAt.current = now;
    currentPath.current = pathname;
  }, [pathname]);

  // Flush on tab hide / page unload so short and abandoned sessions still count.
  useEffect(() => {
    const flush = () => {
      const now = Date.now();
      const ms = now - enteredAt.current;
      const seconds = Math.round(ms / 1000);
      if (seconds > 0 && seconds < 3600) track('page_time', { path: currentPath.current, seconds });
      accrueSurfaceDwell(currentPath.current, ms);
      enteredAt.current = now;
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

  // Delegated click tracking for buttons + links (Vercel only) - captures the visible label only.
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
