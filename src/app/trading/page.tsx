/**
 * Bot Readiness page (future-trading surface). Server-side it builds a demo NVDA
 * paper OrderIntent, runs it through the REAL deterministic pre-trade risk engine
 * with DEFAULT_TRADING_SETTINGS (trading disabled, no limits configured), and
 * renders the genuinely failing report. No execution path exists anywhere here -
 * the page exists to show the engine refusing a trade, honestly.
 */
import { AppShell } from '@/components/AppShell';
import { TradingReadiness } from '@/components/trading/TradingReadiness';
import { getDashboardData } from '@/lib/data';
import { ALL_KILL_SWITCHES, buildIdempotencyKey, runPreTradeChecks } from '@/lib/trading/risk-engine';
import { DEFAULT_TRADING_SETTINGS } from '@/lib/trading/types';
import type { KillSwitchState, OrderIntent, PreTradeContext } from '@/lib/trading/types';

export default async function TradingPage() {
  const data = await getDashboardData();

  const now = new Date();
  const isoDay = now.toISOString().slice(0, 10);
  const strategyId = 'momentum_recovery';
  const symbol = 'NVDA';
  const side = 'buy' as const;

  // Demo paper intent - drafted by deterministic strategy logic, never by AI.
  const intent: OrderIntent = {
    id: `demo-${strategyId}-${symbol.toLowerCase()}-${isoDay}`,
    userId: 'demo-user',
    strategyId,
    strategyVersion: '1.0.0',
    symbol,
    side,
    orderType: 'limit',
    quantity: 10,
    notionalValue: 1850,
    limitPrice: 185,
    timeInForce: 'day',
    reasonCode: 'momentum_recovery_entry',
    signalSnapshot: { rsi: 41.2, macdHistogram: 0.61, score: 78, volumeRatio: 1.8 },
    riskSnapshot: { atrPct: 3.1, stopDistancePct: 4.0, positionPctAfter: 3.7 },
    evidenceSnapshot: [
      'RSI recovered from oversold with rising slope',
      'MACD histogram turned positive on the hourly',
      'Volume 1.8x the 20-day average',
    ],
    status: 'drafted',
    idempotencyKey: buildIdempotencyKey(strategyId, symbol, side, isoDay),
    createdAt: now.toISOString(),
  };

  // Default settings: trading disabled, zero notional limit, no daily loss limit.
  // The engine must refuse this intent - that refusal is the whole demo.
  const killSwitches: KillSwitchState[] = ALL_KILL_SWITCHES.map((sw) => ({ id: sw.id, active: false }));
  const ctx: PreTradeContext = {
    settings: { userId: 'demo-user', ...DEFAULT_TRADING_SETTINGS },
    killSwitches,
    marketOpen: true,
    symbolTradable: true,
    quoteAgeSeconds: 4,
    maxQuoteAgeSeconds: 30,
    portfolioValue: 50000,
    currentPositionValue: 0,
    realisedDailyPnl: 0,
    portfolioDrawdownPct: 2.4,
    avgDailyDollarVolume: 38_000_000_000,
    minDollarVolume: 5_000_000,
    spreadPct: 0.02,
    maxSpreadPct: 0.5,
    earningsBlackout: false,
    newsRiskBlackout: false,
    openIntentKeys: [],
    brokerConnected: false,
    symbolTheme: 'ai-semiconductors',
  };

  const report = runPreTradeChecks(intent, ctx, now);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <TradingReadiness
          demoIntent={{
            symbol: intent.symbol,
            side: intent.side,
            orderType: intent.orderType,
            quantity: intent.quantity,
            notionalValue: intent.notionalValue,
            strategyId: intent.strategyId,
            reasonCode: intent.reasonCode,
          }}
          killSwitches={ALL_KILL_SWITCHES}
          report={report}
        />

        <p className="text-[10px] text-[#6f7d8a]">
          Research only - not financial advice. No live trading exists in this product; the pre-trade engine
          output above is a deterministic demonstration, not an order.
        </p>
      </div>
    </AppShell>
  );
}
