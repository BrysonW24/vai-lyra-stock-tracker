/**
 * Deterministic pre-trade risk engine. Pure functions, no I/O, fully unit-tested.
 *
 * Every future order MUST pass this engine before approval or (eventual) execution.
 * The engine is intentionally conservative: unknown or missing context fails closed.
 * AI has no write path into this module - it can read a PreTradeReport to explain it,
 * nothing more. Live execution does not exist in this codebase; the only consumer
 * today is the paper-trading simulator and the Bot Readiness surface.
 */
import type {
  KillSwitchId,
  KillSwitchState,
  OrderIntent,
  PreTradeCheck,
  PreTradeContext,
  PreTradeReport,
} from './types';

export const ALL_KILL_SWITCHES: { id: KillSwitchId; label: string; description: string }[] = [
  { id: 'global', label: 'Global', description: 'Disables all trading activity platform-wide.' },
  { id: 'user', label: 'User', description: 'Disables all trading for this account.' },
  { id: 'strategy', label: 'Strategy', description: 'Disables a single strategy across all users.' },
  { id: 'broker', label: 'Broker', description: 'Disables a broker connection (outage, errors).' },
  { id: 'symbol', label: 'Symbol', description: 'Blocks new orders in a specific symbol.' },
  { id: 'theme', label: 'Theme', description: 'Blocks new orders in a whole theme.' },
  { id: 'daily_loss', label: 'Daily loss', description: 'Trips when the daily loss limit is hit.' },
  { id: 'error_rate', label: 'Error rate', description: 'Trips on elevated system error rates.' },
  { id: 'slippage', label: 'Slippage', description: 'Trips when realised slippage exceeds tolerance.' },
  { id: 'data_staleness', label: 'Data staleness', description: 'Trips when market data is stale.' },
  { id: 'ai_system', label: 'AI system', description: 'Disables the AI layer (it can never trade anyway).' },
];

function check(id: string, label: string, passed: boolean, severity: 'blocking' | 'warning', detail: string): PreTradeCheck {
  return { id, label, passed, severity, detail };
}

/** Evaluate every pre-trade gate for an intent. Fail-closed and side-effect free. */
export function runPreTradeChecks(intent: OrderIntent, ctx: PreTradeContext, now: Date = new Date()): PreTradeReport {
  const checks: PreTradeCheck[] = [];
  const s = ctx.settings;

  // 1. Trading enabled at all
  checks.push(
    check('trading_mode', 'Trading enabled', s.tradingMode !== 'disabled', 'blocking',
      s.tradingMode === 'disabled' ? 'Trading mode is disabled (the default).' : `Mode: ${s.tradingMode}.`),
  );

  // 2. Live modes are not implemented - anything beyond paper/approval is refused here too
  checks.push(
    check('no_live_execution', 'No live execution', s.tradingMode === 'disabled' || s.tradingMode === 'paper_only' || s.tradingMode === 'approval_required', 'blocking',
      'Live broker execution is not implemented in this build; only paper modes are accepted.'),
  );

  // 3. Kill switches
  const tripped = ctx.killSwitches.filter((k) => k.active);
  checks.push(
    check('kill_switches', 'Kill switches clear', tripped.length === 0, 'blocking',
      tripped.length === 0 ? 'No kill switches active.' : `Active: ${tripped.map((k) => `${k.id}${k.reason ? ` (${k.reason})` : ''}`).join(', ')}.`),
  );

  // 4. Strategy allowed
  checks.push(
    check('strategy_allowed', 'Strategy allow-listed', s.allowedStrategies.includes(intent.strategyId), 'blocking',
      s.allowedStrategies.includes(intent.strategyId) ? `${intent.strategyId} is allow-listed.` : `${intent.strategyId} is not in the user's allowed strategies.`),
  );

  // 5. Symbol / theme blocks
  checks.push(
    check('symbol_not_blocked', 'Symbol not blocked', !s.blockedSymbols.includes(intent.symbol), 'blocking',
      s.blockedSymbols.includes(intent.symbol) ? `${intent.symbol} is on the user's blocked list.` : `${intent.symbol} is not blocked.`),
  );
  checks.push(
    check('theme_not_blocked', 'Theme not blocked', !ctx.symbolTheme || !s.blockedThemes.includes(ctx.symbolTheme), 'blocking',
      ctx.symbolTheme && s.blockedThemes.includes(ctx.symbolTheme) ? `Theme ${ctx.symbolTheme} is blocked.` : 'Theme is not blocked.'),
  );

  // 6. Market + symbol state
  checks.push(check('market_open', 'Market open', ctx.marketOpen, 'blocking', ctx.marketOpen ? 'Market session is open.' : 'Market is closed.'));
  checks.push(check('symbol_tradable', 'Symbol tradable', ctx.symbolTradable, 'blocking', ctx.symbolTradable ? 'Symbol is tradable.' : 'Symbol is halted or not tradable.'));
  checks.push(check('broker_connected', 'Broker connected', ctx.brokerConnected, 'blocking', ctx.brokerConnected ? 'Broker (paper) connection healthy.' : 'No broker connection.'));

  // 7. Quote freshness - stale data fails closed
  const fresh = ctx.quoteAgeSeconds >= 0 && ctx.quoteAgeSeconds <= ctx.maxQuoteAgeSeconds;
  checks.push(
    check('quote_fresh', 'Quote fresh', fresh, 'blocking',
      fresh ? `Quote ${ctx.quoteAgeSeconds}s old (max ${ctx.maxQuoteAgeSeconds}s).` : `Quote is ${ctx.quoteAgeSeconds}s old - exceeds ${ctx.maxQuoteAgeSeconds}s.`),
  );

  // 8. Sizing limits
  checks.push(
    check('max_order_notional', 'Order notional within limit', intent.notionalValue > 0 && intent.notionalValue <= s.maxOrderNotional, 'blocking',
      `Order ${intent.notionalValue.toFixed(2)} vs max ${s.maxOrderNotional.toFixed(2)}.`),
  );
  const positionAfter = ctx.currentPositionValue + (intent.side === 'buy' ? intent.notionalValue : 0);
  const positionPctAfter = ctx.portfolioValue > 0 ? (positionAfter / ctx.portfolioValue) * 100 : 100;
  checks.push(
    check('max_position_pct', 'Position size within limit', positionPctAfter <= s.maxPositionPct, 'blocking',
      `Position would be ${positionPctAfter.toFixed(1)}% of book (max ${s.maxPositionPct}%).`),
  );

  // 9. Loss limits
  checks.push(
    check('max_daily_loss', 'Daily loss limit intact', s.maxDailyLoss <= 0 ? false : ctx.realisedDailyPnl > -s.maxDailyLoss, 'blocking',
      s.maxDailyLoss <= 0
        ? 'No daily loss limit configured - configure one before any execution.'
        : `Realised today ${ctx.realisedDailyPnl.toFixed(2)} vs limit -${s.maxDailyLoss.toFixed(2)}.`),
  );
  checks.push(
    check('max_drawdown', 'Drawdown limit intact', ctx.portfolioDrawdownPct < s.maxTotalDrawdownPct, 'blocking',
      `Drawdown ${ctx.portfolioDrawdownPct.toFixed(1)}% vs max ${s.maxTotalDrawdownPct}%.`),
  );

  // 10. Liquidity + spread
  checks.push(
    check('liquidity', 'Liquidity floor met', ctx.avgDailyDollarVolume >= ctx.minDollarVolume, 'blocking',
      `ADV $${Math.round(ctx.avgDailyDollarVolume).toLocaleString()} vs floor $${Math.round(ctx.minDollarVolume).toLocaleString()}.`),
  );
  checks.push(
    check('spread', 'Spread within tolerance', ctx.spreadPct <= ctx.maxSpreadPct, 'blocking',
      `Spread ${ctx.spreadPct.toFixed(2)}% vs max ${ctx.maxSpreadPct.toFixed(2)}%.`),
  );

  // 11. Event blackouts - warnings for paper, would be blocking for live
  checks.push(
    check('earnings_blackout', 'Outside earnings blackout', !ctx.earningsBlackout, 'warning',
      ctx.earningsBlackout ? 'Earnings within the blackout window.' : 'No earnings blackout.'),
  );
  checks.push(
    check('news_blackout', 'Outside news-risk blackout', !ctx.newsRiskBlackout, 'warning',
      ctx.newsRiskBlackout ? 'High-impact news risk flagged.' : 'No news-risk blackout.'),
  );

  // 12. Duplicates - idempotency
  const duplicate = ctx.openIntentKeys.includes(intent.idempotencyKey);
  checks.push(
    check('duplicate', 'No duplicate intent', !duplicate, 'blocking',
      duplicate ? 'An intent with this idempotency key is already open.' : 'Idempotency key is unique.'),
  );

  // 13. Sanity on the intent itself
  checks.push(
    check('intent_sane', 'Intent values sane',
      intent.quantity > 0 && Number.isFinite(intent.quantity) && Number.isFinite(intent.notionalValue), 'blocking',
      'Quantity and notional must be positive finite numbers.'),
  );

  const blocking = checks.filter((c) => !c.passed && c.severity === 'blocking');
  const warnings = checks.filter((c) => !c.passed && c.severity === 'warning');

  return {
    intentId: intent.id,
    passed: blocking.length === 0,
    requiresApproval: s.requireManualApproval,
    checks,
    blocking,
    warnings,
    evaluatedAt: now.toISOString(),
  };
}

/** A deterministic duplicate-prevention key: same strategy+symbol+side+day collapses. */
export function buildIdempotencyKey(strategyId: string, symbol: string, side: string, isoDay: string): string {
  return `${strategyId}:${symbol}:${side}:${isoDay}`.toLowerCase();
}

/** True when ANY platform-level switch would stop everything regardless of context. */
export function isHardKilled(switches: KillSwitchState[]): boolean {
  return switches.some((k) => k.active && (k.id === 'global' || k.id === 'user' || k.id === 'broker'));
}
