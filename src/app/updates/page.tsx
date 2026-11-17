import { AppShell } from '@/components/AppShell';
import { MarketReadView } from '@/components/updates/MarketReadView';
import { WorldBoardView } from '@/components/updates/WorldBoardView';
import { getDashboardData } from '@/lib/data';
import { loadLatestRead, updatesAvailable, type PublishedRead } from '@/lib/updates/store';
import type { WorldSnapshot } from '@/lib/world/compute';
import { getWorldSnapshot } from '@/lib/world/fetch';

export const metadata = { title: 'Updates' };
export const dynamic = 'force-dynamic';

/**
 * Updates - the home of what Lyra writes for its readers, free and with no account: the market
 * read of the last US session, published by the writer on a GitHub runner through
 * /api/updates/publish and kept in the shared store. It is the same read for everyone; nothing on
 * this page depends on who is looking.
 */
export default async function UpdatesPage() {
  const available = updatesAvailable();
  // A store that does not answer is "no read to show", and a board that cannot be read is no board -
  // never a broken page. The board is the same for everyone and shared for ten minutes.
  const [data, read, world] = await Promise.all([
    getDashboardData(),
    available ? loadLatestRead().catch(() => null as PublishedRead | null) : null,
    getWorldSnapshot().catch(() => null as WorldSnapshot | null),
  ]);

  return (
    <AppShell data={data}>
      <div className="space-y-6 pb-28 xl:pb-6">
        <MarketReadView read={read} available={available} />
        <WorldBoardView snapshot={world} />
      </div>
    </AppShell>
  );
}
