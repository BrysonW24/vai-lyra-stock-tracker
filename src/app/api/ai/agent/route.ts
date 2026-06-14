import { NextRequest, NextResponse } from 'next/server';
import type { AiProvider } from '@/lib/ai/gateway';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { runResearchAnalyst } from '@/lib/ai/run-agent';

interface AgentRequest {
  agent: 'research_analyst';
  symbol: string;
  question?: string;
  ai: { provider: AiProvider; apiKey: string; model?: string };
}

/**
 * Invoke a registered AI agent. The agent gathers evidence through the fail-closed tool runtime,
 * returns schema-validated structured output, and every run is audited. Currently exposes
 * research_analyst; trade_readiness (the paper-bot's verdict agent) plugs in here next.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequest;
    const { agent, symbol, question, ai } = body;
    if (!ai || !symbol) return NextResponse.json({ ok: false, reason: 'bad_request' });

    const userKey = ai.apiKey?.trim();
    const sharedKey = ai.provider === 'google' ? (process.env.GOOGLE_AI_KEY ?? '').trim() : '';
    const apiKey = userKey || sharedKey;
    if (!apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    if (question && detectInjectionAttempt(question)) {
      return NextResponse.json({ ok: false, reason: 'refused' });
    }

    if (agent === 'research_analyst') {
      const result = await runResearchAnalyst({ symbol, question, creds: { provider: ai.provider, apiKey, model: ai.model } });
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, reason: 'unknown_agent' });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
