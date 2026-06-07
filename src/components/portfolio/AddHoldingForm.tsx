'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
        setStatus({
          type: 'error',
          message: result.error || 'Failed to add holding',
        });
        return;
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
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Ticker</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="Ticker"
          name="symbol"
          value={formData.symbol}
          onChange={handleChange}
          required
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Quantity</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
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
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Average buy price</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
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
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Brokerage / fees</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="Brokerage / fees"
          name="brokerageFee"
          type="number"
          step="any"
          value={formData.brokerageFee}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Purchase date</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="Purchase date"
          name="purchaseDate"
          type="date"
          value={formData.purchaseDate}
          onChange={handleChange}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Notes</span>
        <input
          className="h-9 rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-sm text-[#dbe5ee] outline-none"
          placeholder="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
        />
      </label>
      <button
        className="mt-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f3a33a] hover:bg-[#101720] disabled:opacity-50"
        type="submit"
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? 'Adding...' : 'Add holding'}
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
