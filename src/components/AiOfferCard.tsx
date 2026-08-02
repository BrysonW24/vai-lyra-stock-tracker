'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { AiInsightStep } from '@/components/onboarding/AiInsightStep';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const DISMISS_KEY = 'lyra.aiOffer.dismissed';

/**
 * Command Centre AI offer. The AI model/key setup was pulled out of onboarding (too much up front);
 * instead we offer it here, once the user is in the console, and bring up the SAME screen onboarding
 * used (AiInsightStep) in a modal. Dismissible + one-time: hidden after they set it up or dismiss it.
 */
export function AiOfferCard() {
  const soloMode = !isSupabaseConfigured();
  const [dismissed, setDismissed] = useState(true); // hidden until mount resolves localStorage (no SSR flash)
  const [open, setOpen] = useState(false);
  // Whether a hosted AI key actually exists here (a Supabase-configured build can still be BYOK-only).
  const [hostedAvailable, setHostedAvailable] = useState<boolean | null>(null);
  const effectiveHosted = hostedAvailable ?? !soloMode;

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.hostedAvailable === 'boolean') setHostedAvailable(d.hostedAvailable);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function complete() {
    setOpen(false);
    dismiss(); // they've configured AI - stop offering
  }

  if (dismissed) return null;

  return (
    <>
      <section className="terminal-panel relative overflow-hidden rounded-panel p-3">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-positive/40 to-transparent" />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded text-ink-dim transition hover:bg-line/50 hover:text-ink"
        >
          <X size={13} />
        </button>
        <div className="flex items-start gap-2.5 pr-7">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-cell border border-pending/30 bg-blue-tint text-pending">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-ink">Turn on your AI copilot</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">
              {`Ask Lyra to explain any setup in plain English, grounded in ${soloMode ? 'your device-local data' : 'your data'}. ${
                effectiveHosted
                  ? 'Use the hosted beta model, or bring your own key.'
                  : 'This deployment has no hosted key - bring your own to switch AI on; it stays in this browser.'
              } Optional - you can do this anytime.`}
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-cell border border-pending/40 bg-blue-tint px-3 py-1.5 text-xs font-semibold text-pending transition hover:bg-blue-deep/30"
            >
              <Sparkles size={13} /> Set up AI <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ground/80 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          onClick={() => setOpen(false)}
        >
          <div className="mt-10 w-full max-w-lg rounded-panel border border-line bg-chrome p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">AI copilot setup</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded text-ink-3 transition hover:bg-line/50 hover:text-ink sm:h-7 sm:w-7">
                <X size={15} />
              </button>
            </div>
            <AiInsightStep onNext={complete} />
          </div>
        </div>
      )}
    </>
  );
}
