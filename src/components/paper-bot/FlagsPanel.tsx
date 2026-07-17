'use client';

import { Bell, BellRing, BellOff, BadgePercent } from 'lucide-react';
import type { Flag } from './paper-bot-types';

const FLAG_DOT: Record<string, string> = {
  action: 'bg-[#f3a33a]',
  good: 'bg-[#43d18b]',
  warn: 'bg-[#ff8a5c]',
  info: 'bg-[#8190a0]',
};

interface FlagsPanelProps {
  flags: Flag[];
  channels: string[];
  alertsOn: boolean;
  onToggleAlerts: () => void;
}

/** Portfolio Alerts - the paper-bot flag feed + channel status. Pure presentational. */
export function FlagsPanel({ flags, channels, alertsOn, onToggleAlerts }: FlagsPanelProps) {
  const unread = flags.filter((f) => !f.read).length;
  return (
    <div className="terminal-panel rounded-md p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[#f3a33a]/30 bg-[#231a08] text-[#f3a33a]">
            <Bell size={13} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Portfolio Alerts</span>
          {unread > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f3a33a] px-1 font-mono text-[9px] font-bold text-[#07090c]">
              {unread}
            </span>
          )}
        </div>
        {/* Alert toggle */}
        <button
          type="button"
          onClick={onToggleAlerts}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold transition ${
            alertsOn
              ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b] hover:bg-[#103626]'
              : 'border-[#263241] bg-[#0d141c] text-[#6f7d8a] hover:border-[#3a4a5a]'
          }`}
        >
          {alertsOn ? <BellRing size={10} /> : <BellOff size={10} />}
          {alertsOn ? 'Alerts on' : 'Alerts off'}
        </button>
      </div>

      {/* Alert threshold info */}
      {alertsOn && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#2a1f08] bg-[#1a1206] px-2.5 py-1.5">
          <BadgePercent size={11} className="shrink-0 text-[#f3a33a]" />
          <p className="text-[10px] text-[#a8913a]">Notified when any position moves <span className="font-semibold">±5%</span> - fills, approvals and risk blocks also flagged</p>
        </div>
      )}

      {/* Channel status */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${channels.length ? 'bg-[#43d18b]' : 'bg-[#3a4a5a]'}`} />
        <span className="text-[9px] text-[#6f7d8a]">{channels.length ? channels.join(' · ') : 'In-app only - configure Telegram in Settings for push delivery'}</span>
      </div>

      {/* Flags feed */}
      {flags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1d2733] py-5 text-center">
          <Bell size={16} className="text-[#3a4a5a]" />
          <p className="text-[10px] text-[#4a5a6a]">No alerts yet - they&apos;ll appear here as your portfolio moves</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {flags.slice(0, 8).map((f) => (
            <li key={f.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
              f.severity === 'action' ? 'border-[#5a4a1a] bg-[#1a1206]' :
              f.severity === 'good' ? 'border-[#1d4a35] bg-[#0a1e14]' :
              f.severity === 'warn' ? 'border-[#4a2a1d] bg-[#1a1006]' :
              'border-[#1d2733] bg-[#080c11]'
            }`}>
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${FLAG_DOT[f.severity] ?? FLAG_DOT.info}`} />
              <span className="flex-1 text-[10px] leading-snug text-[#a8b5c2]">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
