'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ChevronDown, Sparkles } from 'lucide-react';
import {
  getStrategyById,
  getStrategyList,
  type Strategy,
  type StrategyRule,
} from '@/lib/strategy';
import { formatNumber } from '@/lib/format';
import { gradientSelectedStyle } from '@/lib/gradient';

export interface StrategyValue {
  strategyId: string;
  overrides: StrategyOverrides;
}

export interface StrategyOverrides {
  rsiMin?: number;
  rsiMax?: number;
  volumeRatioMin?: number;
  macdHistoricalTrigger?: boolean;
  priceVsSmaCondition?: 'above' | 'below' | 'near';
  distanceFromLowMax?: number;
  // Plain-English operating profile (drives the recommendation).
  activity?: string;
  risk?: string;
  approach?: string;
  growth?: string;
  [key: string]: unknown;
}

interface StrategyPickerProps {
  value: StrategyValue;
  onChange: (value: StrategyValue) => void;
  onNext?: () => void;
}

// Keyed by the strategy's actual display NAME (strat.name). 'Oversold Recovery' is the flagship
// preset's real name - it was briefly 'Momentum Recovery', which left this lookup falling back
// to the raw description for the most-recommended strategy.
const PLAIN_SUMMARY: Record<string, string> = {
  'Oversold Recovery': 'A beaten-down stock that is starting to turn back up - catch the early bounce.',
  'Oversold Bounce': 'A stock that has been sold off hard and may snap back sharply.',
  'Trend Continuation': 'A stock already climbing steadily that looks likely to keep going.',
  'Breakout Watch': 'A stock coiling quietly near a key level that could break out soon.',
  'Overextended Risk': 'A stock that has run too hot and may be due for a pullback - a caution flag.',
  'Earnings Caution': 'Looks strong, but earnings are near - wait until the dust settles.',
  'High Hype / Low Confirmation': 'Lots of buzz, but the numbers do not back it up yet - be patient.',
};

const SUITABILITY: Record<string, { label: string; cls: string }> = {
  low: { label: 'Beginner-friendly', cls: 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]' },
  medium: { label: 'Balanced', cls: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]' },
  high: { label: 'For active traders', cls: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]' },
};

const RISK_LABEL: Record<string, string> = { low: 'lower risk', medium: 'medium risk', high: 'higher risk' };

// Plain operating-profile questions (no jargon). Answers drive the recommendation.
interface ProfileQuestion {
  key: 'activity' | 'risk' | 'approach' | 'growth';
  prompt: string;
  options: { value: string; label: string }[];
}

const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    key: 'activity',
    prompt: 'How active do you want to be?',
    options: [
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Around monthly' },
      { value: 'few', label: 'A few trades a year' },
    ],
  },
  {
    key: 'risk',
    prompt: 'Your risk appetite?',
    options: [
      { value: 'cautious', label: 'Cautious' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'aggressive', label: 'Aggressive' },
    ],
  },
  {
    key: 'approach',
    prompt: 'Which approach fits you best?',
    options: [
      { value: 'compound', label: 'Cost-average & compound (slow, steady)' },
      { value: 'waves', label: 'Ride momentum waves' },
      { value: 'day', label: 'Active day trading' },
    ],
  },
  {
    key: 'growth',
    prompt: 'What growth are you targeting?',
    options: [
      { value: 'steady', label: 'Steady (about the market)' },
      { value: 'moderate', label: 'Moderate (beat the market)' },
      { value: 'high', label: 'High (aggressive growth)' },
    ],
  },
];

/**
 * Map the plain profile answers to a recommended strategy ID. Match by ID, never display
 * name: the flagship preset was renamed 'Momentum Recovery' -> 'Oversold Recovery' and the
 * old name-based lookup silently returned nothing, so the whole 'waves'/default path
 * recommended no strategy. IDs are stable; names are copy.
 */
function recommendStrategyId(o: StrategyOverrides): string {
  if (o.approach === 'day' || o.risk === 'aggressive' || o.growth === 'high') return 'breakout-watch';
  if (o.approach === 'compound' || o.risk === 'cautious' || o.growth === 'steady') return 'trend-continuation';
  return 'momentum-recovery';
}

export function StrategyPicker({ value, onChange, onNext }: StrategyPickerProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const list = getStrategyList();
  const selectedStrategy = getStrategyById(value.strategyId);

  if (!selectedStrategy) {
    return <div className="text-[#8190a0]">Strategy not found</div>;
  }

  const answeredProfile = PROFILE_QUESTIONS.filter((q) => Boolean(value.overrides[q.key])).length;
  const profileComplete = answeredProfile === PROFILE_QUESTIONS.length;

  // Gradient throughline: sample the Lyra brand gradient across every option pill
  // in the step so the SELECTED pills form one continuous blue->orange sweep.
  const profileOffsets: number[] = [];
  let profileAcc = 0;
  for (const q of PROFILE_QUESTIONS) {
    profileOffsets.push(profileAcc);
    profileAcc += q.options.length;
  }
  const profileTotal = profileAcc;

  const handleProfileChange = (key: ProfileQuestion['key'], val: string) => {
    const overrides = { ...value.overrides, [key]: val };
    const recId = recommendStrategyId(overrides);
    const rec = list.find((s) => s.id === recId);
    onChange({ strategyId: rec?.id ?? value.strategyId, overrides });
  };

  const handlePickSpecific = (strategyId: string) => {
    onChange({ ...value, strategyId });
  };

  const handleOverrideChange = (k: keyof StrategyOverrides, v: unknown) => {
    onChange({ ...value, overrides: { ...value.overrides, [k]: v } });
  };

  const activeSummary = buildRuleSummary(selectedStrategy, value.overrides);

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[#a8b5c2]">
        <TrendingUp className="mt-px shrink-0 text-[#60a5fa]" size={14} />
        <span>Tell us how you operate and Lyra tunes what it watches for - plain questions, no jargon. Change it anytime. (Research software, not advice.)</span>
      </p>

      {/* Plain operating-profile questions */}
      <div className="space-y-2">
        {PROFILE_QUESTIONS.map((q, qi) => {
          const current = value.overrides[q.key] as string | undefined;
          return (
            <div key={q.key}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">{q.prompt}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o, oi) => {
                  const sel = current === o.value;
                  const t = profileTotal > 1 ? (profileOffsets[qi] + oi) / (profileTotal - 1) : 0;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => handleProfileChange(q.key, o.value)}
                      aria-pressed={sel}
                      style={sel ? gradientSelectedStyle(t) : undefined}
                      className={`rounded-md border px-2.5 py-1 text-[12px] leading-tight transition ${
                        sel
                          ? ''
                          : 'border-[#263241] bg-[#0d141c] text-[#cdd8e3] hover:border-[#3a4754] hover:text-[#eef3f8]'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendation derived from the answers */}
      <section className={`rounded-lg border p-3 ${profileComplete ? 'border-[#f3a33a]/60 bg-[#1a130a]' : 'border-[#1b2530] bg-[#0b1016]'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#f3a33a]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
              {profileComplete ? 'Recommended for you' : 'Your match so far'}
            </span>
          </span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${SUITABILITY[selectedStrategy.riskLevel]?.cls ?? 'border-[#263241] text-[#8190a0]'}`}>
            {SUITABILITY[selectedStrategy.riskLevel]?.label ?? selectedStrategy.riskLevel}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-[#eef3f8]">{selectedStrategy.name}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{PLAIN_SUMMARY[selectedStrategy.name] ?? selectedStrategy.description}</p>
        {!profileComplete && (
          <p className="mt-1.5 text-[10px] text-[#8190a0]">Answer the questions above to lock in your best-fit strategy.</p>
        )}
      </section>

      {/* Advanced: pick a specific strategy + fine-tune rules */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between rounded-md border border-[#263241] bg-[#0d141c] px-3 py-2 text-left hover:bg-[#101720]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">
            Advanced - pick a specific strategy &amp; fine-tune (optional)
          </span>
          <ChevronDown size={14} className={`text-[#8190a0] transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="space-y-4 rounded-md border border-[#1b2530] bg-[#0b1016] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((strat) => {
                const sel = value.strategyId === strat.id;
                return (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => handlePickSpecific(strat.id)}
                    className={`rounded-md border p-3 text-left transition ${
                      sel ? 'border-[#f3a33a] bg-[#23180b]' : 'border-[#263241] bg-[#0d141c] hover:border-[#3a4754]'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${sel ? 'text-[#f3a33a]' : 'text-[#eef3f8]'}`}>{strat.name}</p>
                    <p className="mt-1 text-[11px] leading-4 text-[#a8b5c2]">{PLAIN_SUMMARY[strat.name] ?? strat.description}</p>
                    <p className="mt-1.5 font-mono text-[10px] text-[#8190a0]">
                      {strat.winRate}% win (illustrative) · {RISK_LABEL[strat.riskLevel] ?? strat.riskLevel}
                    </p>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">What it looks for</p>
              <p className="mt-1 font-mono text-sm text-[#dbe5ee]">{activeSummary}</p>
            </div>
            {renderThresholdControls(selectedStrategy, value.overrides, handleOverrideChange)}

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['Win rate', `${selectedStrategy.backtestStats.winRate}%`, 'text-[#43d18b]'],
                ['Avg return', `${formatNumber(selectedStrategy.backtestStats.avgReturn, 1)}%`, selectedStrategy.backtestStats.avgReturn >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'],
                ['Max drawdown', `${selectedStrategy.backtestStats.maxDrawdown}%`, 'text-[#ff6b6b]'],
              ].map(([label, val, tone]) => (
                <div key={label} className="rounded-md border border-[#263241] bg-[#0d141c] p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{label}</p>
                  <p className={`mt-1 font-mono text-sm font-semibold ${tone}`}>{val} <span className="text-[10px] text-[#8190a0]">illustrative</span></p>
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-4 text-[#8190a0]">
              These figures are illustrative reference numbers, not a measured track record - no live
              backtest has run yet. Treat them as what the strategy is aiming at, not proof of what it returns.
            </p>
          </div>
        )}
      </section>

      {onNext && (
        <button
          onClick={onNext}
          type="button"
          className="w-full rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#07090c] shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
        >
          Next: Watchlist
        </button>
      )}
    </div>
  );
}

function buildRuleSummary(strategy: Strategy, overrides: StrategyOverrides): string {
  const parts: string[] = [];

  const rsiRule = strategy.rules.find((r) => r.field === 'rsi');
  if (rsiRule && rsiRule.operator === 'between' && Array.isArray(rsiRule.value)) {
    const min = overrides.rsiMin ?? rsiRule.value[0];
    const max = overrides.rsiMax ?? rsiRule.value[1];
    parts.push(`RSI ${min}-${max}`);
  }

  const volRule = strategy.rules.find((r) => r.field === 'volumeRatio');
  if (volRule) {
    const minVol = overrides.volumeRatioMin !== undefined ? overrides.volumeRatioMin : volRule.operator === 'gte' ? (volRule.value as number) : 0;
    parts.push(`Vol >= ${minVol}x`);
  }

  const histRule = strategy.rules.find((r) => r.field === 'histDelta');
  if (histRule) {
    if (histRule.operator === 'gt' && histRule.value === 0) parts.push('MACD rising');
    else if (histRule.operator === 'lt' && histRule.value === 0) parts.push('MACD falling');
  }

  const priceVsMaRule = strategy.rules.find((r) => r.field === 'priceVsSma200');
  if (priceVsMaRule) {
    if (priceVsMaRule.operator === 'gt') parts.push('above 200MA');
    else if (priceVsMaRule.operator === 'lt') parts.push('below 200MA');
  }

  const distRule = strategy.rules.find((r) => r.field === 'distanceFromLow');
  if (distRule && distRule.operator === 'lte') {
    const maxDist = overrides.distanceFromLowMax ?? (distRule.value as number);
    parts.push(`within ${(maxDist * 100).toFixed(0)}% of low`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'No active rules';
}

/**
 * Number entry that behaves the way people expect: you can clear it and type
 * freely, leading zeros are stripped live ("025" -> "25"), and the value is
 * clamped to range on commit. Avoids the controlled-number-input quirk where a
 * stray leading zero sticks because the parsed value did not change.
 */
function NumberField({
  value,
  onCommit,
  min,
  max,
  step,
  className,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const decimal = Boolean(step && step < 1);
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(String(value)), [value]);

  const commit = (text: string) => {
    if (text === '' || text === '.') return;
    const n = decimal ? parseFloat(text) : parseInt(text, 10);
    if (Number.isNaN(n)) return;
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onCommit(v);
  };

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={raw}
      onChange={(e) => {
        let v = e.target.value;
        if (!/^\d*\.?\d*$/.test(v)) return; // digits + optional single dot only
        v = v.replace(/^0+(?=\d)/, ''); // strip leading zeros, keep "0" and "0."
        setRaw(v);
        commit(v);
      }}
      onBlur={() => {
        if (raw === '' || raw === '.' || Number.isNaN(decimal ? parseFloat(raw) : parseInt(raw, 10))) {
          setRaw(String(value));
        }
      }}
      className={className}
    />
  );
}

function renderThresholdControls(
  strategy: Strategy,
  overrides: StrategyOverrides,
  onChange: (key: keyof StrategyOverrides, val: unknown) => void,
): React.ReactNode {
  const rsiRule = strategy.rules.find((r) => r.field === 'rsi');
  const volRule = strategy.rules.find((r) => r.field === 'volumeRatio');
  const distRule = strategy.rules.find((r) => r.field === 'distanceFromLow');

  const controls: React.ReactNode[] = [];

  if (rsiRule && rsiRule.operator === 'between' && Array.isArray(rsiRule.value)) {
    const bounds = rsiRule.value as number[];
    const min = (overrides.rsiMin as number) ?? bounds[0];
    const max = (overrides.rsiMax as number) ?? bounds[1];
    controls.push(
      <div key="rsi" className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#8190a0]">RSI range (momentum, 0-100)</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField value={min} min={0} max={100} onCommit={(v) => onChange('rsiMin', v)} className="w-full rounded border border-[#263241] bg-[#080a0d] px-2 py-1 font-mono text-xs text-[#eef3f8]" />
          <NumberField value={max} min={0} max={100} onCommit={(v) => onChange('rsiMax', v)} className="w-full rounded border border-[#263241] bg-[#080a0d] px-2 py-1 font-mono text-xs text-[#eef3f8]" />
        </div>
      </div>,
    );
  }

  if (volRule) {
    const defaultVal = volRule.operator === 'gte' ? (volRule.value as number) : 0.8;
    const val = (overrides.volumeRatioMin as number) ?? defaultVal;
    controls.push(
      <div key="volume" className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Volume vs average</label>
        <NumberField value={val} min={0.5} max={2} step={0.1} onCommit={(v) => onChange('volumeRatioMin', v)} className="w-full rounded border border-[#263241] bg-[#080a0d] px-2 py-1 font-mono text-xs text-[#eef3f8]" />
        <p className="text-[10px] text-[#8190a0]">{formatNumber(val, 2)}x of normal volume</p>
      </div>,
    );
  }

  if (distRule && distRule.operator === 'lte') {
    const val = (overrides.distanceFromLowMax as number) ?? (distRule.value as number);
    controls.push(
      <div key="distance" className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#8190a0]">How close to its recent low (%)</label>
        <NumberField value={Math.round(val * 100)} min={0} max={50} onCommit={(v) => onChange('distanceFromLowMax', v / 100)} className="w-full rounded border border-[#263241] bg-[#080a0d] px-2 py-1 font-mono text-xs text-[#eef3f8]" />
        <p className="text-[10px] text-[#8190a0]">within {(val * 100).toFixed(0)}% of its recent low</p>
      </div>,
    );
  }

  return controls.length > 0 ? <div className="space-y-3">{controls}</div> : <p className="text-xs text-[#8190a0]">No adjustable rules for this strategy.</p>;
}

export type { StrategyRule };
