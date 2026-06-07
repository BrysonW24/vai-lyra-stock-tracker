'use client';

import { Bell, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AlertRow, SignalRow } from '@/types/scanner';
import { formatNumber, relativeTime, toneClass } from '@/lib/format';

interface AlertsTimelineProps {
  alerts: AlertRow[];
  signals: SignalRow[];
}

export function AlertsTimeline({ alerts, signals }: AlertsTimelineProps) {
  const [selected, setSelected] = useState<AlertRow | null>(alerts[0] ?? null);
  const signalMap = useMemo(() => new Map(signals.map((signal) => [signal.symbol, signal])), [signals]);
  const selectedSignal = selected ? signalMap.get(selected.symbol) : null;

  return (
    <section className="grid gap-3 xl:grid-cols-[1fr_380px]">
      <div className="terminal-panel overflow-hidden rounded-md">
        <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Alert history</p>
            <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Telegram, dashboard, skipped, and digest events.</p>
          </div>
          <Bell className="text-[#f3a33a]" size={18} />
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[980px] text-left text-xs">
            <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Alert Type</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Previous</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Message Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2530]">
              {alerts.map((alert) => (
                <tr
                  className="cursor-pointer font-mono text-[#dbe5ee] transition hover:bg-[#101720]"
                  key={`${alert.symbol}-${alert.createdAt}`}
                  onClick={() => setSelected(alert)}
                >
                  <td className="px-3 py-2">{relativeTime(alert.sentAt ?? alert.createdAt)}</td>
                  <td className="px-3 py-2 font-semibold text-[#eef3f8]">{alert.symbol}</td>
                  <td className="px-3 py-2">{alert.alertType.replaceAll('_', ' ')}</td>
                  <td className="px-3 py-2">{alert.score ?? 'n/a'}</td>
                  <td className="px-3 py-2">{alert.previousScore ?? 'n/a'}</td>
                  <td className="px-3 py-2">{alert.channel}</td>
                  <td className="px-3 py-2">
                    <span className={alert.sentStatus === 'sent' ? 'text-[#43d18b]' : 'text-[#f3a33a]'}>{alert.sentStatus}</span>
                  </td>
                  <td className="max-w-[360px] truncate px-3 py-2 text-[#8190a0]">{alert.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[#1b2530] md:hidden">
          {alerts.map((alert) => (
            <button
              type="button"
              className="block w-full px-3 py-3 text-left"
              key={`${alert.symbol}-${alert.createdAt}`}
              onClick={() => setSelected(alert)}
            >
              <div className="flex items-start justify-between gap-3 font-mono">
                <div>
                  <p className="font-semibold text-[#eef3f8]">{alert.symbol}</p>
                  <p className="text-xs text-[#8190a0]">{alert.alertType.replaceAll('_', ' ')} | {alert.channel}</p>
                </div>
                <span className={alert.sentStatus === 'sent' ? 'text-[#43d18b]' : 'text-[#f3a33a]'}>{alert.sentStatus}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#a8b5c2]">{alert.message}</p>
            </button>
          ))}
        </div>
      </div>

      <aside className="terminal-panel rounded-md p-3">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-semibold">{selected.symbol}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-[#8190a0]">{selected.alertType.replaceAll('_', ' ')}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#a8b5c2]">
                <Send size={15} />
                {selected.channel}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Full message</p>
              <p className="mt-2 text-sm leading-6 text-[#dbe5ee]">{selected.message}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Indicator snapshot</p>
              {selectedSignal ? (
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                  <span className="text-[#8190a0]">Score</span>
                  <span className="text-right text-[#dbe5ee]">{selectedSignal.score} <span className={toneClass(selectedSignal.scoreDelta)}>{selectedSignal.scoreDelta >= 0 ? '+' : ''}{selectedSignal.scoreDelta}</span></span>
                  <span className="text-[#8190a0]">RSI</span>
                  <span className="text-right text-[#dbe5ee]">{formatNumber(selectedSignal.rsi)}</span>
                  <span className="text-[#8190a0]">MACD Hist</span>
                  <span className="text-right text-[#dbe5ee]">{formatNumber(selectedSignal.macdHistogram, 2)}</span>
                  <span className="text-[#8190a0]">Volume</span>
                  <span className="text-right text-[#dbe5ee]">{formatNumber(selectedSignal.volumeRatio, 2)}x</span>
                  <span className="text-[#8190a0]">Action</span>
                  <span className="text-right text-[#f3a33a]">{selectedSignal.actionState.replaceAll('_', ' ')}</span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#8190a0]">No current snapshot in signal payload.</p>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Payload</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded border border-[#263241] bg-[#0b1016] p-3 text-xs text-[#a8b5c2]">
                {JSON.stringify(selected.payload ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#8190a0]">No alerts have been recorded yet.</p>
        )}
      </aside>
    </section>
  );
}
