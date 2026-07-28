import { FlaskConical, Radio } from 'lucide-react';
import { relativeTime } from '@/lib/format';

/**
 * Honest source disclosure for surfaces that render live-worker data with a bundled demo
 * fallback (intelligence, fundamentals). A 'sample' surface must never look like real,
 * current market data - this is the load-bearing fix for the fabrication trust breach the
 * 2026-07-27 audit flagged on /intelligence + /fundamentals (V9/V10 P1). Server component,
 * no client JS.
 *
 * - source 'sample': amber "illustrative sample, not live market data" banner.
 * - source 'live':   subtle green "live" pill with the last sync time.
 */
export function DataSourceBanner({
  source,
  updatedAt,
  sampleLabel,
  liveLabel,
}: {
  source: 'live' | 'sample';
  updatedAt?: string | null;
  sampleLabel: string;
  liveLabel: string;
}) {
  if (source === 'sample') {
    return (
      <div
        className="flex items-start gap-2 rounded-md border border-[#9a6a1f] bg-[#2a1f0f] px-3 py-2"
        role="note"
      >
        <FlaskConical size={14} className="mt-0.5 shrink-0 text-[#f3a33a]" />
        <p className="text-xs leading-relaxed text-[#f3c98a]">
          <span className="font-semibold text-[#f3a33a]">Illustrative sample</span> - {sampleLabel} This is
          bundled demo content, not live market data, and no external source has published it. It appears when
          the live feed is not configured on this deployment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-[#1d7f55] bg-[#0d251b] px-3 py-1.5">
      <Radio size={13} className="shrink-0 animate-pulse text-[#43d18b]" />
      <p className="text-xs text-[#8fd9b4]">
        <span className="font-semibold text-[#43d18b]">Live</span> - {liveLabel}
        {updatedAt ? <span className="text-[#5d8f77]"> · synced {relativeTime(updatedAt)}</span> : null}
      </p>
    </div>
  );
}
