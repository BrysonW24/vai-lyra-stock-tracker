'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { bumpAiUsage } from '@/lib/usage-store';
import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import type { DailyBrief } from '@/lib/daily-brief';
import { loadAi } from '@/lib/account';

type Phase = 'idle' | 'loading' | 'offer' | 'unavailable';

/**
 * Optional AI narration over the deterministic Daily Brief. Reads the user's Account AI
 * setting; if enabled, asks the grounded /api/ai/brief route to phrase the same facts.
 * Renders nothing when AI is unavailable, so the card stays deterministic.
 *
 * It asks by itself, on load, only when somebody is paying for the answer - the reader's own key,
 * or a hosted entitlement. The FREE model is a daily allowance shared by everyone, so it is never
 * spent on a page view: the route answers `on_request`, and this shows a button instead. One tap
 * writes the brief.
 */
export function BriefAiNarration({ brief }: { brief: DailyBrief }) {
  const [text, setText] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const request = useCallback(
    (asked: boolean, isCancelled: () => boolean = () => false, announce: boolean = asked) => {
      // "Writing your brief" is shown when an answer is certain to be attempted - a tap, or the
      // reader's own key. An automatic call that may come back "on request" stays quiet, so the
      // card does not flash a promise and then swap it for a button.
      if (announce) setPhase('loading');
      bumpAiUsage();
      fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief, ai: loadAi(), asked }),
      })
        .then((res) => res.json())
        .then((data: { ok?: boolean; text?: string; reason?: string }) => {
          if (isCancelled()) return;
          if (data?.ok && data.text) {
            setText(data.text);
            setPhase('idle');
          } else if (!asked && data?.reason === 'on_request') {
            setPhase('offer');
          } else {
            // A tap that got nothing says so; an automatic call that got nothing stays silent.
            setPhase(asked ? 'unavailable' : 'idle');
          }
        })
        .catch(() => {
          if (!isCancelled()) setPhase(asked ? 'unavailable' : 'idle');
        });
    },
    [brief],
  );

  useEffect(() => {
    setText(null);
    setPhase('idle');
    const ai = loadAi();
    // Browser BYOK wins. OpenAI/Google can also be server-backed; the route resolves that without
    // exposing secret availability to the bundle.
    const hasKey = !!ai.apiKey?.trim();
    const serverBacked = ai.provider === 'openai' || ai.provider === 'google';
    if (!hasKey && !serverBacked) return;

    let cancelled = false;
    request(false, () => cancelled, hasKey);
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (text) {
    return (
      <div className="border-b border-line bg-chrome px-4 py-3">
        <AiGeneratedLabel size={12} />
        <p className="mt-1.5 text-sm leading-relaxed text-ink-title">{text}</p>
      </div>
    );
  }
  if (phase === 'loading') {
    return (
      <div className="border-b border-line bg-chrome px-4 py-3">
        <AiGeneratedLabel size={12} />
        <p className="mt-1.5 text-sm text-ink-3">Writing your brief…</p>
      </div>
    );
  }
  if (phase === 'offer') {
    return (
      <div className="border-b border-line bg-chrome px-4 py-2">
        <button
          type="button"
          onClick={() => request(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-pending transition hover:underline"
        >
          <Sparkles size={13} /> Write this brief in plain English
        </button>
        <p className="-mt-1 pb-1 text-[10px] leading-snug text-ink-dim">
          Sends the lines of this brief, as shown here, to Lyra&apos;s free open-source model (hosted by Cloudflare or Groq).
        </p>
      </div>
    );
  }
  if (phase === 'unavailable') {
    return (
      <div className="border-b border-line bg-chrome px-4 py-2.5">
        <p className="text-[11px] text-ink-3">No free answer is available right now - the figures above are the brief.</p>
      </div>
    );
  }
  return null;
}
