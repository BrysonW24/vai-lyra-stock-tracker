/**
 * Paper-bot route: the approval gate is a SERVER-SIGNED CAPABILITY, never client-supplied state.
 *
 * The audit hole was: POST { action:'execute', intent:{ status:'approved', ... } } reached a paper
 * fill because the route trusted the body's status. These tests drive the real route (with the engine
 * mocked) and prove: a fabricated approved/pending intent with no valid token is refused, a genuine
 * propose->approve->execute chain carries a valid capability, and one caller's capability cannot be
 * replayed by another. The refusal tests go RED against the old status-trusting route.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/ai-guard', () => ({ guardAiRoute: vi.fn() }));
vi.mock('@/lib/trading/paper-bot', () => ({ proposeBotRun: vi.fn(), executeBotRun: vi.fn() }));
vi.mock('@/lib/ai/credentials', () => ({ resolveAiCredentials: vi.fn(() => ({ provider: 'anthropic', apiKey: 'k', model: 'm' })) }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn(async () => null) }));
vi.mock('@/lib/notifications/dispatch', () => ({ dispatchNotificationEvent: vi.fn(async () => {}) }));

import { POST } from '../route';
import { guardAiRoute } from '@/lib/api/ai-guard';
import { proposeBotRun, executeBotRun } from '@/lib/trading/paper-bot';

const IDENTITY = 'ip:tester';
const req = () => new NextRequest('http://localhost/api/trading/paper-bot', { method: 'POST' });

function guardOnce(body: unknown, identity = IDENTITY, authenticated = false) {
  (guardAiRoute as unknown as Mock).mockResolvedValueOnce({ ok: true, body, authenticated, identity });
}
async function post(body: unknown, identity = IDENTITY): Promise<Record<string, unknown>> {
  guardOnce(body, identity);
  const res = await POST(req());
  return (await res.json()) as Record<string, unknown>;
}

const INTENT = {
  id: 'intent-xyz',
  userId: 'local',
  symbol: 'NVDA',
  side: 'buy',
  quantity: 10,
  notionalValue: 1000,
  status: 'pending_approval',
  reasonCode: 'signal',
  signalSnapshot: {},
  evidenceRefs: [],
};

beforeEach(() => {
  process.env.PAPER_BOT_INTENT_SECRET = 'route-test-secret';
  vi.clearAllMocks();
});

describe('paper-bot route approval gate (signed capability, not client state)', () => {
  it('execute REFUSES a fabricated approved intent with no valid token (the audit hole)', async () => {
    const forged = { ...INTENT, status: 'approved' };
    const json = await post({ action: 'execute', intent: forged, token: 'totally-made-up', tour: false });
    expect(json.ok).toBe(false);
    expect(json.reason).toBe('not_approved');
    expect(executeBotRun).not.toHaveBeenCalled();
  });

  it('approve REFUSES a fabricated pending intent with no valid token', async () => {
    const json = await post({ action: 'approve', intent: INTENT, token: 'nope', tour: false });
    expect(json.ok).toBe(false);
    expect(json.reason).toBe('not_pending');
  });

  it('a genuine propose -> approve -> execute chain carries a valid capability end to end', async () => {
    (proposeBotRun as unknown as Mock).mockResolvedValueOnce({ status: 'proposed', intent: INTENT, report: { passed: true, requiresApproval: true }, verdict: {}, requiresApproval: true });
    const proposed = await post({ action: 'propose', symbol: 'NVDA', quantity: 10, ai: { provider: 'anthropic', apiKey: 'k' }, tour: false });
    expect(proposed.ok).toBe(true);
    expect(typeof proposed.token).toBe('string');

    const approved = await post({ action: 'approve', intent: proposed.intent, token: proposed.token, tour: false });
    expect(approved.ok).toBe(true);
    expect((approved.intent as { status: string }).status).toBe('approved');
    expect(typeof approved.token).toBe('string');

    (executeBotRun as unknown as Mock).mockResolvedValueOnce({
      status: 'paper_executed',
      intent: { ...INTENT, status: 'paper_executed' },
      report: {},
      fill: { symbol: 'NVDA', side: 'buy', quantity: 10, fillPrice: 100, notional: 1000, simulatedFee: 3, simulatedSlippage: 1, fillTimestamp: 'now', sourceOrderIntentId: 'intent-xyz' },
    });
    const executed = await post({ action: 'execute', intent: approved.intent, token: approved.token, tour: false });
    expect(executed.ok).toBe(true);
    expect(executed.status).toBe('paper_executed');
    expect(executeBotRun).toHaveBeenCalledTimes(1);
  });

  it('an approved capability issued to caller A cannot be replayed by caller B', async () => {
    (proposeBotRun as unknown as Mock).mockResolvedValueOnce({ status: 'proposed', intent: INTENT, report: { passed: true, requiresApproval: true }, verdict: {}, requiresApproval: true });
    const proposed = await post({ action: 'propose', symbol: 'NVDA', quantity: 10, ai: { provider: 'anthropic', apiKey: 'k' }, tour: false }); // caller A (IDENTITY)
    const approved = await post({ action: 'approve', intent: proposed.intent, token: proposed.token, tour: false }); // caller A

    // caller B replays A's approved token
    const json = await post({ action: 'execute', intent: approved.intent, token: approved.token, tour: false }, 'user-B');
    expect(json.ok).toBe(false);
    expect(json.reason).toBe('not_approved');
    expect(executeBotRun).not.toHaveBeenCalled();
  });
});
