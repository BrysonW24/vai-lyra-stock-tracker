import { NextRequest, NextResponse } from 'next/server';
import type { DailyBrief } from '@/lib/daily-brief';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, LYRA_BRIEF_FORMAT, composeSystem } from '@/lib/ai/system-prompt';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { guardProse } from '@/lib/ai/guardrails/prose';
import { chargeHostedBudgetShared } from '@/lib/ai/budget-tracker';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { guardAiRoute } from '@/lib/api/ai-guard';

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

/**
 * The brief object is client-supplied (the deterministic brief is computed browser-side and
 * posted back for AI phrasing), so its text is untrusted - scan every field for prompt-injection
 * before it reaches the model. Returns true if anything looks like an injection attempt.
 */
function briefLooksInjected(brief: DailyBrief): boolean {
  const parts = [brief.headline, brief.regimeLabel, ...brief.lines.flatMap((l) => [l.label, l.text])];
  return parts.some((p) => typeof p === 'string' && detectInjectionAttempt(p));
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
    const guard = await guardAiRoute<BriefRequest>(request);
    if (!guard.ok) return guard.response;
    const { brief, ai, profile } = guard.body;

    if (!brief || !ai) {
      return NextResponse.json({ ok: false, reason: 'disabled' });
    }
    if (!Array.isArray(brief.lines) || briefLooksInjected(brief)) {
      // Untrusted client content tripped the injection screen - fall back to the deterministic brief.
      return NextResponse.json({ ok: false, reason: 'refused' });
    }
    const creds = resolveAiCredentials(ai, { authenticated: guard.authenticated, aiIncluded: guard.aiIncluded });
    if (!creds.apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    // Hosted/shared key rides the house budget; BYOK spends the user's own quota untouched. Shared
    // (Upstash) so the day ceiling holds cross-instance on Vercel, matching chat/agent (audit V5 fix -
    // this route used the per-lambda in-memory counter, decorative on serverless).
    if (creds.source !== 'user') {
      const budget = await chargeHostedBudgetShared(creds.source, 220);
      if (budget.decision === 'block') return NextResponse.json({ ok: false, reason: 'budget' });
    }

    const prompt = `${factsBlock(brief)}\n\nWrite the brief.${audience(profile)}`;
    const { text } = await complete({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      system: SYSTEM,
      prompt,
      maxTokens: 220,
      retryOn429: creds.source === 'user',
    });

    if (!text) return NextResponse.json({ ok: false, reason: 'empty' });

    // Output-side guardrails: the allow-set is the facts block the model was given. A weak
    // model inventing a figure or slipping into advice loses the sentence (or the whole
    // phrasing); ok:false sends the client back to the deterministic brief, which always renders.
    const guarded = guardProse(text, [prompt]);
    if (!guarded.ok) return NextResponse.json({ ok: false, reason: 'guardrail' });
    return NextResponse.json({ ok: true, text: guarded.text });
  } catch {
    // Never surface provider errors to the UI - the client falls back to deterministic.
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
