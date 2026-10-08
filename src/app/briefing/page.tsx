import { AppShell } from '@/components/AppShell';
import { BriefingView } from '@/components/briefing/BriefingView';
import { getBriefings } from '@/lib/briefing-live';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'AI Briefing' };

/**
 * The AI briefing page - the in-app home of the evening briefing the worker sends to Telegram and
 * push. Every account can read it here whether or not a channel is connected, which is what makes
 * "everyone who has the app gets it" true rather than hoped for.
 */
export default async function BriefingPage() {
  const [data, dataset] = await Promise.all([getDashboardData(), getBriefings()]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <BriefingView briefings={dataset.briefings} source={dataset.source} />
      </div>
    </AppShell>
  );
}
