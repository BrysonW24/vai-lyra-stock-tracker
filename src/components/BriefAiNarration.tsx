'use client';

import { useEffect, useState } from 'react';
import { bumpAiUsage } from '@/lib/usage-store';
import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import type { DailyBrief } from '@/lib/daily-brief';
import { loadAi } from '@/lib/account';

/**
 * Optional AI narration over the deterministic Daily Brief. Reads the user's Account AI
 * setting; if enabled, asks the grounded /api/ai/brief route to phrase the same facts.
 * Renders nothing when AI is unavailable, so the card stays deterministic.
 */
export function BriefAiNarration({ brief }: { brief: DailyBrief }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ai = loadAi();
    // Browser BYOK wins. OpenAI/Google can also be server-backed; the route resolves that without
    // exposing secret availability to the bundle.
    const hasKey = !!ai.apiKey?.trim();
    const serverBacked = ai.provider === 'openai' || ai.provider === 'google';
    if (!hasKey && !serverBacked) return;

    let cancelled = false;
    setLoading(true);
    bumpAiUsage();
    fetch('/api/ai/brief', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ brief, ai }),
    })
      .then((res) => res.json())
      .then((data: { ok?: boolean; text?: string }) => {
        if (!cancelled && data?.ok && data.text) setText(data.text);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brief]);

  if (!loading && !text) return null;

  return (
    <div className="border-b border-[#1b2530] bg-[#0b1016] px-4 py-3">
      <AiGeneratedLabel size={12} />
      {loading && !text ? (
        <p className="mt-1.5 text-sm text-[#8190a0]">Writing your brief…</p>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-[#dbe5ee]">{text}</p>
      )}
    </div>
  );
}
