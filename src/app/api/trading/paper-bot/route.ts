import { NextRequest, NextResponse } from 'next/server';
import type { AiProvider } from '@/lib/ai/gateway';
import { proposeBotRun, executeBotRun } from '@/lib/trading/paper-bot';
import type { OrderIntent } from '@/lib/trading/types';

interface PaperBotRequest {
  action: 'propose' | 'approve' | 'execute';
  symbol?: string;
  quantity?: number;
  intent?: OrderIntent;
  ai?: { provider: AiProvider; apiKey: string; model?: string };
}

/**
 * Paper-bot lifecycle endpoint - PAPER ONLY, no broker, no live path.
 *   propose : signal -> trade_readiness verdict -> deterministic OrderIntent -> risk gate
 *   approve : the approval gate - a pending_approval intent becomes approved (explicit user action)
 *   execute : an APPROVED intent only -> risk re-check at execution -> simulated paper fill
 * Any attempt to execute a non-approved intent is rejected: AI can never reach a fill.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PaperBotRequest;
    const { action, symbol, quantity, intent, ai } = body;

    if (action === 'propose') {
      if (!ai || !symbol) return NextResponse.json({ ok: false, reason: 'bad_request' });
      const userKey = ai.apiKey?.trim();
      const sharedKey = ai.provider === 'google' ? (process.env.GOOGLE_AI_KEY ?? '').trim() : '';
      const apiKey = userKey || sharedKey;
      if (!apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });
      const run = await proposeBotRun({ symbol, quantity: quantity && quantity > 0 ? quantity : 10, creds: { provider: ai.provider, apiKey, model: ai.model } });
      return NextResponse.json({ ok: true, ...run });
    }

    if (action === 'approve') {
      if (!intent) return NextResponse.json({ ok: false, reason: 'no_intent' });
      if (intent.status !== 'pending_approval') {
        return NextResponse.json({ ok: false, reason: 'not_pending', intentStatus: intent.status });
      }
      return NextResponse.json({ ok: true, status: 'approved', intent: { ...intent, status: 'approved' } });
    }

    if (action === 'execute') {
      if (!intent) return NextResponse.json({ ok: false, reason: 'no_intent' });
      // Approval gate: only an explicitly approved intent may execute. Blocks AI / unapproved paths.
      if (intent.status !== 'approved') {
        return NextResponse.json({ ok: false, reason: 'not_approved', intentStatus: intent.status });
      }
      const run = await executeBotRun(intent);
      return NextResponse.json({ ok: true, ...run });
    }

    return NextResponse.json({ ok: false, reason: 'unknown_action' });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
