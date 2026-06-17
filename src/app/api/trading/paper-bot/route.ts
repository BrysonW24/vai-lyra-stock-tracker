import { NextRequest, NextResponse } from 'next/server';
import type { AiProvider } from '@/lib/ai/gateway';
import { proposeBotRun, executeBotRun } from '@/lib/trading/paper-bot';
import type { OrderIntent } from '@/lib/trading/types';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dispatchNotificationEvent } from '@/lib/notifications/dispatch';
import { buildPaperOrderIntent } from '@/lib/trading/order-intent-builder';

interface PaperBotRequest {
  action: 'propose' | 'approve' | 'execute';
  symbol?: string;
  quantity?: number;
  intent?: OrderIntent;
  ai?: { provider: AiProvider; apiKey: string; model?: string };
  tour?: boolean;
}

async function dispatchPaperBotNotification(params: {
  action: 'propose' | 'execute';
  symbol?: string;
  run: Awaited<ReturnType<typeof proposeBotRun>> | Awaited<ReturnType<typeof executeBotRun>>;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  try {
    if (params.run.status === 'proposed' && params.run.intent) {
      await dispatchNotificationEvent(supabase, {
        userId: user.id,
        type: 'paper_approval_required',
        severity: 'high',
        title: `${params.run.intent.symbol} paper approval required`,
        body: `${params.run.intent.side.toUpperCase()} ${params.run.intent.quantity} ${params.run.intent.symbol} is waiting for approval.`,
        triggerReason: 'The deterministic paper-bot risk gate passed and manual approval is required.',
        symbol: params.run.intent.symbol,
        relatedEntityType: 'order_intent',
        relatedEntityId: params.run.intent.id,
        relevanceScore: 100,
        url: '/paper-bot',
        dedupeKey: `paper_approval_required:${params.run.intent.id}`,
        payload: { intent: params.run.intent, report: params.run.report },
      });
    } else if (params.run.status === 'blocked_by_risk' && params.run.intent) {
      await dispatchNotificationEvent(supabase, {
        userId: user.id,
        type: 'risk_blocked',
        severity: 'high',
        title: `${params.run.intent.symbol} blocked by risk gate`,
        body: 'The paper bot blocked the action. No trade executed.',
        triggerReason: 'The deterministic risk engine failed at least one pre-trade check.',
        symbol: params.run.intent.symbol,
        relatedEntityType: 'order_intent',
        relatedEntityId: params.run.intent.id,
        relevanceScore: 100,
        url: '/paper-bot',
        dedupeKey: `risk_blocked:${params.run.intent.id}:${Date.now()}`,
        payload: { intent: params.run.intent, report: params.run.report },
      });
    } else if (params.run.status === 'paper_executed' && params.run.fill) {
      await dispatchNotificationEvent(supabase, {
        userId: user.id,
        type: 'paper_fill',
        severity: 'medium',
        title: `${params.run.fill.symbol} paper fill`,
        body: `Paper filled ${params.run.fill.side.toUpperCase()} ${params.run.fill.quantity} ${params.run.fill.symbol} @ $${params.run.fill.fillPrice}.`,
        triggerReason: 'You approved the paper order and the simulator filled it.',
        symbol: params.run.fill.symbol,
        relatedEntityType: 'paper_fill',
        relatedEntityId: params.run.fill.sourceOrderIntentId,
        relevanceScore: 100,
        url: '/paper-bot',
        dedupeKey: `paper_fill:${params.run.fill.sourceOrderIntentId}:${params.run.fill.fillTimestamp}`,
        payload: { fill: params.run.fill, intent: params.run.intent, report: params.run.report },
      });
    }
  } catch (error) {
    console.warn('[paper-bot] notification dispatch failed:', error instanceof Error ? error.message : error);
  }
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
    const { action, symbol, quantity, intent, ai, tour } = body;

    if (action === 'propose') {
      if (tour) {
        const mockIntent = buildPaperOrderIntent({
          userId: 'local',
          symbol: symbol || 'AAPL',
          side: 'buy',
          quantity: quantity || 10,
          referencePrice: 150,
          signalSnapshot: { score: 100, status: 'optimal' },
          evidenceRefs: [],
          aiExplanation: 'Tour mode: Guaranteed to pass the AI evidence checks and risk gate.',
        });
        mockIntent.status = 'pending_approval';
        mockIntent.reasonCode = 'tour_mode';

        const run = {
          status: 'proposed' as const,
          verdict: { readiness: 'paper_trade_eligible', reasons: ['Tour mode: Perfect setup detected.', 'All risk checks overridden for onboarding.'], confidence: 0.99 },
          report: { passed: true, requiresApproval: true, blocking: [], warnings: [] },
          intent: mockIntent,
          requiresApproval: true
        };
        return NextResponse.json({ ok: true, ...run });
      }

      if (!ai || !symbol) return NextResponse.json({ ok: false, reason: 'bad_request' });
      const creds = resolveAiCredentials(ai);
      if (!creds.apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });
      const run = await proposeBotRun({ symbol, quantity: quantity && quantity > 0 ? quantity : 10, creds: { provider: creds.provider, apiKey: creds.apiKey, model: creds.model } });
      await dispatchPaperBotNotification({ action: 'propose', symbol, run });
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

      if (tour || intent.reasonCode === 'tour_mode') {
        const fill = {
          symbol: intent.symbol,
          side: intent.side,
          quantity: intent.quantity,
          fillPrice: 150,
          notional: intent.quantity * 150,
          simulatedFee: 0,
          simulatedSlippage: 0,
          fillTimestamp: new Date().toISOString(),
          sourceOrderIntentId: intent.id
        };
        const { recordPaperFill } = await import('@/lib/trading/paper-account-store');
        recordPaperFill(fill);
        const run = {
          status: 'paper_executed' as const,
          intent: { ...intent, status: 'paper_executed' as const },
          report: { passed: true, requiresApproval: true },
          fill
        };
        return NextResponse.json({ ok: true, ...run });
      }

      const run = await executeBotRun(intent);
      await dispatchPaperBotNotification({ action: 'execute', symbol: intent.symbol, run });
      return NextResponse.json({ ok: true, ...run });
    }

    return NextResponse.json({ ok: false, reason: 'unknown_action' });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
