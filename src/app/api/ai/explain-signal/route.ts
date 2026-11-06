import { NextRequest, NextResponse } from 'next/server';
import type { SignalRow } from '@/types/scanner';
import { type AiProvider } from '@/lib/ai/gateway';
import { answerWith } from '@/lib/ai/answer';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, composeSystem } from '@/lib/ai/system-prompt';
import { guardProse } from '@/lib/ai/guardrails/prose';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { guardAiRoute } from '@/lib/api/ai-guard';
import { buildLiveSignal } from '@/lib/live-signals';

/**
 * AI phrasing for ONE signal, for the SignalDrawer. Grounding is SERVER-OWNED: the
 * client sends only a symbol; the deterministic engine recomputes the signal here and
 * that facts block is both the prompt and the guardProse allow-set - so the model can
 * only restate numbers the drawer itself displays. Any failure returns ok:false and
 * the drawer stays purely deterministic (which always renders).
 */

interface ExplainSignalRequest {
  symbol: string;
  ai: { mode: 'free' | 'byo' | 'off' | 'hosted'; provider: AiProvider; apiKey: string; model?: string };
}

const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;

const SYSTEM = composeSystem([
  LYRA_IDENTITY,
  'You will be given FACTS about one stock signal, computed deterministically by the app. In 2-3 plain sentences, explain what this setup means for a researcher on the move. Restate only the given figures. Do not recommend any action.',
  LYRA_GUARDRAILS,
]);

function factsBlock(symbol: string, s: Partial<SignalRow>): string {
  const lines = [
    `Symbol: ${symbol}`,
    typeof s.score === 'number' ? `Oversold-recovery score: ${s.score}/100` : null,
    typeof s.status === 'string' ? `Signal status: ${s.status.replaceAll('_', ' ')}` : null,
    typeof s.rsi === 'number' ? `RSI: ${s.rsi.toFixed(1)}` : null,
    typeof s.macdHistogram === 'number' ? `MACD histogram: ${s.macdHistogram.toFixed(2)}` : null,
    typeof s.volumeRatio === 'number' ? `Volume vs average: ${s.volumeRatio.toFixed(2)}x` : null,
    typeof s.distanceFromLow === 'number' ? `Distance from 60-day low: ${s.distanceFromLow.toFixed(1)}%` : null,
    ...(s.explanation?.triggeredBecause ?? []).map((t) => `Triggered: ${t}`),
    ...(s.explanation?.missingConfirmation ?? []).map((t) => `Missing: ${t}`),
  ].filter(Boolean);
  return `Facts:\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAiRoute<ExplainSignalRequest>(request);
    if (!guard.ok) return guard.response;
    const { symbol: raw, ai } = guard.body;

    const symbol = typeof raw === 'string' ? raw.toUpperCase().trim() : '';
    if (!SYMBOL_RE.test(symbol) || !ai) {
      return NextResponse.json({ ok: false, reason: 'disabled' });
    }

    const creds = resolveAiCredentials(ai, { authenticated: guard.authenticated, aiIncluded: guard.aiIncluded, allowFreePool: true });
    if (creds.source === 'none') return NextResponse.json({ ok: false, reason: 'no_key' });

    // Deterministic engine recomputes the signal server-side - the client cannot
    // smuggle content into the grounding.
    const signal = await buildLiveSignal(symbol);
    if (!signal) return NextResponse.json({ ok: false, reason: 'unavailable' });

    // answerWith charges the fence that applies (house budget, or the free pool's caps) only once
    // there is a signal to explain - a symbol with no data costs nobody anything.
    const prompt = `${factsBlock(symbol, signal)}\n\nExplain this setup.`;
    const answer = await answerWith(creds, guard.identity, { system: SYSTEM, prompt, maxTokens: 160, budgetTokens: 160 });
    if (!answer.ok) return NextResponse.json({ ok: false, reason: answer.reason === 'empty_response' ? 'empty' : answer.reason });
    const { text } = answer;

    const guarded = guardProse(text, [prompt]);
    if (!guarded.ok) return NextResponse.json({ ok: false, reason: 'guardrail' });
    return NextResponse.json({ ok: true, text: guarded.text });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
