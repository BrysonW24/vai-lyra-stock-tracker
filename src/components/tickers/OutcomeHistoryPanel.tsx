import { formatNumber, formatPercent, formatSignedPercent, toneClass } from '@/lib/format';
import { formatOutcomeSummary, getOutcomeDistribution } from '@/lib/outcomes';

interface OutcomeHistoryPanelProps {
  signalType: string;
  signalStatus: string;
}

export function OutcomeHistoryPanel({ signalType, signalStatus }: OutcomeHistoryPanelProps) {
  const distribution = getOutcomeDistribution(signalType, signalStatus);

  if (!distribution) {
    return (
      <section className="terminal-panel rounded-md p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Past similar setups</p>
        <p className="mt-2 text-sm text-[#8190a0]">Insufficient data for this signal type.</p>
      </section>
    );
  }

  const outcomes = [
    { horizon: "1D", return: distribution.return1dMedian, winRate: distribution.return1dWinRate },
    { horizon: "5D", return: distribution.return5dMedian, winRate: distribution.return5dWinRate },
    { horizon: "20D", return: distribution.return20dMedian, winRate: distribution.return20dWinRate },
    { horizon: "60D", return: distribution.return60dMedian, winRate: distribution.return60dWinRate },
  ];

  return (
    <section className="terminal-panel rounded-md p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Past similar setups</p>

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

        {outcomes.map((row) => (
          <div key={row.horizon} className="grid grid-cols-4 gap-2 font-mono text-xs">
            <div className="text-[#8190a0]">{row.horizon}</div>
            <div className={toneClass(row.return ?? 0)}>
              {row.return !== null ? formatSignedPercent(row.return, 1) : "-"}
            </div>
            <div className="text-[#dbe5ee]">{Math.round(row.winRate)}%</div>
            <div className="text-[#a8b5c2]">n={distribution.sampleSize}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[#1b2530] pt-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0 text-[#a8b5c2]">•</div>
          <p className="text-sm leading-5 text-[#dbe5ee]">{formatOutcomeSummary(distribution)}</p>
        </div>
        {distribution.worstDrawdownMin !== null && (
          <div className="mt-2 flex items-start gap-2">
            <div className="mt-0.5 flex-shrink-0 text-[#ff6b6b]">•</div>
            <p className="text-sm leading-5 text-[#dbe5ee]">
              Worst drawdown: <span className="text-[#ff6b6b]">{formatSignedPercent(distribution.worstDrawdownMin, 1)}</span>
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[10px] text-[#5a6470]">Research data only. Past performance ≠ future results.</p>
    </section>
  );
}
