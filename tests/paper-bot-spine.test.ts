import { describe, it, expect } from 'vitest';
import { canAgentUseTool } from '@/lib/ai/policy';
import { executeTool, ToolDeniedError } from '@/lib/ai/tools/runtime';
import { buildPaperOrderIntent } from '@/lib/trading/order-intent-builder';
import { simulatePaperFill, requiresApproval } from '@/lib/trading/paper-bot';
import { runPreTradeChecks } from '@/lib/trading/risk-engine';
import { DEFAULT_TRADING_SETTINGS, type PreTradeContext, type TradingSettings } from '@/lib/trading/types';
import { PAPER_FEE_RATE, PAPER_SLIPPAGE_RATE } from '@/lib/paper-trading';

const paperSettings = (): TradingSettings => ({
  ...DEFAULT_TRADING_SETTINGS,
  userId: 't',
  tradingMode: 'approval_required',
  maxOrderNotional: 25000,
  maxPositionPct: 15,
  maxDailyLoss: 5000,
  requireManualApproval: true,
  allowedStrategies: ['lyra_paper_bot'],
});

const paperContext = (settings: TradingSettings): PreTradeContext => ({
  settings,
  killSwitches: [],
  marketOpen: true,
  symbolTradable: true,
  quoteAgeSeconds: 5,
  maxQuoteAgeSeconds: 120,
  portfolioValue: 100000,
  currentPositionValue: 0,
  realisedDailyPnl: 0,
  portfolioDrawdownPct: 0,
  avgDailyDollarVolume: 5e8,
  minDollarVolume: 1e6,
  spreadPct: 0.03,
  maxSpreadPct: 0.5,
  earningsBlackout: false,
  newsRiskBlackout: false,
  openIntentKeys: [],
  brokerConnected: true,
});

const sampleIntent = () =>
  buildPaperOrderIntent({
    userId: 't',
    symbol: 'NVDA',
    side: 'buy',
    quantity: 10,
    referencePrice: 200,
    signalSnapshot: { score: 60 },
    evidenceRefs: ['company:NVDA', 'theme:agi-infrastructure'],
    aiExplanation: 'strong momentum',
  });

describe('paper-bot spine - AI boundary', () => {
  it('no agent may use any order/mutation/settings tool', () => {
    for (const agent of ['research_analyst', 'risk_analyst', 'trade_readiness', 'alert_composer'] as const) {
      expect(canAgentUseTool(agent, 'create_order')).toBe(false);
      expect(canAgentUseTool(agent, 'modify_position')).toBe(false);
      expect(canAgentUseTool(agent, 'change_settings')).toBe(false);
    }
  });

  it('tool runtime is fail-closed: a denied (agent, tool) throws ToolDeniedError', async () => {
    const readTools = ['search_evidence', 'read_signals', 'read_portfolio_own', 'read_themes'] as const;
    const agents = ['research_analyst', 'risk_analyst', 'news_classifier', 'alert_composer', 'trade_readiness'] as const;
    let foundDenial = false;
    for (const a of agents) {
      for (const t of readTools) {
        if (!canAgentUseTool(a, t)) {
          await expect(executeTool(a, t)).rejects.toBeInstanceOf(ToolDeniedError);
          foundDenial = true;
        }
      }
    }
    // The least-privilege matrix must contain at least one denial, else it is not least-privilege.
    expect(foundDenial).toBe(true);
  });

  it('a granted read tool executes and returns data', async () => {
    const evidence = await executeTool('research_analyst', 'search_evidence', { query: 'agi infrastructure', limit: 3 });
    expect(Array.isArray(evidence)).toBe(true);
  });
});

describe('paper-bot spine - deterministic order + fill', () => {
  it('OrderIntent is built deterministically and starts drafted', () => {
    const intent = sampleIntent();
    expect(intent.status).toBe('drafted');
    expect(intent.side).toBe('buy');
    expect(intent.quantity).toBe(10);
    expect(intent.notionalValue).toBe(2000);
    expect(intent.strategyId).toBe('lyra_paper_bot');
    expect(intent.idempotencyKey).toContain('lyra_paper_bot');
  });

  it('paper fill applies slippage and commission, never touches a broker', () => {
    const intent = sampleIntent();
    const fill = simulatePaperFill(intent, 200);
    expect(fill.fillPrice).toBeCloseTo(200 * (1 + PAPER_SLIPPAGE_RATE), 2);
    expect(fill.simulatedFee).toBeCloseTo(fill.notional * PAPER_FEE_RATE, 2);
    expect(fill.quantity).toBe(10);
    expect(fill.sourceOrderIntentId).toBe(intent.id);
  });

  it('paper settings require manual approval', () => {
    expect(requiresApproval(sampleIntent(), paperSettings())).toBe(true);
  });
});

describe('paper-bot spine - risk gate', () => {
  it('blocks any live trading mode (no live execution in this build)', () => {
    const live = { ...paperSettings(), tradingMode: 'live_full' as const };
    const report = runPreTradeChecks(sampleIntent(), paperContext(live));
    expect(report.passed).toBe(false);
    expect(report.blocking.some((c) => c.id === 'no_live_execution')).toBe(true);
  });

  it('passes a valid paper intent in approval_required mode', () => {
    const report = runPreTradeChecks(sampleIntent(), paperContext(paperSettings()));
    expect(report.passed).toBe(true);
    expect(report.requiresApproval).toBe(true);
  });

  it('blocks when notional exceeds the max order notional', () => {
    const big = buildPaperOrderIntent({
      userId: 't', symbol: 'NVDA', side: 'buy', quantity: 1000, referencePrice: 200,
      signalSnapshot: { score: 60 }, evidenceRefs: ['company:NVDA'],
    });
    const report = runPreTradeChecks(big, paperContext(paperSettings()));
    expect(report.passed).toBe(false);
  });
});
