import { AppShell } from '@/components/AppShell';
import { CommoditiesCard } from '@/components/CommoditiesCard';
import { getDashboardData } from '@/lib/data';
import { COMMODITIES } from '@/lib/commodities';
import { pageTitleClass } from '@/lib/ui';

export const metadata = { title: 'Commodities' };

export default async function CommoditiesPage() {
  const data = await getDashboardData();
  const aiCount = COMMODITIES.filter((c) => c.ai).length;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-panel p-3">
          <h1 className={pageTitleClass}>Commodities</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-2">
            The raw materials behind markets - where they actually come from (real) and the AI-buildout angle. Live
            prices + commodity newsflow wire in next.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-cell border border-line-strong bg-panel p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Tracked</p>
              <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-ink md:text-base">{COMMODITIES.length}</p>
            </div>
            <div className="rounded-cell border border-positive/40 bg-positive-tint p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-positive">AI-buildout linked</p>
              <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-positive md:text-base">{aiCount}</p>
            </div>
          </div>
        </section>

        <CommoditiesCard />
      </div>
    </AppShell>
  );
}
