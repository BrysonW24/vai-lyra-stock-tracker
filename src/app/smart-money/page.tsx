import { AppShell } from '@/components/AppShell';
import { SmartMoneyCard } from '@/components/SmartMoneyCard';
import { getDashboardData } from '@/lib/data';
import { fetchLiveSmartMoney } from '@/lib/smart-money-live';

export default async function SmartMoneyPage() {
  const data = await getDashboardData();
  const { items, live } = await fetchLiveSmartMoney();
  const gov = items.filter((s) => s.backer === 'government').length;
  const bigTech = items.filter((s) => s.backer === 'big-tech').length;
  const bigAi = items.filter((s) => s.backer === 'big-ai').length;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-md p-3">
          <h1 className="text-sm font-semibold text-[#eef3f8]">Smart Money · Small Caps</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#a8b5c2]">
            Follow government, big-tech and big-AI money into small caps - a news-driven edge that sits outside the price
            engine. Tap any name for the backing detail. {live ? 'Live from Finnhub news + AI extraction.' : 'Sample shape; live Finnhub + AI newsflow wires in when keys are set.'}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ['Government', gov, 'text-[#8aa2ff]'],
              ['Big tech', bigTech, 'text-[#c08aff]'],
              ['Big AI', bigAi, 'text-[#43d18b]'],
            ] as const).map(([label, count, tone]) => (
              <div className="rounded-md border border-[#263241] bg-[#0d141c] p-2" key={label}>
                <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{label}</p>
                <p className={`numeric mt-0.5 font-mono text-base font-semibold ${tone}`}>{count}</p>
              </div>
            ))}
          </div>
        </section>

        <SmartMoneyCard items={items} live={live} />
      </div>
    </AppShell>
  );
}
