import { AppShell } from '@/components/AppShell';
import { SmartMoneyCard } from '@/components/SmartMoneyCard';
import { getDashboardData } from '@/lib/data';
import { fetchLiveSmartMoney } from '@/lib/smart-money-live';
import { pageTitleClass } from '@/lib/ui';

export const metadata = { title: 'Smart Money' };

export default async function SmartMoneyPage() {
  const data = await getDashboardData();
  const { items, live } = await fetchLiveSmartMoney();
  const gov = items.filter((s) => s.backer === 'government').length;
  const bigTech = items.filter((s) => s.backer === 'big-tech').length;
  const bigAi = items.filter((s) => s.backer === 'big-ai').length;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-panel p-3">
          <h1 className={pageTitleClass}>Smart Money · Small Caps</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-2">
            Follow government, big-tech and big-AI money into small caps - a news-driven edge that sits outside the price
            engine. Tap any name for the backing detail. {live ? 'Live from Finnhub news + AI extraction.' : 'Sample shape; live Finnhub + AI newsflow wires in when keys are set.'}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {([
              ['Government', gov, 'text-pending'],
              ['Big tech', bigTech, 'text-pending'],
              ['Big AI', bigAi, 'text-positive'],
            ] as const).map(([label, count, tone]) => (
              <div className="rounded-cell border border-line-strong bg-panel p-2" key={label}>
                <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{count}</p>
              </div>
            ))}
          </div>
        </section>

        <SmartMoneyCard items={items} live={live} />
      </div>
    </AppShell>
  );
}
