'use client';

import type { RefObject } from 'react';
import { Terminal, Loader2, CornerDownLeft } from 'lucide-react';
import type { CliEntry } from './paper-bot-types';

const QUICK_CMDS = ['status', 'positions', 'pnl', 'propose NVDA 10', 'approve', 'execute', 'flags'];

interface CliPanelProps {
  open: boolean;
  onToggle: () => void;
  log: CliEntry[];
  input: string;
  onInputChange: (value: string) => void;
  busy: boolean;
  onRun: (line: string) => void;
  endRef: RefObject<HTMLDivElement | null>;
}

/** Command line - drives the same paper-only engine as the buttons. Pure presentational. */
export function CliPanel({ open, onToggle, log, input, onInputChange, busy, onRun, endRef }: CliPanelProps) {
  return (
    <div className="terminal-panel rounded-panel px-2.5 py-2">
      <button type="button" onClick={onToggle} className="flex min-h-[44px] w-full items-center gap-1.5 text-left sm:min-h-0">
        <Terminal size={11} className="text-pending" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-title">Command line</span>
        <span className="ml-auto text-[9px] text-ink-dim">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <div className="mt-1.5 max-h-44 overflow-y-auto rounded-cell border border-line/70 bg-well p-2 font-mono text-[10px] leading-relaxed">
            {log.length === 0 ? (
              <p className="text-ink-dim">Type <span className="text-pending">help</span> to list commands. The CLI drives the same paper-only engine as the buttons - no live path.</p>
            ) : (
              log.map((e, i) => (
                <div key={i} className="mb-1">
                  <p className="text-pending">&gt; {e.cmd}</p>
                  {e.lines.map((ln, j) => (
                    <p key={j} className={e.ok ? 'text-ink-2' : 'text-negative'} style={{ whiteSpace: 'pre-wrap' }}>{ln}</p>
                  ))}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={(ev) => { ev.preventDefault(); onRun(input); }} className="mt-1.5 flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-pending">&gt;</span>
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="help"
              disabled={busy}
              spellCheck={false}
              autoCapitalize="none"
              className="min-h-[44px] flex-1 rounded-cell border border-line-strong bg-panel px-2 py-1 font-mono text-[11px] text-ink-title outline-none focus:border-blue-focus/50 sm:min-h-0"
            />
            <button type="submit" disabled={busy} className="inline-flex min-h-[44px] items-center gap-1 rounded-cell border border-pending/40 bg-blue-tint px-2 py-1 text-[10px] font-semibold text-pending disabled:opacity-50 sm:min-h-0">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <CornerDownLeft size={11} />}
            </button>
          </form>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {QUICK_CMDS.map((c) => (
              <button key={c} type="button" onClick={() => onRun(c)} disabled={busy} className="rounded-full border border-line bg-chrome px-1.5 py-0.5 font-mono text-[9px] text-ink-3 transition hover:border-pending/40 hover:text-pending disabled:opacity-50">{c}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
