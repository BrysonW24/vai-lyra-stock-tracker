import { AppShell } from '@/components/AppShell';
import { InvestorRadar } from '@/components/investors/InvestorRadar';
import { getDashboardData } from '@/lib/data';
import { getInvestors, getSmallCapCompanies, getThemes } from '@/lib/world-radar';
import { pageTitleClass } from '@/lib/ui';

export const metadata = { title: 'Investor Radar' };

export default async function InvestorsPage() {
  const data = await getDashboardData();

  const investors = getInvestors();
  const themesBySlug = Object.fromEntries(
    getThemes().map((t) => [t.slug, { name: t.name, emoji: t.emoji }]),
  );
  const smallCapSymbols = getSmallCapCompanies().map((c) => c.symbol);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-panel p-3">
          <h1 className={pageTitleClass}>Investor Radar</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-2">
            What elite managers disclosed in their latest 13F filings - new positions, adds, trims and exits across
            every tracked book. Small-cap overlap is flagged on each move: disciplined money showing up in a small name
            is the signal this page exists for.
          </p>
        </section>

        <InvestorRadar investors={investors} themesBySlug={themesBySlug} smallCapSymbols={smallCapSymbols} />

        <p className="text-[10px] text-ink-dim">
          Research only - not financial advice. Scores are deterministic research rankings, not recommendations.
        </p>
      </div>
    </AppShell>
  );
}
