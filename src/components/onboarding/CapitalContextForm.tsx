'use client';

import { useEffect } from 'react';
import { CapitalContext } from '@/lib/onboarding';
import { Toggle } from '@/components/Toggle';

interface CapitalContextFormProps {
  capital: CapitalContext;
  onChange: (capital: CapitalContext) => void;
  onNext: () => void;
}

const fmtMoney = (n?: number) => (n == null ? '' : n.toLocaleString('en-US'));
const parseMoney = (s: string): number | undefined => {
  const digits = s.replace(/[^\d]/g, '');
  return digits === '' ? undefined : Number(digits);
};

const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3';
const moneyInputClass =
  'h-8 w-full rounded-cell border border-line-strong bg-panel pl-6 pr-3 font-mono text-[13px] tabular-nums text-ink-title placeholder:text-ink-dim outline-none focus:border-accent/50';

/** Money input with a $ prefix and live thousands-separator formatting. */
function MoneyInput({ value, onChange, placeholder }: { value?: number; onChange: (v?: number) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-ink-dim">$</span>
      <input
        type="text"
        inputMode="numeric"
        className={moneyInputClass}
        placeholder={placeholder}
        value={fmtMoney(value)}
        onChange={(e) => onChange(parseMoney(e.target.value))}
      />
    </div>
  );
}

export function CapitalContextForm({ capital, onChange, onNext }: CapitalContextFormProps) {
  const handleChange = <K extends keyof CapitalContext>(key: K, value: CapitalContext[K]) => {
    onChange({ ...capital, [key]: value });
  };

  // Commit the AUD default on mount so an untouched select still persists a base currency (the
  // trade guard reads it). Without this, an unchanged select would leave it undefined -> stuck at USD.
  useEffect(() => {
    if (!capital.baseCurrency) onChange({ ...capital, baseCurrency: 'AUD' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-snug text-ink-2">Optional - these personalise your portfolio simulations.</p>

      {/* 2-up grid: fills the horizontal space and halves the vertical footprint. */}
      <div className="grid gap-2.5 md:grid-cols-2">
        <label className="grid content-start gap-1">
          <span className={labelClass}>
            Account currency <span className="font-normal lowercase tracking-normal text-ink-dim">· your cash is held in this</span>
          </span>
          <select
            className="h-8 rounded-cell border border-line-strong bg-panel px-3 text-[13px] text-ink-title outline-none focus:border-accent/50"
            value={capital.baseCurrency || 'AUD'}
            onChange={(e) => handleChange('baseCurrency', e.target.value)}
          >
            <option value="AUD">AUD - Australian dollar</option>
            <option value="USD">USD - US dollar</option>
            <option value="GBP">GBP - British pound</option>
            <option value="EUR">EUR - Euro</option>
            <option value="CAD">CAD - Canadian dollar</option>
            <option value="NZD">NZD - New Zealand dollar</option>
          </select>
        </label>

        <label className="grid content-start gap-1">
          <span className={labelClass}>Cash available</span>
          <MoneyInput value={capital.cashAvailable} onChange={(v) => handleChange('cashAvailable', v)} placeholder="50,000" />
        </label>

        <label className="grid content-start gap-1">
          <span className={labelClass}>Monthly contribution</span>
          <MoneyInput value={capital.monthlyContribution} onChange={(v) => handleChange('monthlyContribution', v)} placeholder="2,000" />
        </label>

        <div className="grid content-start gap-1">
          <span className={labelClass}>
            Max position size <span className="font-normal lowercase tracking-normal text-ink-dim">· most per stock</span>
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {[5, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                onClick={() => handleChange('maxPositionSizePct', pct)}
                type="button"
                className={`h-8 rounded-cell text-[13px] font-semibold transition ${
                  capital.maxPositionSizePct === pct
                    ? 'border border-accent bg-accent-tint/80 text-accent'
                    : 'border border-line-strong bg-panel text-ink-3 hover:border-line-hair'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <label className="grid content-start gap-1">
          <span className={labelClass}>Primary outcome</span>
          <select
            className="h-8 rounded-cell border border-line-strong bg-panel px-3 text-[13px] text-ink-title outline-none focus:border-accent/50"
            value={capital.primaryOutcome || ''}
            onChange={(e) => handleChange('primaryOutcome', e.target.value || undefined)}
          >
            <option value="">Select an outcome...</option>
            <option value="portfolio_growth">Portfolio growth</option>
            <option value="income_from_trading">Income from trading</option>
            <option value="dividend_income">Dividend income</option>
            <option value="capital_preservation">Capital preservation</option>
            <option value="learning_discipline">Learning &amp; discipline</option>
            <option value="high_growth_tech">High-growth tech exposure</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-cell border border-line-strong bg-panel">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">Enable portfolio simulations</p>
            <p className="truncate text-[11px] text-ink-3">Run what-if scenarios with trade amounts.</p>
          </div>
          <Toggle
            checked={Boolean(capital.simulationEnabled)}
            onChange={(v) => handleChange('simulationEnabled', v)}
            label="Enable portfolio simulations"
          />
        </div>

        {capital.simulationEnabled && (
          <label className="grid gap-1 border-t border-line px-3 py-2">
            <span className={labelClass}>Default trade amount</span>
            <MoneyInput value={capital.defaultTradeAmount} onChange={(v) => handleChange('defaultTradeAmount', v)} placeholder="2,000" />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
