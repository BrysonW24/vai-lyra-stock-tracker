import { AppShell } from '@/components/AppShell';
import { IntelligenceFeed } from '@/components/intelligence/IntelligenceFeed';
import { Insight } from '@/components/Insight';
import { getDashboardData } from '@/lib/data';
import { getIntelligenceLive } from '@/lib/intelligence-live';

export const metadata = { title: 'Intelligence' };

/**
 * Intelligence page - async server component wrapping the client feed, with a rotating
 * "Good to know" finance fact under the Intel banner. The feed reads live worker rows
 * (news_items / hype_scores) when configured and falls back to a clearly-labelled
 * illustrative sample otherwise - never fabricated news dressed as live (see the
 * 2026-07-27 audit fix).
 */
export default async function IntelligencePage() {
  const [data, intel] = await Promise.all([getDashboardData(), getIntelligenceLive()]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <Insight />
        <IntelligenceFeed feed={intel.feed} hypeMap={intel.hypeMap} source={intel.source} updatedAt={intel.updatedAt} />
      </div>
    </AppShell>
  );
}
