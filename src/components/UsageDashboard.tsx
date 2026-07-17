'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Zap, CalendarCheck, LayoutGrid, Sparkles, Trophy, Trash2 } from 'lucide-react';
import { getUsage, clearUsage } from '@/lib/usage-store';
import { summarizeUsage, type UsageSummary } from '@/lib/usage';

/**
 * Your Activity - a personal, private mirror of how you use Lyra: time on the app, sessions, AI
 * questions, and a heatmap of which surfaces you actually live in. All from your own browser storage;
 * nothing leaves this device. Renders a skeleton until mounted to avoid an SSR/localStorage mismatch.
 */

function fmtDuration(totalMs: number): string {
  const min = Math.round(totalMs / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Clock; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="terminal-panel rounded-md p-3">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={tone ?? 'text-[#7fb0ff]'} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">{label}</p>
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold leading-none text-[#eef3f8]">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#8190a0]">{sub}</p>}
    </div>
  );
}

/** Heatmap tile - amber intensity scales with how much you use the surface. */
function HeatTile({ surface, label, visits, intensity }: { surface: string; label: string; visits: number; intensity: number }) {
  const alpha = 0.1 + intensity * 0.85;
  const strong = intensity >= 0.55;
  return (
    <Link
      href={surface}
      className="flex flex-col justify-between rounded-md border p-2.5 transition hover:brightness-125"
      style={{ backgroundColor: `rgba(243,163,58,${alpha})`, borderColor: strong ? 'rgba(243,163,58,0.5)' : '#1b2530' }}
    >
      <span className={`text-[11px] font-semibold leading-snug ${strong ? 'text-[#1a1206]' : 'text-[#eef3f8]'}`}>{label}</span>
      <span className={`mt-2 font-mono text-[10px] ${strong ? 'text-[#3a2a0a]' : 'text-[#8190a0]'}`}>{visits} visit{visits === 1 ? '' : 's'}</span>
    </Link>
  );
}

export function UsageDashboard() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    setSummary(summarizeUsage(getUsage()));
  }, []);

  const refresh = () => setSummary(summarizeUsage(getUsage()));

  const onClear = () => {
    clearUsage();
    refresh();
  };

  if (!summary) {
    return <div className="terminal-panel h-40 animate-pulse rounded-md" aria-hidden />;
  }

  const empty = summary.sessions === 0 && summary.surfaces.length === 0;
  const firstSeen = summary.firstSeen ? new Date(summary.firstSeen).toLocaleDateString() : '-';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[#eef3f8]">Your Activity</h1>
          <p className="mt-1 text-xs text-[#8190a0]">
            How you use Lyra - private to this device, nothing leaves your browser. Tracking since {firstSeen}.
          </p>
        </div>
        {!empty && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-[11px] text-[#8190a0] transition hover:border-[#5c2530] hover:text-[#f0758a]"
          >
            <Trash2 size={12} /> Clear my activity
          </button>
        )}
      </div>

      {empty ? (
        <div className="terminal-panel rounded-md px-4 py-8 text-center">
          <Sparkles size={20} className="mx-auto text-[#f3a33a]" />
          <p className="mt-2 text-sm font-semibold text-[#dbe5ee]">No activity yet</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-snug text-[#a8b5c2]">
            Move around Lyra and this fills in: time on the app, your sessions, AI questions, and a heatmap of the
            surfaces you use most - all tracked locally on this device.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Clock} label="Time on Lyra" value={fmtDuration(summary.totalMs)} tone="text-[#f3a33a]" />
            <StatCard icon={CalendarCheck} label="Sessions" value={String(summary.sessions)} sub={`${summary.activeDays} active day${summary.activeDays === 1 ? '' : 's'}`} tone="text-[#43d18b]" />
            <StatCard icon={Zap} label="AI requests" value={String(summary.aiRequests)} tone="text-[#b79cff]" />
            <StatCard icon={Clock} label="Avg session" value={`${summary.avgSessionMinutes}m`} tone="text-[#7fb0ff]" />
            <StatCard icon={LayoutGrid} label="Surfaces used" value={String(summary.surfacesUsed)} tone="text-[#5bc8ff]" />
            <StatCard icon={Trophy} label="Most used" value={summary.mostUsed?.label ?? '-'} sub={summary.mostUsed ? `${summary.mostUsed.visits} visits` : undefined} tone="text-[#f3a33a]" />
          </div>

          {/* Heatmap */}
          <section className="terminal-panel rounded-md p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <LayoutGrid size={14} className="text-[#f3a33a]" />
              <h2 className="text-sm font-semibold text-[#eef3f8]">Surface heatmap</h2>
              <span className="text-[11px] text-[#8190a0]">where you spend your time - brighter = more used</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {summary.surfaces.map((s) => (
                <HeatTile key={s.surface} surface={s.surface} label={s.label} visits={s.visits} intensity={s.intensity} />
              ))}
            </div>
          </section>

          {/* Top surfaces breakdown */}
          <section className="terminal-panel rounded-md p-3">
            <h2 className="mb-2 text-sm font-semibold text-[#eef3f8]">Most-used surfaces</h2>
            <div className="space-y-1.5">
              {summary.surfaces.slice(0, 8).map((s) => (
                <div key={s.surface} className="flex items-center gap-2">
                  <Link href={s.surface} className="w-32 shrink-0 truncate text-[12px] text-[#c3ccd6] hover:text-[#eef3f8]">
                    {s.label}
                  </Link>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#0d141c]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#9a6a1f] to-[#f3a33a]" style={{ width: `${Math.max(3, s.sharePct)}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] text-[#8190a0]">{s.visits}x · {s.sharePct}%</span>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] text-[#5e6b78]">{fmtDuration(s.ms)}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="border-t border-[#1b2530] pt-3 text-[11px] leading-snug text-[#5a6b7d]">
            Local and private: this is computed from your own browser storage and never sent anywhere. Clearing your
            browser data or using another device starts a fresh count.
          </p>
        </>
      )}
    </div>
  );
}
