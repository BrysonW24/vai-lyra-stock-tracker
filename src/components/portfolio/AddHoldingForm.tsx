'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addLocalHolding } from '@/lib/local-portfolio';
import { Search } from 'lucide-react';
import { searchUniverse } from '@/lib/universe';
import { TickerLogo } from '@/components/TickerLogo';

export function AddHoldingForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    averageBuyPrice: '',
    brokerageFee: '',
    purchaseDate: '',
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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ type: 'loading' });

    try {
      const response = await fetch('/api/portfolio', {
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
        if (result.demo) {
          // Demo mode (no Supabase): persist locally so the holding shows in the book.
          const feeInput = parseFloat(formData.brokerageFee);
          const saved = addLocalHolding({
            symbol: formData.symbol,
            quantity: parseFloat(formData.quantity) || 1,
            averageBuyPrice: parseFloat(formData.averageBuyPrice) || 0,
            brokerageFee: Number.isFinite(feeInput) && feeInput > 0 ? feeInput : undefined,
            purchaseDate: formData.purchaseDate || undefined,
            notes: formData.notes || undefined,
          });
          if (!saved) {
            setStatus({
              type: 'error',
              message: 'Could not save on this device. Check browser storage permissions and try again.',
            });
            return;
          }
        } else {
          setStatus({
            type: 'error',
            message: result.error || 'Failed to add holding',
          });
          return;
        }
      }

      setStatus({
        type: 'success',
        message: `Added ${formData.symbol}`,
      });

      // Reset form
      setFormData({
        symbol: '',
        quantity: '',
        averageBuyPrice: '',
        brokerageFee: '',
        purchaseDate: '',
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
            className="h-8 w-full rounded-cell border border-line-strong bg-panel pl-8 pr-2 font-mono text-[13px] text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
            placeholder="Ticker"
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
                    <span className="font-mono text-[11px] font-bold text-ink">{s.symbol}</span>
                    <span className="truncate text-[9px] text-ink-dim">{s.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Quantity</span>
        <input
          className="h-8 rounded-cell border border-line-strong bg-panel px-2 font-mono text-[13px] text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
          placeholder="Quantity"
          name="quantity"
          type="number"
          step="any"
          value={formData.quantity}
          onChange={handleChange}
          required
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Average buy price</span>
        <input
          className="h-8 rounded-cell border border-line-strong bg-panel px-2 font-mono text-[13px] text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
          placeholder="Average buy price"
          name="averageBuyPrice"
          type="number"
          step="any"
          value={formData.averageBuyPrice}
          onChange={handleChange}
          required
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Brokerage / fees</span>
        <input
          className="h-8 rounded-cell border border-line-strong bg-panel px-2 font-mono text-[13px] text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
          placeholder="Brokerage / fees"
          name="brokerageFee"
          type="number"
          step="any"
          value={formData.brokerageFee}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Purchase date</span>
        <input
          className="h-8 rounded-cell border border-line-strong bg-panel px-2 font-mono text-[13px] text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
          placeholder="Purchase date"
          name="purchaseDate"
          type="date"
          value={formData.purchaseDate}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Notes</span>
        <input
          className="h-8 rounded-cell border border-line-strong bg-panel px-2 font-mono text-[13px] text-ink-title outline-none focus:border-blue-focus/50 focus:ring-1 focus:ring-blue-focus/30 transition-all"
          placeholder="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
        />
      </label>
      <button
        className="mt-1 rounded-cell border border-accent-border bg-accent-tint px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:brightness-110 disabled:opacity-50"
        type="submit"
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? 'Adding...' : 'Add holding'}
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
