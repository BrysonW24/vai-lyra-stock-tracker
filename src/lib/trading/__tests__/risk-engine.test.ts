import { describe, expect, it } from 'vitest';
import { buildIdempotencyKey, isHardKilled, runPreTradeChecks } from '../risk-engine';
import type { OrderIntent, PreTradeContext, TradingSettings } from '../types';

function intent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    id: 'oi-test-1',
    userId: 'user-1',
    strategyId: 'momentum_recovery_v1',
    strategyVersion: '1.0.0',
    symbol: 'NVDA',
    side: 'buy',
    orderType: 'limit',
    quantity: 10,
    notionalValue: 2000,
    limitPrice: 200,
    timeInForce: 'day',
    reasonCode: 'momentum_recovery_entry',
    signalSnapshot: { score: 84 },
    riskSnapshot: { rsi: 43 },
    evidenceSnapshot: ['signal:NVDA:2026-06-11'],
    status: 'drafted',
    idempotencyKey: buildIdempotencyKey('momentum_recovery_v1', 'NVDA', 'buy', '2026-06-11'),
    createdAt: '2026-06-11T00:00:00.000Z',
    ...overrides,
  };
}

function settings(overrides: Partial<TradingSettings> = {}): TradingSettings {
  return {
    userId: 'user-1',
    tradingMode: 'paper_only',
    maxOrderNotional: 5000,
    maxPositionPct: 10,
    maxDailyLoss: 500,
    maxTotalDrawdownPct: 15,
    requireManualApproval: true,
    allowedStrategies: ['momentum_recovery_v1'],
    blockedSymbols: [],
    blockedThemes: [],
    ...overrides,
  };
}

function ctx(overrides: Partial<PreTradeContext> = {}): PreTradeContext {
  return {
    settings: settings(),
    killSwitches: [],
    marketOpen: true,
    symbolTradable: true,
    quoteAgeSeconds: 5,
    maxQuoteAgeSeconds: 60,
    portfolioValue: 100_000,
    currentPositionValue: 1000,
    realisedDailyPnl: 0,
    portfolioDrawdownPct: 2,
    avgDailyDollarVolume: 50_000_000,
    minDollarVolume: 1_000_000,
    spreadPct: 0.05,
    maxSpreadPct: 0.5,
    earningsBlackout: false,
    newsRiskBlackout: false,
    openIntentKeys: [],
    brokerConnected: true,
    ...overrides,
  };
}

describe('runPreTradeChecks', () => {
  it('passes a sane paper intent and still requires approval', () => {
    const report = runPreTradeChecks(intent(), ctx());
    expect(report.passed).toBe(true);
    expect(report.requiresApproval).toBe(true);
    expect(report.blocking).toHaveLength(0);
  });

  it('blocks when trading mode is disabled (the default)', () => {
    const report = runPreTradeChecks(intent(), ctx({ settings: settings({ tradingMode: 'disabled' }) }));
    expect(report.passed).toBe(false);
    expect(report.blocking.map((c) => c.id)).toContain('trading_mode');
  });

  it('refuses live modes - live execution does not exist in this build', () => {
    const report = runPreTradeChecks(intent(), ctx({ settings: settings({ tradingMode: 'live_full' }) }));
    expect(report.passed).toBe(false);
    expect(report.blocking.map((c) => c.id)).toContain('no_live_execution');
  });

  it('blocks on any active kill switch', () => {
    const report = runPreTradeChecks(
      intent(),
      ctx({ killSwitches: [{ id: 'global', active: true, reason: 'incident' }] }),
    );
    expect(report.passed).toBe(false);
    expect(report.blocking.map((c) => c.id)).toContain('kill_switches');
  });

  it('blocks strategies that are not allow-listed', () => {
    const report = runPreTradeChecks(intent({ strategyId: 'unlisted_v9' }), ctx());
    expect(report.blocking.map((c) => c.id)).toContain('strategy_allowed');
  });

  it('blocks blocked symbols and blocked themes', () => {
    const bySymbol = runPreTradeChecks(intent(), ctx({ settings: settings({ blockedSymbols: ['NVDA'] }) }));
    expect(bySymbol.blocking.map((c) => c.id)).toContain('symbol_not_blocked');
    const byTheme = runPreTradeChecks(
      intent(),
      ctx({ symbolTheme: 'agi-infrastructure', settings: settings({ blockedThemes: ['agi-infrastructure'] }) }),
    );
    expect(byTheme.blocking.map((c) => c.id)).toContain('theme_not_blocked');
  });

  it('fails closed on stale quotes', () => {
    const report = runPreTradeChecks(intent(), ctx({ quoteAgeSeconds: 300 }));
    expect(report.blocking.map((c) => c.id)).toContain('quote_fresh');
  });

  it('enforces notional and position-size limits', () => {
    const notional = runPreTradeChecks(intent({ notionalValue: 50_000 }), ctx());
    expect(notional.blocking.map((c) => c.id)).toContain('max_order_notional');
    const position = runPreTradeChecks(intent({ notionalValue: 4000 }), ctx({ currentPositionValue: 9000 }));
    expect(position.blocking.map((c) => c.id)).toContain('max_position_pct');
  });

  it('blocks when no daily loss limit is configured, and when it is breached', () => {
    const unconfigured = runPreTradeChecks(intent(), ctx({ settings: settings({ maxDailyLoss: 0 }) }));
    expect(unconfigured.blocking.map((c) => c.id)).toContain('max_daily_loss');
    const breached = runPreTradeChecks(intent(), ctx({ realisedDailyPnl: -600 }));
    expect(breached.blocking.map((c) => c.id)).toContain('max_daily_loss');
  });

  it('blocks duplicates via idempotency keys', () => {
    const i = intent();
    const report = runPreTradeChecks(i, ctx({ openIntentKeys: [i.idempotencyKey] }));
    expect(report.blocking.map((c) => c.id)).toContain('duplicate');
  });

  it('treats earnings/news blackouts as warnings, not blocks, in paper mode', () => {
    const report = runPreTradeChecks(intent(), ctx({ earningsBlackout: true, newsRiskBlackout: true }));
    expect(report.passed).toBe(true);
    expect(report.warnings.map((c) => c.id)).toEqual(expect.arrayContaining(['earnings_blackout', 'news_blackout']));
  });

  it('blocks insane quantities', () => {
    const report = runPreTradeChecks(intent({ quantity: 0 }), ctx());
    expect(report.blocking.map((c) => c.id)).toContain('intent_sane');
  });
});

describe('helpers', () => {
  it('builds deterministic idempotency keys', () => {
    expect(buildIdempotencyKey('S', 'NVDA', 'BUY', '2026-06-11')).toBe('s:nvda:buy:2026-06-11');
  });

  it('isHardKilled trips on platform-level switches only', () => {
    expect(isHardKilled([{ id: 'global', active: true }])).toBe(true);
    expect(isHardKilled([{ id: 'slippage', active: true }])).toBe(false);
    expect(isHardKilled([])).toBe(false);
  });
});
