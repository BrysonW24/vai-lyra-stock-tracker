import { NextRequest, NextResponse } from 'next/server';
import type { DailyBrief } from '@/lib/daily-brief';
import { complete, type AiProvider } from '@/lib/ai/gateway';

/**
 * AI-phrased Daily Brief. GROUNDED: the model is given ONLY the deterministic facts
 * already computed by buildDailyBrief and told to phrase them - never to invent numbers
 * or give advice. Any failure / disabled mode returns ok:false so the client falls back
 * to the deterministic brief (which always renders).
 *
 * Provider/model dispatch lives in the AI Gateway (src/lib/ai/gateway.ts) - this route
 * just grounds the prompt and delegates. Bring-your-own-key: the key is sent from the
 * browser (where the user stored it) to this route, forwarded to the chosen provider,
 * never logged or persisted. Hosted mode is a placeholder until a central key is wired.
 */

interface BriefRequest {
  brief: DailyBrief;
  ai: { mode: 'off' | 'byo' | 'hosted'; provider: AiProvider; apiKey: string; model?: string };
  profile?: { experienceLevel?: string; learningStyle?: string; tradedBefore?: string };
}

const SYSTEM = [
  'You are Lyra, a research assistant for a stock momentum dashboard.',
  'You will be given a set of FACTS computed deterministically by the app.',
  'Write a 2-3 sentence brief in plain English that conveys those facts naturally.',
  'Rules: use ONLY the facts provided. Never invent or change a number. Never give buy/sell advice or price targets.',
  'This is research, not financial advice. Be concise, calm, and concrete.',
].join(' ');

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

    if (!brief || !ai || ai.mode === 'off') {
      return NextResponse.json({ ok: false, reason: 'disabled' });
    }
    if (ai.mode === 'hosted') {
      // Central key not wired yet - behave like off so the client keeps the deterministic brief.
      return NextResponse.json({ ok: false, reason: 'hosted_not_configured' });
    }
    if (ai.mode === 'byo' && !ai.apiKey) {
      return NextResponse.json({ ok: false, reason: 'no_key' });
    }

    const prompt = `${factsBlock(brief)}\n\nWrite the brief.${audience(profile)}`;
    const { text } = await complete({
      provider: ai.provider,
      apiKey: ai.apiKey,
      model: ai.model,
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
