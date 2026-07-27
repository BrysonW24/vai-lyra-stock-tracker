'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Sparkles, X } from 'lucide-react';

/**
 * First-landing AI trial splash for the command centre (CONFIGURED / prod deployments).
 *
 * A signed-in user gets Lyra's hosted AI free for their first 2 weeks, then it switches to
 * bring-your-own-key (see lib/ai/entitlement + /api/ai/status). This makes that deal explicit up
 * front instead of leaving it buried in Settings:
 *   - in trial  -> a one-time welcome explaining "free for N days, then your own key"
 *   - lapsed    -> a one-time "your 2 weeks are up, add a key" nudge (only where a hosted key
 *                  existed, i.e. prod), so a user who suddenly needs a key knows why
 *
 * Shown ONCE per state, gated by localStorage (per-device, no table). Granted users (hosted
 * forever) and anonymous / Solo callers never see it. Preview with ?ai-splash=welcome|lapsed.
 */

const KEY_WELCOME = 'lyra.aiTrialSplash.welcome';
const KEY_LAPSED = 'lyra.aiTrialSplash.lapsed';

type Mode = 'welcome' | 'lapsed';

function seen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function AiTrialSplash() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [days, setDays] = useState(14);

  useEffect(() => {
    const force = new URLSearchParams(window.location.search).get('ai-splash');
    if (force === 'welcome') {
      setDays(14);
      setMode('welcome');
      return;
    }
    if (force === 'lapsed') {
      setMode('lapsed');
      return;
    }
    // Nothing left to say once both one-time notices are done - skip the network call entirely.
    if (seen(KEY_WELCOME) && seen(KEY_LAPSED)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/status');
        if (!res.ok || cancelled) return;
        const s = (await res.json()) as {
          authenticated?: boolean;
          granted?: boolean;
          aiIncluded?: boolean;
          trialDaysLeft?: number;
          hostedKeyOnDeployment?: boolean;
        };
        // Granted (hosted forever), anonymous, or Solo (no hosted key) -> nothing to say.
        if (cancelled || !s.authenticated || s.granted) return;
        if (s.aiIncluded && (s.trialDaysLeft ?? 0) > 0 && !seen(KEY_WELCOME)) {
          setDays(s.trialDaysLeft ?? 14);
          setMode('welcome');
        } else if (!s.aiIncluded && s.hostedKeyOnDeployment && !seen(KEY_LAPSED)) {
          setMode('lapsed');
        }
      } catch {
        /* status is best-effort; a fetch failure just means no splash this load */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mode) return null;

  const retire = () => {
    try {
      localStorage.setItem(mode === 'welcome' ? KEY_WELCOME : KEY_LAPSED, '1');
    } catch {
      /* ignore */
    }
    setMode(null);
  };

  const welcome = mode === 'welcome';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={welcome ? 'AI free trial' : 'AI trial ended'}>
      <button type="button" aria-label="Close" onClick={retire} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-[#263241] bg-[#0b1118] p-5 shadow-2xl">
        <button
          type="button"
          onClick={retire}
          aria-label="Close"
          className="absolute right-3 top-3 rounded p-1 text-[#5d6b79] transition hover:text-[#a8b5c2]"
        >
          <X size={16} />
        </button>

        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF] text-white shadow-[0_10px_24px_-8px_rgba(30,99,255,0.7)] ring-1 ring-white/10">
          {welcome ? <Sparkles size={20} /> : <KeyRound size={20} />}
        </span>

        {welcome ? (
          <>
            <h2 className="mt-3 text-lg font-semibold text-[#eef3f8]">Your Lyra AI is free for 2 weeks</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#a8b5c2]">
              You have <span className="font-semibold text-[#eef3f8]">{days} {days === 1 ? 'day' : 'days'}</span> of
              Lyra&apos;s built-in AI included, free. When the trial ends it switches to your own AI key - about a
              minute to set up, and it stays in your browser. Your scanner, portfolio, watchlist and notifications
              keep working the whole time; only the AI chat needs a key.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-semibold text-[#eef3f8]">Your 2 weeks of free AI are up</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#a8b5c2]">
              To keep Lyra&apos;s AI chat and explanations, add your own AI key - it stays in your browser and takes
              about a minute. Everything else - the scanner, your portfolio, watchlist and notifications - keeps
              working exactly as before.
            </p>
          </>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={retire} className="rounded-md px-3 py-2 text-xs font-medium text-[#8190a0] transition hover:text-[#c3d0dd]">
            {welcome ? 'Got it' : 'Not now'}
          </button>
          <Link
            href="/account/ai"
            onClick={retire}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3b5bdb] to-[#43d18b] px-3.5 py-2 text-xs font-semibold text-[#07090c] transition hover:brightness-110"
          >
            {welcome ? 'Set up my key' : 'Add my key'} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
