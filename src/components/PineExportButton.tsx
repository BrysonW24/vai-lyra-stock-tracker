'use client';

import { useState } from 'react';
import { Check, Code2 } from 'lucide-react';
import { generateLyraPineStrategy } from '@/lib/pine/lyra-strategy';

/**
 * Copies this ticker's Lyra strategy as a TradingView Pine v5 script. The script is a faithful
 * mirror of the deterministic oversold-recovery score, so a trader can backtest the exact logic
 * that surfaces it here. Works for every user with no setup - paste into TradingView's Pine editor.
 */
export function PineExportButton({ symbol }: { symbol: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const src = generateLyraPineStrategy({ symbol });
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked (rare, e.g. insecure context): fall back to a copyable prompt.
      window.prompt('Copy the Lyra Pine strategy:', src);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Copy ${symbol}'s Lyra strategy as a TradingView Pine script. Paste into Pine editor then Add to chart to backtest.`}
      className={[
        'inline-flex min-h-[44px] items-center gap-1 rounded-cell border px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition sm:min-h-0',
        copied
          ? 'border-positive/50 bg-positive-tint text-positive'
          : 'border-line-strong bg-panel text-ink-3 hover:border-line-hair hover:text-ink',
      ].join(' ')}
    >
      {copied ? <Check size={12} /> : <Code2 size={12} />}
      {copied ? 'Copied' : 'Pine'}
    </button>
  );
}
