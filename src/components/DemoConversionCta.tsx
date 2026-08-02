'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Persistent demo -> account nudge, shown in the command centre while a visitor explores the
 * read-only demo tour on a CONFIGURED deployment - so someone who wandered deep into the console
 * always has the way back to signing up in front of them.
 *
 * Keyed on the lyra_demo cookie: present during the accountless tour, and the middleware clears it
 * the instant they authenticate, so this disappears the moment they have an account (no per-page
 * dismiss state needed). Their whole demo setup carries into the account on sign-up (see
 * demo-carryover), so this is a lossless "keep what you built" prompt, not a restart.
 *
 * The Solo (unconfigured) build never shows it - that build has no accounts; it uses
 * SoloUpgradeCta instead.
 */
export function DemoConversionCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Client-only (reads document.cookie) to avoid an SSR/hydration mismatch.
    const demoTour = /(?:^|;\s*)lyra_demo=1(?:;|$)/.test(document.cookie);
    setShow(isSupabaseConfigured() && demoTour);
  }, []);

  if (!show) return null;

  return (
    <div className="mb-3 flex flex-col gap-2.5 rounded-panel border border-blue/30 bg-blue-tint/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-cell bg-blue-tint text-blue-info">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">You&apos;re exploring the demo. Keep what you build.</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
            Create a free account and your setup carries straight over - synced across your devices,
            with notifications on. Nothing to re-enter.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/auth/login"
          className="rounded-cell border border-line-strong px-3 py-2 text-xs font-medium text-ink-2 transition hover:border-blue/40"
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-1.5 rounded-cell bg-blue-tint px-3 py-2 text-xs font-semibold text-blue-info ring-1 ring-blue/40 transition hover:brightness-125"
        >
          Create account <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
