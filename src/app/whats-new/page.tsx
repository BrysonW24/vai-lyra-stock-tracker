import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { WhatsNewFeed } from '@/components/WhatsNewFeed';
import { VersionHistory } from '@/components/VersionHistory';
import { getDashboardData } from '@/lib/data';
import { APP_VERSION } from '@/lib/version';

export const metadata = {
  title: "What's New · Stock Momentum Radar",
};

export default async function WhatsNewPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel overflow-hidden rounded-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md border border-[#9a6a1f] bg-[#23180b] text-[#f3a33a]">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Product updates</p>
                <p className="mt-0.5 font-mono text-xs text-[#a8b5c2]">What&apos;s new in the console</p>
              </div>
            </div>
            <span className="rounded-full border border-[#1d7f55] bg-[#0d251b] px-2 py-0.5 font-mono text-[10px] text-[#43d18b]">v{APP_VERSION}</span>
          </div>
          <p className="px-3 py-2.5 text-[13px] leading-relaxed text-[#a8b5c2]">
            The version history below is the release log by version. Under it, every user-visible change
            also ships to the activity feed - filterable by area, grouped by week.
          </p>
        </section>

        <VersionHistory />

        <WhatsNewFeed />
      </div>
    </AppShell>
  );
}
