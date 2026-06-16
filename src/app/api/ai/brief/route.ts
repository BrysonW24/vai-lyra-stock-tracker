import { NextRequest, NextResponse } from 'next/server';
import type { DailyBrief } from '@/lib/daily-brief';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, LYRA_BRIEF_FORMAT, composeSystem } from '@/lib/ai/system-prompt';
import { resolveAiCredentials } from '@/lib/ai/credentials';

/**
 * AI-phrased Daily Brief. GROUNDED: the model is given ONLY the deterministic facts
 * already computed by buildDailyBrief and told to phrase them - never to invent numbers
 * or give advice. Any failure / disabled mode returns ok:false so the client falls back
 * to the deterministic brief (which always renders).
 *
 * Provider/model dispatch lives in the AI Gateway (src/lib/ai/gateway.ts) - this route
 * just grounds the prompt and delegates. Browser BYOK wins when present; otherwise hosted
 * OpenAI can run from the server-side OPENAI_API_KEY. Keys are never logged or persisted.
 */

interface BriefRequest {
  brief: DailyBrief;
  ai: { mode: 'free' | 'byo' | 'off' | 'hosted'; provider: AiProvider; apiKey: string; model?: string };
  profile?: { experienceLevel?: string; learningStyle?: string; tradedBefore?: string };
}

const SYSTEM = composeSystem([
  LYRA_IDENTITY,
  'You will be given a set of FACTS computed deterministically by the app. Write a brief that conveys those facts naturally.',
  LYRA_GUARDRAILS,
  LYRA_BRIEF_FORMAT,
]);

function factsBlock(brief: DailyBrief): string {
  const lines = brief.lines.map((l) => `- ${l.label}: ${l.text}`).join('\n');
  return `Headline: ${brief.headline}\nMarket regime: ${brief.regimeLabel}\nFacts:\n${lines}`;
}

function audience(profile?: BriefRequest['profile']): string {
  if (!profile) return '';
  if (profile.tradedBefore === 'no' || profile.experienceLevel === 'beginner') {
    return ' The reader is new to investing - avoid jargon and keep it encouraging but honest.';
  }
  if (profile.experienceLevel === 'professional' || profile.experienceLevel === 'advanced') {
    return ' The reader is an experienced trader - be terse and signal-dense.';
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BriefRequest;
    const { brief, ai, profile } = body;

    if (!brief || !ai) {
      return NextResponse.json({ ok: false, reason: 'disabled' });
    }
    const creds = resolveAiCredentials(ai);
    if (!creds.apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    const prompt = `${factsBlock(brief)}\n\nWrite the brief.${audience(profile)}`;
    const { text } = await complete({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      system: SYSTEM,
      prompt,
      maxTokens: 220,
    });

    if (!text) return NextResponse.json({ ok: false, reason: 'empty' });
    return NextResponse.json({ ok: true, text });
  } catch {
    // Never surface provider errors to the UI - the client falls back to deterministic.
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
