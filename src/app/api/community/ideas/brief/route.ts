import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, composeSystem } from '@/lib/ai/system-prompt';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { guardProse } from '@/lib/ai/guardrails/prose';
import { chargeHostedBudget } from '@/lib/ai/budget-tracker';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { guardAiRoute } from '@/lib/api/ai-guard';
import { cacheGet, cacheSet } from '@/lib/cache';

/**
 * AI-grounded brief for a SCOUT idea card. The template description on a scout card
 * explains the mechanics ("recurred across N items from M sources"); this route phrases
 * what the evidence collectively SAYS - grounded strictly in the evidence headlines the
 * card already carries, guarded by guardProse, and cached so one generation serves all
 * users. Every failure path returns ok:false and the client keeps the deterministic
 * template - the card never depends on AI.
 *
 * The evidence is read server-side from the card row (never client-supplied), and only
 * scout-origin cards qualify: human ideas have no evidence to ground on.
 */

interface ScoutBriefRequest {
  ideaId: string;
  ai: { mode: 'free' | 'byo' | 'off' | 'hosted'; provider: AiProvider; apiKey: string; model?: string };
}

interface EvidenceRow {
  title?: string;
  sourceName?: string;
  sourceId?: string;
  publishedAt?: string | null;
}

const SYSTEM = composeSystem([
  LYRA_IDENTITY,
  'You will be given the headlines of several independent news items that all mention the same emerging entity or theme. In 2-4 plain sentences, say what these reports collectively suggest is happening. Only use facts present in the headlines - never add numbers, company names, or events they do not contain. This is research context, never investment advice.',
  LYRA_GUARDRAILS,
]);

const CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Stable content hash so a card whose evidence refreshed gets a fresh brief. */
function evidenceKey(rows: EvidenceRow[]): string {
  let h = 5381;
  const text = rows.map((r) => r.title ?? '').join('|');
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAiRoute<ScoutBriefRequest>(request, { scope: 'scout_brief', capacity: 6 });
    if (!guard.ok) return guard.response;
    const { ideaId, ai } = guard.body;
    if (!ideaId || typeof ideaId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ ok: false, reason: 'demo' });

    // Ground on the card's own server-side row - the client only names the id.
    const { data: idea, error } = await supabase
      .from('community_ideas')
      .select('id, title, origin, evidence, confidence')
      .eq('id', ideaId)
      .maybeSingle();
    if (error || !idea || idea.origin !== 'scout') {
      return NextResponse.json({ ok: false, reason: 'not_scout' });
    }
    const evidence = (Array.isArray(idea.evidence) ? idea.evidence : []) as EvidenceRow[];
    if (evidence.length === 0) return NextResponse.json({ ok: false, reason: 'no_evidence' });

    // Evidence titles are external news text - screen them before they reach the model.
    if ([idea.title as string, ...evidence.map((e) => e.title ?? '')].some((t) => detectInjectionAttempt(t))) {
      return NextResponse.json({ ok: false, reason: 'refused' });
    }

    // One generation serves every viewer until the evidence itself refreshes.
    const cacheKey = `scout-brief:${idea.id}:${evidenceKey(evidence)}`;
    const cachedText = await cacheGet<string>(cacheKey);
    if (cachedText) return NextResponse.json({ ok: true, text: cachedText, cached: true });

    const creds = resolveAiCredentials(ai, { authenticated: guard.authenticated });
    if (!creds.apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });
    if (creds.source !== 'user') {
      const budget = chargeHostedBudget(creds.source, 200);
      if (budget.decision === 'block') return NextResponse.json({ ok: false, reason: 'budget' });
    }

    const lines = evidence
      .map((e) => `- ${e.title ?? ''}${e.sourceName ? ` (${e.sourceName}${e.publishedAt ? `, ${String(e.publishedAt).slice(0, 10)}` : ''})` : ''}`)
      .join('\n');
    const prompt = `Card: ${idea.title}\nIndependent reports:\n${lines}\n\nWrite the 2-4 sentence read.`;

    const { text } = await complete({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      system: SYSTEM,
      prompt,
      maxTokens: 200,
      retryOn429: creds.source === 'user',
    });
    if (!text) return NextResponse.json({ ok: false, reason: 'empty' });

    // Output guard: the allow-set is the prompt itself - invented figures or advice lose
    // the sentence or the whole brief, and the client falls back to the template.
    const guarded = guardProse(text, [prompt]);
    if (!guarded.ok) return NextResponse.json({ ok: false, reason: 'guardrail' });

    await cacheSet(cacheKey, guarded.text, CACHE_TTL_SECONDS);
    return NextResponse.json({ ok: true, text: guarded.text });
  } catch {
    // Provider errors never surface - the deterministic template always renders.
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
