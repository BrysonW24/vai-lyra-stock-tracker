'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchUniverse } from '@/lib/universe';
import { TickerLogo } from '@/components/TickerLogo';

export function AddWatchRuleForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    symbol: '',
    targetPrice: '',
    targetSignalScore: '75',
    rsiMin: '35',
    rsiMax: '50',
    requireMacdHistogramRising: true,
    requireVolumeRatio: '0.8',
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

      if (!result.ok) {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to add watch rule',
        });
        return;
      }

      setStatus({
        type: 'success',
        message: `Watching ${formData.symbol}`,
      });

      // Reset form
      setFormData({
        symbol: '',
        targetPrice: '',
        targetSignalScore: '75',
        rsiMin: '35',
        rsiMax: '50',
        requireMacdHistogramRising: true,
        requireVolumeRatio: '0.8',
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
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Ticker</span>
        <div className="relative">
          <input
            className="h-9 w-full rounded border border-[#263241] bg-[#0d141c] pl-8 pr-2 font-mono text-sm text-[#dbe5ee] outline-none focus:border-[#f3a33a]/50 focus:ring-1 focus:ring-[#f3a33a]/30 transition-all"
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
            <Search size={12} className="text-[#4a5a6a]" />
          </div>
        </div>

        {/* Suggestion list */}
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#1e2d3d] bg-[#070b10] shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {suggestions.slice(0, 5).map((s, i) => (
              <button
                key={s.symbol}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s.symbol); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${i === activeIdx ? 'bg-[#0e1826]' : 'hover:bg-[#0b1520]'}`}
              >
                <TickerLogo symbol={s.symbol} companyName={s.name} size={20} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-[#eef3f8]">{s.symbol}</span>
                    <span className="truncate text-[9px] text-[#5e6b78]">{s.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Target price</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="$180"
          name="targetPrice"
          type="number"
          step="any"
          value={formData.targetPrice}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Target score</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="75"
          name="targetSignalScore"
          type="number"
          value={formData.targetSignalScore}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">RSI min</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="35"
          name="rsiMin"
          type="number"
          value={formData.rsiMin}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">RSI max</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="50"
          name="rsiMax"
          type="number"
          value={formData.rsiMax}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Volume ratio</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="0.8x"
          name="requireVolumeRatio"
          type="number"
          step="any"
          value={formData.requireVolumeRatio}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Custom alert note</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="Review add zone"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
        />
      </label>
      <label className="flex items-center justify-between rounded border border-[#263241] bg-[#0d141c] px-2 py-2 text-xs text-[#a8b5c2]">
        Require MACD histogram rising
        <input
          type="checkbox"
          name="requireMacdHistogramRising"
          checked={formData.requireMacdHistogramRising}
          onChange={handleChange}
        />
      </label>
      <button
        className="mt-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f3a33a] hover:bg-[#101720] disabled:opacity-50"
        type="submit"
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? 'Adding...' : 'Add watch rule'}
      </button>
      {status.message && (
        <p
          className={`mt-1 text-xs ${
            status.type === 'success' ? 'text-[#43d18b]' : status.type === 'error' ? 'text-[#ff6b6b]' : 'text-[#8190a0]'
          }`}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
