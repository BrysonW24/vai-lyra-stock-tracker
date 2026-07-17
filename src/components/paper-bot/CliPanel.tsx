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
    <div className="terminal-panel rounded-md px-2.5 py-2">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1.5 text-left">
        <Terminal size={11} className="text-[#8aa2ff]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Command line</span>
        <span className="ml-auto text-[9px] text-[#6f7d8a]">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <div className="mt-1.5 max-h-44 overflow-y-auto rounded border border-[#161e28] bg-[#080c11] p-2 font-mono text-[10px] leading-relaxed">
            {log.length === 0 ? (
              <p className="text-[#5e6b78]">Type <span className="text-[#8aa2ff]">help</span> to list commands. The CLI drives the same paper-only engine as the buttons - no live path.</p>
            ) : (
              log.map((e, i) => (
                <div key={i} className="mb-1">
                  <p className="text-[#8aa2ff]">&gt; {e.cmd}</p>
                  {e.lines.map((ln, j) => (
                    <p key={j} className={e.ok ? 'text-[#a8b5c2]' : 'text-[#ff8a8a]'} style={{ whiteSpace: 'pre-wrap' }}>{ln}</p>
                  ))}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={(ev) => { ev.preventDefault(); onRun(input); }} className="mt-1.5 flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-[#8aa2ff]">&gt;</span>
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="help"
              disabled={busy}
              spellCheck={false}
              autoCapitalize="none"
              className="flex-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#dbe5ee] outline-none focus:border-[#8aa2ff]/50"
            />
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded border border-[#8aa2ff]/40 bg-[#101a2e] px-2 py-1 text-[10px] font-semibold text-[#8aa2ff] disabled:opacity-50">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <CornerDownLeft size={11} />}
            </button>
          </form>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {QUICK_CMDS.map((c) => (
              <button key={c} type="button" onClick={() => onRun(c)} disabled={busy} className="rounded-full border border-[#1d2733] bg-[#0b1016] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0] transition hover:border-[#8aa2ff]/40 hover:text-[#8aa2ff] disabled:opacity-50">{c}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
