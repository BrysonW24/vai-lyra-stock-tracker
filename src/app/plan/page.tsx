import { AppShell } from '@/components/AppShell';
import { TradePlanCard, type PlanSymbolContext } from '@/components/plan/TradePlanCard';
import { getDashboardData } from '@/lib/data';
import { getUserConstraints } from '@/lib/ai/user-context';
import { getThemeCompanies } from '@/lib/world-radar';
import { backingFor, stageFor } from '@/lib/small-cap-lifecycle';
import { getOutcomeDistribution, expectancyFromOutcome } from '@/lib/outcomes';

export const metadata = { title: 'Trade Plan' };

/**
 * The trade-plan surface: a cost-aware, expectancy-aware sizing sketch for one name against the
 * user's own capital. Per-symbol context (price, liquidity, lifecycle stage, outcome base rate) is
 * assembled server-side from the deterministic engine and handed to the pure client card, which
 * runs the sizing math live. Demo-safe: with no capital on file it starts from an example balance.
 */
export default async function PlanPage() {
  const data = await getDashboardData();
  const constraints = await getUserConstraints().catch(() => null);
  const companies = getThemeCompanies();

  const symbols: PlanSymbolContext[] = data.signals
    .slice(0, 80)
    .map((s) => {
      const company = companies.find((c) => c.symbol.toUpperCase() === s.symbol.toUpperCase());
      const lifecycleStage = company ? stageFor(company, backingFor(company.symbol), s.score ?? 50) : undefined;
      const dist = getOutcomeDistribution('momentum_recovery_v1', String(s.status));
      return {
        symbol: s.symbol,
        name: s.companyName,
        close: Number(s.close) || 0,
        status: String(s.status),
        liquidity: company?.liquidity,
        lifecycleStage,
        outcome: expectancyFromOutcome(dist),
        provenance: dist?.provenance,
      };
    })
    .filter((x) => x.close > 0);

  const hasCapitalOnFile = typeof constraints?.cashAvailable === 'number' && constraints.cashAvailable > 0;
  const defaultAccountSize = hasCapitalOnFile ? (constraints!.cashAvailable as number) : 5000;
  const baseCurrency = constraints?.baseCurrency ?? 'USD';
  const defaultMaxPositionPct =
    typeof constraints?.maxPositionSizePct === 'number' && constraints.maxPositionSizePct > 0 ? constraints.maxPositionSizePct : 20;

  return (
    <AppShell data={data}>
      <TradePlanCard
        symbols={symbols}
        defaultAccountSize={defaultAccountSize}
        baseCurrency={baseCurrency}
        defaultMaxPositionPct={defaultMaxPositionPct}
        crossCurrencyDefault={baseCurrency.toUpperCase() !== 'USD'}
        hasCapitalOnFile={hasCapitalOnFile}
      />
    </AppShell>
  );
}
