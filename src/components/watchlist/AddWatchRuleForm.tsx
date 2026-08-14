'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchUniverse } from '@/lib/universe';
import { addLocalWatchItem } from '@/lib/local-watchlist';
import { TickerLogo } from '@/components/TickerLogo';

export function AddWatchRuleForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    symbol: '',
    targetPrice: '',
    // 60 = a genuine strong setup. A bare rule fires on the score, not on every scan; the
    // user can raise it or add a target price below. (0 used to mean "trigger always".)
    targetSignalScore: '60',
    rsiMin: '0',
    rsiMax: '100',
    requireMacdHistogramRising: false,
    requireVolumeRatio: '0.0',
    notes: '',
  });
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({
    type: 'idle',
  });
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const query = formData.symbol.trim().toUpperCase();
  const suggestions = useMemo(() => searchUniverse(query), [query]);
  const showSuggestions = focused && query.length > 0 && suggestions.length > 0;

  function pickSuggestion(sym: string) {
    const upper = sym.toUpperCase();
    setFormData((prev) => ({ ...prev, symbol: upper }));
    setFocused(false);
    setActiveIdx(-1);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ type: 'loading' });

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = (await response.json()) as {
        ok: boolean;
        demo?: boolean;
        error?: string;
      };

      // Solo/demo deployments (no Supabase) answer {ok:false, demo:true}. That is not an
      // error - it means "no server to save to", so the item goes to the browser's local
      // watchlist instead of being silently dropped (the onboarding flow already did this;
      // this form was the surface that forgot - items entered here evaporated).
      if (!result.ok && result.demo) {
        const saved = addLocalWatchItem({
          symbol: formData.symbol,
          targetBuyPrice: Number(formData.targetPrice) || undefined,
          // Persist the user's threshold - dropping it made the trigger board narrate a
          // "your 70 target" the user never set (2026-08-11 audit finding).
          targetSignalScore: Number(formData.targetSignalScore) || undefined,
          notes: formData.notes || undefined,
        });
        if (!saved) {
          setStatus({
            type: 'error',
            message: 'Could not save on this device. Check browser storage permissions and try again.',
          });
          return;
        }
        setStatus({
          type: 'success',
          message: `Watching ${formData.symbol} - saved on this device`,
        });
      } else if (!result.ok) {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to add watch rule',
        });
        return;
      } else {
        setStatus({
          type: 'success',
          message: `Watching ${formData.symbol}`,
        });
      }

      // Reset form (back to the same stated default the form opens with)
      setFormData({
        symbol: '',
        targetPrice: '',
        targetSignalScore: '60',
        rsiMin: '0',
        rsiMax: '100',
        requireMacdHistogramRising: false,
        requireVolumeRatio: '0.0',
        notes: '',
      });

      // Refresh data
      router.refresh();

      // Clear success message after 2 seconds
      setTimeout(() => {
        setStatus({ type: 'idle' });
      }, 2000);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-2">
      <label className="grid gap-1 relative">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Ticker</span>
        <div className="relative">
          <input
            className="h-9 w-full rounded-cell border border-line-strong bg-panel pl-8 pr-2 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
            placeholder="Start typing - e.g. AMD"
            name="symbol"
            autoComplete="off"
            value={formData.symbol}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }));
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && showSuggestions) { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
              else if (e.key === 'ArrowUp' && showSuggestions) { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
              else if (e.key === 'Enter' && showSuggestions && activeIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIdx].symbol); }
              else if (e.key === 'Escape') setFocused(false);
            }}
            required
          />
          <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            <Search size={12} className="text-ink-dim" />
          </div>
        </div>

        {/* Suggestion list */}
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-panel border border-line-strong bg-well shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {suggestions.slice(0, 5).map((s, i) => (
              <button
                key={s.symbol}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s.symbol); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${i === activeIdx ? 'bg-blue-tint' : 'hover:bg-panel'}`}
              >
                <TickerLogo symbol={s.symbol} companyName={s.name} size={20} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-ink">{s.symbol}</span>
                    <span className="truncate text-[9px] text-ink-dim">{s.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </label>
      
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Custom alert note</span>
        <input
          className="h-9 rounded-cell border border-line-strong bg-panel px-2.5 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
          placeholder="Review add zone"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
        />
      </label>

      {/* Trigger thresholds - what turns this rule from 'watching' into 'triggered'. Both
          optional: leave them and the rule fires when the score reaches 60 (a strong setup). */}
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Buy under ($)</span>
          <input
            className="h-9 rounded-cell border border-line-strong bg-panel px-2.5 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
            placeholder="optional"
            name="targetPrice"
            inputMode="decimal"
            value={formData.targetPrice}
            onChange={handleChange}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Signal score ≥</span>
          <input
            className="h-9 rounded-cell border border-line-strong bg-panel px-2.5 font-mono text-sm text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
            placeholder="60"
            name="targetSignalScore"
            inputMode="numeric"
            value={formData.targetSignalScore}
            onChange={handleChange}
          />
        </label>
      </div>
      <p className="text-[10px] leading-relaxed text-ink-dim">
        Triggers when the signal score reaches your threshold{formData.targetPrice ? ' and price is at/under your buy level' : ''}. Leave as-is to fire on a strong setup (60+).
      </p>

      <button
        className="mt-1 rounded-cell border border-accent-border bg-accent-tint px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:brightness-110 disabled:opacity-50"
        type="submit"
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? 'Adding...' : 'Add watch rule'}
      </button>
      {status.message && (
        <p
          className={`mt-1 text-xs ${
            status.type === 'success' ? 'text-positive' : status.type === 'error' ? 'text-negative' : 'text-ink-3'
          }`}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
