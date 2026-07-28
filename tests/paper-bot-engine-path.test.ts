import { describe, it, expect, vi } from 'vitest';
import { demoDashboardData } from '@/lib/demo-data';

/**
 * 2026-07-27 audit V13: the paper-bot ROUTE test mocks the engine, so the deterministic
 * propose -> approve -> execute happy path (buildPaperOrderIntent -> risk gate -> simulatePaperFill)
 * was never pinned end to end. This drives the REAL engine.
 *
 * Two things are stubbed, and only two - both by design NOT on the deterministic path:
 *  - runTradeReadiness: the AI verdict (the one non-deterministic external; the intent is built
 *    deterministically regardless of what it says, so we stub it 'paper_trade_eligible' to reach fill).
 *  - getDashboardData: the data SOURCE, stubbed to the bundled demo dashboard so the test is hermetic
 *    (no live Yahoo fetch). The engine under test - intent builder, risk checks, fill - runs un-mocked.
 */
vi.mock('@/lib/ai/run-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/run-agent')>();
  return {
    ...actual,
    runTradeReadiness: vi.fn(async () => ({
      ok: true,
      result: {
        readiness: 'paper_trade_eligible',
        reasons: ['RSI in the reset band, MACD histogram improving'],
        citations: ['signal:TEST'],
      },
      evidenceIds: ['signal:TEST'],
    })),
  };
});

vi.mock('@/lib/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data')>();
  return { ...actual, getDashboardData: vi.fn(async () => demoDashboardData) };
});

import { proposeBotRun, executeBotRun } from '@/lib/trading/paper-bot';
import type { AiCreds } from '@/lib/ai/run-agent';

describe('paper bot engine path (un-mocked propose -> approve -> execute)', () => {
  it('builds a deterministic buy intent, passes the risk gate, and fills on paper with real costs', async () => {
    // Cheapest demo name at quantity 1 -> a tiny notional that reliably clears the position/notional caps.
    const cheapest = [...demoDashboardData.signals].sort((a, b) => a.close - b.close)[0];
    const symbol = cheapest.symbol;
    const creds = { source: 'none' } as unknown as AiCreds;

    const proposal = await proposeBotRun({ symbol, quantity: 1, creds, owner: 'engine-path-test' });

    expect(proposal.status).toBe('proposed');
    expect(proposal.intent).toBeDefined();
    // The intent is deterministic - AI is not on this path.
    expect(proposal.intent?.side).toBe('buy');
    expect(proposal.intent?.quantity).toBe(1);
    expect(proposal.intent?.symbol).toBe(symbol.toUpperCase());
    expect(proposal.report?.passed).toBe(true);

    const approved = { ...proposal.intent!, status: 'approved' as const };
    const filled = await executeBotRun(approved, 'engine-path-test');

    expect(filled.status).toBe('paper_executed');
    expect(filled.fill).toBeDefined();
    expect(filled.fill?.symbol).toBe(symbol.toUpperCase());
    expect(filled.fill?.side).toBe('buy');
    expect(filled.fill?.quantity).toBe(1);
    // The fill is never flattered: a real (floored) commission is applied.
    expect(filled.fill?.simulatedFee).toBeGreaterThan(0);
    // Fill price reflects slippage off the reference (buys fill at or above reference).
    expect(filled.fill?.fillPrice).toBeGreaterThanOrEqual(cheapest.close);
  });
});
