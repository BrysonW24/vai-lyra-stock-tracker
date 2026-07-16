'use client';

import { useMemo, useState } from 'react';
import { buildTradePlan, renderTradePlanText, type TradePlanFlag } from '@/lib/edge/trade-plan';
import type { ExpectancyInput } from '@/lib/edge/expectancy';
import { formatCurrency } from '@/lib/format';

/**
 * The trade plan surface - the decision-moment version of the position-size calculator, sized
 * against the user's OWN capital. It floors to whole shares, models realistic small-account costs
 * (fixed commission + FX + liquidity-scaled slippage), nets expectancy against that friction, and
 * surfaces honest risk flags. Research only: it shows sizing and cost math, never a buy/sell call.
 * All math is the pure `buildTradePlan`, run live in the browser - no server round trip.
 */

export interface PlanSymbolContext {
  symbol: string;
  name?: string;
  close: number;
  status: string;
  liquidity?: number;
  lifecycleStage?: string;
  outcome: ExpectancyInput | null;
  provenance?: 'illustrative' | 'measured';
}

interface Props {
  symbols: PlanSymbolContext[];
  defaultAccountSize: number;
  baseCurrency: string;
  defaultMaxPositionPct: number;
  crossCurrencyDefault: boolean;
  hasCapitalOnFile: boolean;
}

const FLAG_META: Record<TradePlanFlag, { label: string; tone: 'danger' | 'warn' | 'info' }> = {
  'stop-missing': { label: 'No stop set', tone: 'warn' },
  'capital-too-small': { label: 'Priced out of reach for this account', tone: 'danger' },
  'exceeds-account': { label: 'Would require leverage', tone: 'danger' },
  'over-concentration': { label: 'Capped by the concentration limit', tone: 'info' },
  'cost-drag-high': { label: 'High round-trip friction', tone: 'warn' },
  'cost-exceeds-edge': { label: 'Costs wipe out the edge', tone: 'danger' },
  'negative-expectancy': { label: 'Negative expectancy', tone: 'danger' },
  'illiquid-for-size': { label: 'Thin liquidity', tone: 'warn' },
  'wide-stop': { label: 'Wide stop - large risk per share', tone: 'warn' },
  'lottery-tier': { label: 'Lottery-tier (concept stage)', tone: 'warn' },
};

const toneClass: Record<'danger' | 'warn' | 'info', string> = {
  danger: 'border-[#5c2530] bg-[#2a141a] text-[#f0758a]',
  warn: 'border-[#5c4a25] bg-[#2a2414] text-[#f3a33a]',
  info: 'border-[#25405c] bg-[#14202a] text-[#7fb0ff]',
};

const labelCls = 'text-[11px] uppercase tracking-[0.14em] text-[#8190a0]';
const inputCls = 'mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-sm text-[#eef3f8] focus:border-[#3a4c60] focus:outline-none';

export function TradePlanCard({ symbols, defaultAccountSize, baseCurrency, defaultMaxPositionPct, crossCurrencyDefault, hasCapitalOnFile }: Props) {
  const sorted = useMemo(() => [...symbols].sort((a, b) => a.symbol.localeCompare(b.symbol)), [symbols]);
  const [symbol, setSymbol] = useState(sorted[0]?.symbol ?? '');
  const ctx = useMemo(() => sorted.find((s) => s.symbol === symbol), [sorted, symbol]);

  const [entryPrice, setEntryPrice] = useState<number>(sorted[0]?.close ?? 0);
  const [stopPrice, setStopPrice] = useState<number | ''>('');
  const [targetPrice, setTargetPrice] = useState<number | ''>('');
  const [accountSize, setAccountSize] = useState<number>(defaultAccountSize);
  const [riskPct, setRiskPct] = useState<number>(1);
  const [maxPositionPct, setMaxPositionPct] = useState<number>(defaultMaxPositionPct);
  const [wholeShares, setWholeShares] = useState(true);
  const [crossCurrency, setCrossCurrency] = useState(crossCurrencyDefault);
  const [copied, setCopied] = useState(false);

  const onPickSymbol = (next: string) => {
    setSymbol(next);
    const nextCtx = sorted.find((s) => s.symbol === next);
    if (nextCtx?.close) {
      setEntryPrice(nextCtx.close);
      setStopPrice('');
      setTargetPrice('');
    }
  };

  const plan = useMemo(
    () =>
      buildTradePlan({
        symbol: symbol || 'SYMBOL',
        entryPrice: Number(entryPrice) || 0,
        stopPrice: stopPrice === '' ? undefined : Number(stopPrice),
        targetPrice: targetPrice === '' ? undefined : Number(targetPrice),
        accountSize: Number(accountSize) || 0,
        riskPercentPerTrade: Number(riskPct) || 0,
        maxPositionPct: Number(maxPositionPct) || 20,
        wholeSharesOnly: wholeShares,
        crossCurrency,
        liquidity: ctx?.liquidity,
        lifecycleStage: ctx?.lifecycleStage,
        outcome: ctx?.outcome ?? null,
        provenance: ctx?.provenance,
      }),
    [symbol, entryPrice, stopPrice, targetPrice, accountSize, riskPct, maxPositionPct, wholeShares, crossCurrency, ctx],
  );

  const cur = (n: number | null) => (n === null ? '-' : formatCurrency(n, baseCurrency));

  const copyTicket = async () => {
    try {
      await navigator.clipboard.writeText(renderTradePlanText(plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#eef3f8]">Trade Plan</h1>
        <p className="mt-1 text-xs text-[#8190a0]">
          Sizing, cost, and expectancy for one name against your real capital. Research only - this is math from your own
          numbers, never a recommendation to place a trade.
        </p>
      </div>

      {!hasCapitalOnFile && (
        <div className="rounded border border-[#25405c] bg-[#14202a] px-3 py-2 text-xs text-[#7fb0ff]">
          No account capital is on file, so this starts from a {formatCurrency(defaultAccountSize, baseCurrency)} example.
          Set your available cash in settings and the plan will size against your real balance.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Inputs */}
        <div className="terminal-panel overflow-hidden rounded-md">
          <div className="border-b border-[#1b2530] px-3 py-3 text-sm font-semibold text-[#eef3f8]">Your inputs</div>
          <div className="space-y-3 px-3 py-3">
            <div>
              <label className={labelCls}>Symbol</label>
              <select className={inputCls} value={symbol} onChange={(e) => onPickSymbol(e.target.value)}>
                {sorted.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol}
                    {s.name ? ` - ${s.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Entry</label>
                <input type="number" className={inputCls} value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Stop</label>
                <input type="number" className={inputCls} placeholder="none" value={stopPrice} onChange={(e) => setStopPrice(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Target</label>
                <input type="number" className={inputCls} placeholder="none" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Account</label>
                <input type="number" className={inputCls} value={accountSize} onChange={(e) => setAccountSize(Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Risk %</label>
                <input type="number" step="0.25" className={inputCls} value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Max pos %</label>
                <input type="number" className={inputCls} value={maxPositionPct} onChange={(e) => setMaxPositionPct(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-[#c3ccd6]">
                <input type="checkbox" checked={wholeShares} onChange={(e) => setWholeShares(e.target.checked)} />
                Whole shares only
              </label>
              <label className="flex items-center gap-2 text-xs text-[#c3ccd6]">
                <input type="checkbox" checked={crossCurrency} onChange={(e) => setCrossCurrency(e.target.checked)} />
                Cross-currency (FX cost)
              </label>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="terminal-panel overflow-hidden rounded-md">
          <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-3">
            <span className="text-sm font-semibold text-[#eef3f8]">Plan for {plan.symbol}</span>
            <button onClick={copyTicket} className="rounded border border-[#263241] px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-[#c3ccd6] hover:border-[#3a4c60]">
              {copied ? 'Copied' : 'Copy ticket'}
            </button>
          </div>
          <div className="space-y-2 px-3 py-3 font-mono text-sm text-[#eef3f8]">
            <Row label="Size" value={plan.shares > 0 ? `${plan.shares} sh = ${cur(plan.positionValue)} (${plan.positionPctOfAccount}%)` : 'below one whole share'} />
            <Row label="Risk budget" value={`${cur(plan.riskDollars)} (${plan.riskPercentPerTrade}%)`} />
            <Row label="Worst case (stop hit)" value={cur(plan.worstCaseLossDollars)} tone={plan.worstCaseLossDollars !== null ? 'danger' : undefined} />
            <Row label="Reward-to-risk" value={plan.rMultipleToTarget !== null ? `${plan.rMultipleToTarget}:1 (break-even win ${plan.breakEvenWinRatePct}%)` : '-'} />
            <div className="my-2 border-t border-[#1b2530]" />
            <Row label="Round-trip cost" value={`${cur(plan.cost.roundTripCost)} (${plan.cost.breakEvenMovePct}% to break even)`} tone={plan.cost.breakEvenMovePct > 2 ? 'warn' : undefined} />
            <Row label="  commission / fx / slip" value={`${cur(plan.cost.commission)} / ${cur(plan.cost.fx)} / ${cur(plan.cost.slippage)}`} muted />
            {plan.expectancy && (
              <>
                <div className="my-2 border-t border-[#1b2530]" />
                <Row
                  label={`Expectancy (${plan.provenance})`}
                  value={`${plan.expectancy.expectedValuePct}% gross · ${plan.expectancyNetPct}% net`}
                  tone={plan.expectancy.edge === 'negative' || (plan.expectancyNetPct ?? 0) <= 0 ? 'danger' : 'good'}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {plan.flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {plan.flags.map((f) => (
            <span key={f} className={`rounded border px-2 py-1 text-[11px] font-medium ${toneClass[FLAG_META[f].tone]}`}>
              {FLAG_META[f].label}
            </span>
          ))}
        </div>
      )}

      {plan.notes.length > 0 && (
        <ul className="space-y-1 rounded border border-[#1b2530] bg-[#0d141c] px-3 py-3 text-xs text-[#c3ccd6]">
          {plan.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[#8190a0]">-</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">
        Deterministic sizing and cost math - research only, not financial advice
      </p>
    </div>
  );
}

function Row({ label, value, tone, muted }: { label: string; value: string; tone?: 'danger' | 'good' | 'warn'; muted?: boolean }) {
  const valueColor =
    tone === 'danger' ? 'text-[#f0758a]' : tone === 'good' ? 'text-[#43d18b]' : tone === 'warn' ? 'text-[#f3a33a]' : muted ? 'text-[#8190a0]' : 'text-[#eef3f8]';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</span>
      <span className={`text-right ${valueColor}`}>{value}</span>
    </div>
  );
}
