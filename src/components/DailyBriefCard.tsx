import { Sparkles } from 'lucide-react';
import type { DashboardData } from '@/types/scanner';
import type { MarketContextSnapshot } from '@/lib/market-context';
import { buildDailyBrief, type BriefTone } from '@/lib/daily-brief';
import { BriefAiNarration } from '@/components/BriefAiNarration';

const TONE_DOT: Record<BriefTone, string> = {
  pos: 'bg-[#43d18b]',
  neg: 'bg-[#ff6b6b]',
  warn: 'bg-[#f3a33a]',
  neutral: 'bg-[#5e6b78]',
};

const REGIME_CHIP: Record<BriefTone, string> = {
  pos: 'border-[#1d4f3a] bg-[#0d251b] text-[#43d18b]',
  neg: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]',
  warn: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  neutral: 'border-[#263241] bg-[#0d141c] text-[#a8b5c2]',
};

interface DailyBriefCardProps {
  data: DashboardData;
  market: MarketContextSnapshot;
}

export function DailyBriefCard({ data, market }: DailyBriefCardProps) {
  const brief = buildDailyBrief(data, market);

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#1b2530] px-3 py-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
            <Sparkles size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Daily brief</p>
            <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[#eef3f8]">{brief.headline}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${REGIME_CHIP[brief.regimeTone]}`}>
          {brief.regimeLabel}
        </span>
      </div>

      {/* AI narration appears here when enabled in Account; otherwise nothing renders. */}
      <BriefAiNarration brief={brief} />

      <div className="divide-y divide-[#141c25]">
        {brief.lines.map((line) => (
          <div className="flex items-start gap-2 px-3 py-1.5" key={`${line.label}-${line.text}`}>
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[line.tone]}`} />
            <p className="text-xs leading-snug text-[#c8d3de]">
              <span className="font-mono text-[10px] uppercase tracking-wide text-[#8190a0]">{line.label}</span>
              <span className="mx-1.5 text-[#3a4654]">·</span>
              {line.text}
            </p>
          </div>
        ))}
      </div>

      <p className="border-t border-[#1b2530] px-3 py-1.5 font-mono text-[10px] text-[#5e6b78]">
        Auto-generated from the latest scan. Enable AI in Account to have it written for you.
      </p>
    </section>
  );
}
