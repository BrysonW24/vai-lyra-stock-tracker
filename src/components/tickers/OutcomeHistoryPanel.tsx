interface OutcomeHistoryPanelProps {
  signalType: string;
  signalStatus: string;
}

// Forward horizons we will report once real signal outcomes are recorded.
const HORIZONS = ["1D", "5D", "20D", "60D"] as const;

/**
 * Past-similar-setups panel.
 *
 * There is no live backtest yet - the signal_outcomes table is empty - so this
 * renders an explicit illustrative empty state instead of fabricated medians,
 * win rates, and sample counts. The layout is preserved so the slots are ready
 * when real forward-return data lands. signalType / signalStatus are accepted so
 * callers do not change when the live aggregation wires in.
 */
export function OutcomeHistoryPanel({ signalType, signalStatus }: OutcomeHistoryPanelProps) {
  void signalType;
  void signalStatus;

  return (
    <section className="terminal-panel rounded-md p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Past similar setups</p>
        <span className="rounded border border-[#3a4452] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#8190a0]">Illustrative</span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <p className="font-semibold text-[#dbe5ee]">Horizon</p>
          </div>
          <div>
            <p className="font-semibold text-[#dbe5ee]">Return</p>
          </div>
          <div>
            <p className="font-semibold text-[#dbe5ee]">Win Rate</p>
          </div>
          <div>
            <p className="font-semibold text-[#dbe5ee]">Sample</p>
          </div>
        </div>

        <div className="border-t border-[#1b2530]" />

        {HORIZONS.map((horizon) => (
          <div key={horizon} className="grid grid-cols-4 gap-2 font-mono text-xs">
            <div className="text-[#8190a0]">{horizon}</div>
            <div className="text-[#5e6b78]">-</div>
            <div className="text-[#5e6b78]">-</div>
            <div className="text-[#5e6b78]">-</div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[#1b2530] pt-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0 text-[#a8b5c2]">•</div>
          <p className="text-sm leading-5 text-[#a8b5c2]">
            Illustrative - no live backtest yet. Forward-return medians, win rates and drawdowns fill in once enough similar setups have played out; Lyra never shows fabricated outcome stats.
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-[#5a6470]">Research data only. Past performance is not future results.</p>
    </section>
  );
}
