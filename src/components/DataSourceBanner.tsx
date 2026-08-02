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
        className="flex items-start gap-2 rounded-cell border border-accent-border bg-accent-tint px-3 py-2"
        role="note"
      >
        <FlaskConical size={14} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-xs leading-relaxed text-accent">
          <span className="font-semibold">Illustrative sample</span> - {sampleLabel} This is
          bundled demo content, not live market data, and no external source has published it. It appears when
          the live feed is not configured on this deployment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-cell border border-positive/40 bg-positive-tint px-3 py-1.5">
      <Radio size={13} className="shrink-0 animate-pulse text-positive" />
      <p className="text-xs text-positive">
        <span className="font-semibold">Live</span> - {liveLabel}
        {updatedAt ? <span className="text-positive/60"> · synced {relativeTime(updatedAt)}</span> : null}
      </p>
    </div>
  );
}
