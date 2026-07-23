'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import {
  loadLocalTradeLogs,
  undoLocalTradeLog,
  LOCAL_TRADE_ID_PREFIX,
  TRADES_CHANGED_EVENT,
} from '@/lib/local-trades';

interface TradeLog {
  id: string;
  symbol: string;
  side: string;
  notional_value: number;
  quantity_delta: number;
  fill_price: number;
  cash_delta: number;
  status: 'applied' | 'undone';
  source: string | null;
  created_at: string;
  undone_at: string | null;
}

/**
 * Persistent trade-log surface. The chat confirm-to-act flow logs buys and offers an inline undo,
 * but that lived only in the ephemeral chat bubble - once chat closed, a logged trade had no
 * reversal path. This reads user_trade_logs (RLS-scoped) newest-first and offers a durable Undo
 * per applied row, calling DELETE /api/trades (undo is reverse-chronological per symbol).
 */
export function TradeLogView() {
  const [logs, setLogs] = useState<TradeLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/trades');
      const data = await res.json();
      if (data.demo) {
        // Solo/demo deployment - the log lives in this browser (local-trades.ts), so read
        // it back instead of rendering a dead-end banner over an empty table.
        setDemo(true);
        setLogs(loadLocalTradeLogs());
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not load your trade log.');
        setLogs([]);
        return;
      }
      setLogs((data.logs as TradeLog[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your trade log.');
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    load();
    // Chat logs trades into the same local store - re-read when it changes.
    window.addEventListener(TRADES_CHANGED_EVENT, load);
    return () => window.removeEventListener(TRADES_CHANGED_EVENT, load);
  }, [load]);

  const undo = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        // Local rows undo locally - there is no server row to soft-delete.
        if (id.startsWith(LOCAL_TRADE_ID_PREFIX)) {
          const result = undoLocalTradeLog(id);
          if (!result.ok) setError(result.error || 'Undo failed.');
          setLogs(loadLocalTradeLogs());
          return;
        }
        const res = await fetch('/api/trades', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) setError(data.error || 'Undo failed.');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Undo failed.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (logs === null) {
    return <p className="text-[11px] text-white/40">Loading your trade log...</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">{error}</div>
      )}

      {demo && (
        <div className="rounded border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200">
          Solo mode - trades you log stay on this device. No account, nothing leaves this browser.
        </div>
      )}

      {logs.length === 0 && (
        <p className="text-[11px] text-white/40">
          No trades logged yet. Tell Lyra in chat, e.g. &ldquo;I bought $5,000 of NVDA&rdquo;, and it appears here with an undo.
        </p>
      )}

      {logs.length > 0 && (
        <div className="overflow-hidden rounded border border-white/5">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-white/[0.03] text-[9px] uppercase tracking-[0.12em] text-white/40">
                <th className="px-2.5 py-1.5 text-left font-medium">When</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Trade</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Cash out</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Fill</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Status</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Undo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const when = new Date(log.created_at);
                const applied = log.status === 'applied';
                return (
                  <tr key={log.id} className="border-t border-white/5">
                    <td className="px-2.5 py-1.5 align-top text-white/50">
                      {when.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}{' '}
                      {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-2.5 py-1.5 align-top">
                      <span className="font-mono font-semibold text-white/90">{log.side.toUpperCase()} {log.symbol}</span>
                      <span className="ml-1 text-white/40">
                        {Math.round(log.quantity_delta * 100) / 100} sh
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right align-top font-mono text-white/70">{formatCurrency(log.notional_value)}</td>
                    <td className="px-2.5 py-1.5 text-right align-top font-mono text-white/50">{formatCurrency(log.fill_price)}</td>
                    <td className="px-2.5 py-1.5 text-right align-top">
                      <span className={applied ? 'text-emerald-300/80' : 'text-white/35 line-through'}>{applied ? 'applied' : 'undone'}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right align-top">
                      {applied ? (
                        <button
                          type="button"
                          onClick={() => undo(log.id)}
                          disabled={busyId === log.id}
                          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-40"
                        >
                          {busyId === log.id ? '...' : 'Undo'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-white/20">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-white/30">
        Undo restores cash and your position. Trades must be undone in reverse order per symbol. Research and tracking only - not a brokerage.
      </p>
    </div>
  );
}
