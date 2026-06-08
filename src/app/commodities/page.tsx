import { AppShell } from '@/components/AppShell';
import { CommoditiesCard } from '@/components/CommoditiesCard';
import { getDashboardData } from '@/lib/data';
import { COMMODITIES } from '@/lib/commodities';

export default async function CommoditiesPage() {
  const data = await getDashboardData();
  const aiCount = COMMODITIES.filter((c) => c.ai).length;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-md p-3">
          <h1 className="text-sm font-semibold text-[#eef3f8]">Commodities</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#a8b5c2]">
            The raw materials behind markets - where they actually come from (real) and the AI-buildout angle. Live
            prices + commodity newsflow wire in next.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-md border border-[#263241] bg-[#0d141c] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Tracked</p>
              <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-[#eef3f8] md:text-base">{COMMODITIES.length}</p>
            </div>
            <div className="rounded-md border border-[#1d4f3a] bg-[#0d251b] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#43d18b]">AI-buildout linked</p>
              <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-[#43d18b] md:text-base">{aiCount}</p>
            </div>
          </div>
        </section>

        <CommoditiesCard />
      </div>
    </AppShell>
  );
}
