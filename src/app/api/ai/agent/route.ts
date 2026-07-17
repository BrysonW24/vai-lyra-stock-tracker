import { NextRequest, NextResponse } from 'next/server';
import type { AiProvider } from '@/lib/ai/gateway';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { runResearchAnalyst } from '@/lib/ai/run-agent';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { chargeHostedBudgetShared } from '@/lib/ai/budget-tracker';
import { guardAiRoute } from '@/lib/api/ai-guard';

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
    const guard = await guardAiRoute<AgentRequest>(request);
    if (!guard.ok) return guard.response;
    const { agent, symbol, question, ai } = guard.body;
    if (!ai || !symbol) return NextResponse.json({ ok: false, reason: 'bad_request' });

    const creds = resolveAiCredentials(ai, { authenticated: guard.authenticated });
    if (!creds.apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    // Hosted/shared key rides the house budget (was skipped here - an agent run is the
    // heaviest AI path, multiple tool-augmented model calls, and it could burn the server
    // key uncapped). Charge more per run than a single chat turn.
    if (creds.source !== 'user') {
      const budget = await chargeHostedBudgetShared(creds.source, 1500);
      if (budget.decision === 'block') return NextResponse.json({ ok: false, reason: 'budget' });
    }

    if (question && detectInjectionAttempt(question)) {
      return NextResponse.json({ ok: false, reason: 'refused' });
    }

    if (agent === 'research_analyst') {
      const result = await runResearchAnalyst({ symbol, question, creds: { provider: creds.provider, apiKey: creds.apiKey, model: creds.model } });
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, reason: 'unknown_agent' });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
