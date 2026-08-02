'use client';

import { Bell, BellRing, BellOff, BadgePercent } from 'lucide-react';
import type { Flag } from './paper-bot-types';

/*
 * Severity dots. The old orange warn (#ff8a5c) has no token; warn collapses into the accent
 * (caution) family at reduced intensity so status colours stay semantic (P3 ruling).
 */
const FLAG_DOT: Record<string, string> = {
  action: 'bg-accent',
  good: 'bg-positive',
  warn: 'bg-accent/70',
  info: 'bg-ink-3',
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
    <div className="terminal-panel rounded-panel p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-cell border border-accent/30 bg-accent-tint/80 text-accent">
            <Bell size={13} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-title">Portfolio Alerts</span>
          {unread > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-ground">
              {unread}
            </span>
          )}
        </div>
        {/* Alert toggle */}
        <button
          type="button"
          onClick={onToggleAlerts}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold transition sm:min-h-0 ${
            alertsOn
              ? 'border-positive/50 bg-positive-tint text-positive hover:bg-positive/20'
              : 'border-line-strong bg-panel text-ink-dim hover:border-line-hair'
          }`}
        >
          {alertsOn ? <BellRing size={10} /> : <BellOff size={10} />}
          {alertsOn ? 'Alerts on' : 'Alerts off'}
        </button>
      </div>

      {/* Alert threshold info */}
      {alertsOn && (
        <div className="mb-2 flex items-center gap-2 rounded-cell border border-accent-border/30 bg-accent-tint/60 px-2.5 py-1.5">
          <BadgePercent size={11} className="shrink-0 text-accent" />
          <p className="text-[10px] text-accent/70">Notified when any position moves <span className="font-semibold">±5%</span> - fills, approvals and risk blocks also flagged</p>
        </div>
      )}

      {/* Channel status */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${channels.length ? 'bg-positive' : 'bg-ink-dim/80'}`} />
        <span className="text-[9px] text-ink-dim">{channels.length ? channels.join(' · ') : 'In-app only - configure Telegram in Settings for push delivery'}</span>
      </div>

      {/* Flags feed */}
      {flags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-cell border border-dashed border-line py-5 text-center">
          <Bell size={16} className="text-ink-dim/80" />
          <p className="text-[10px] text-ink-dim">No alerts yet - they&apos;ll appear here as your portfolio moves</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {flags.slice(0, 8).map((f) => (
            <li key={f.id} className={`flex items-start gap-2 rounded-cell border px-2.5 py-1.5 ${
              f.severity === 'action' ? 'border-accent-border/60 bg-accent-tint/60' :
              f.severity === 'good' ? 'border-positive/40 bg-positive-tint/80' :
              f.severity === 'warn' ? 'border-accent-border/40 bg-accent-tint/40' :
              'border-line bg-well'
            }`}>
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${FLAG_DOT[f.severity] ?? FLAG_DOT.info}`} />
              <span className="flex-1 text-[10px] leading-snug text-ink-2">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
