import { NextResponse, type NextRequest } from 'next/server';
import { runPaperBotCommand } from '@/lib/trading/paper-bot-commands';
import type { AiCreds } from '@/lib/ai/run-agent';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { chargeHostedBudgetShared } from '@/lib/ai/budget-tracker';
import { guardAiRoute } from '@/lib/api/ai-guard';

export const dynamic = 'force-dynamic';

interface CommandBody {
  line?: unknown;
  ai?: AiCreds;
}

/**
 * Paper-bot CLI endpoint. POST { line, ai } -> runs one command through the same paper-only engine the
 * UI buttons use. No live path exists in the command allowlist. Guarded: rate-limited, size-capped,
 * and the pending-intent state is keyed by the guard's caller identity so it cannot bleed across users.
 */
export async function POST(req: NextRequest) {
  const guard = await guardAiRoute<CommandBody>(req, { scope: 'paper-bot' });
  if (!guard.ok) return guard.response;

  const line = typeof guard.body.line === 'string' ? guard.body.line : '';
  // Resolve the AI key the same way every AI route does; the server key only when authenticated.
  const resolved = resolveAiCredentials(guard.body.ai, { authenticated: guard.authenticated });

  // Hosted/shared key rides the house budget (the AI 'propose' command was uncapped here);
  // BYOK spends the user's own quota. A block short-circuits before the model call.
  if (resolved.source !== 'user' && resolved.apiKey) {
    const budget = await chargeHostedBudgetShared(resolved.source, 800);
    if (budget.decision === 'block') return NextResponse.json({ ok: false, reason: 'budget' });
  }

  const creds: AiCreds = { provider: resolved.provider, apiKey: resolved.apiKey, model: resolved.model };
  const result = await runPaperBotCommand(line, creds, guard.identity);
  return NextResponse.json(result);
}
