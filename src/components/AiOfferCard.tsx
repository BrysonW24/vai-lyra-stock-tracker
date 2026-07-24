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

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
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
      <section className="terminal-panel relative overflow-hidden rounded-md p-3">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#43d18b]/40 to-transparent" />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded text-[#6f7d8a] transition hover:bg-[#151c25] hover:text-[#eef3f8]"
        >
          <X size={13} />
        </button>
        <div className="flex items-start gap-2.5 pr-7">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#8aa2ff]/30 bg-[#101a2e] text-[#8aa2ff]">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-[#eef3f8]">Turn on your AI copilot</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#8190a0]">
              {soloMode
                ? 'Ask Lyra to explain any setup in plain English, grounded in your device-local data. Solo is bring-your-own-key only; your key stays in this browser. Optional - you can do this anytime.'
                : 'Ask Lyra to explain any setup in plain English, grounded in your data. Use the hosted beta model, or bring your own key. Optional - you can do this anytime.'}
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#8aa2ff]/40 bg-[#101a2e] px-3 py-1.5 text-xs font-semibold text-[#8aa2ff] transition hover:bg-[#13203a]"
            >
              <Sparkles size={13} /> Set up AI <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          onClick={() => setOpen(false)}
        >
          <div className="mt-10 w-full max-w-lg rounded-xl border border-[#1d2733] bg-[#0b1016] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">AI copilot setup</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded text-[#8190a0] transition hover:bg-[#151c25] hover:text-[#eef3f8] sm:h-7 sm:w-7">
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
