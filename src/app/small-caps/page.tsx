import { AppShell } from '@/components/AppShell';
import { SmallCapDiscovery } from '@/components/smallcaps/SmallCapDiscovery';
import { EmergenceShortlist } from '@/components/smallcaps/EmergenceShortlist';
import { SignalIntelligenceBoard } from '@/components/smallcaps/SignalIntelligenceBoard';
import { getDashboardData } from '@/lib/data';
import { buildSmallCapResearchBackend } from '@/lib/small-cap-research';
import { bucketSmallCaps, getThemes, scoreThemeCompanies } from '@/lib/world-radar';
import { buildEmergenceShortlist, buildLifecycleCandidates, stageDistribution } from '@/lib/small-cap-lifecycle';
import { traceThemeChain, companyChainPosition, type ValueChain, type CompanyChainPosition } from '@/lib/value-chain';
import { buildSignalIntelligence } from '@/lib/signal-intelligence';

export default async function SmallCapsPage() {
  const data = await getDashboardData();
  const momentumBySymbol = Object.fromEntries(data.signals.map((s) => [s.symbol, s.score]));

  // Flagship layer: lifecycle staging + backing + emergence shortlist, and the end-to-end value
  // chains (traced once per theme that the shortlist touches, focused on that theme's lead name).
  const shortlist = buildEmergenceShortlist(momentumBySymbol, 8);
  const distribution = stageDistribution(buildLifecycleCandidates(momentumBySymbol));
  const intel = buildSignalIntelligence(momentumBySymbol);
  const chainsByTheme: Record<string, ValueChain> = {};
  const positionsBySymbol: Record<string, CompanyChainPosition> = {};
  for (const candidate of shortlist) {
    if (!chainsByTheme[candidate.theme]) {
      const chain = traceThemeChain(candidate.theme, candidate.symbol);
      if (chain) chainsByTheme[candidate.theme] = chain;
    }
    const position = companyChainPosition(candidate.symbol);
    if (position) positionsBySymbol[candidate.symbol] = position;
  }

  // Existing discovery layer (kept below the flagship).
  const scored = scoreThemeCompanies(undefined, momentumBySymbol).filter(
    (c) => c.sizeBucket === 'small' || c.sizeBucket === 'micro',
  );
  const buckets = bucketSmallCaps(scored);
  const themesBySlug = Object.fromEntries(getThemes().map((t) => [t.slug, { name: t.name, emoji: t.emoji }]));
  const research = buildSmallCapResearchBackend(data.signals);

  return (
    <AppShell data={data}>
      <div className="space-y-4 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-md p-3">
          <h1 className="text-sm font-semibold text-[#eef3f8]">Small caps - catch the emerging markets early</h1>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[#a8b5c2]">
            Find low-cap companies early in the AI, quantum, space, nuclear and critical-minerals build-outs, trace
            each one through its whole lifecycle - back to the raw materials that feed it and forward to the demand
            that pays for it - and surface the ones already carrying government and big-tech capital. Deterministic
            research only, never a buy or sell call.
          </p>
        </section>

        {/* Signal intelligence: where independent signals converge right now (reasoning over the multitude). */}
        <SignalIntelligenceBoard convergence={intel.convergence} stats={intel.stats} generatedAt={intel.generatedAt} />

        {/* Flagship: the narrow select/watch/invest shortlist + end-to-end value-chain trace. */}
        <EmergenceShortlist
          shortlist={shortlist}
          distribution={distribution}
          chainsByTheme={chainsByTheme}
          positionsBySymbol={positionsBySymbol}
        />

        {/* Full discovery engine below the shortlist. */}
        <div className="space-y-1">
          <h2 className="text-[12px] font-semibold text-[#eef3f8]">Full discovery engine</h2>
          <p className="text-[10px] leading-snug text-[#8190a0]">
            Every small and micro cap ranked by the deterministic opportunity engine, bucketed and theme-filterable.
          </p>
        </div>
        <SmallCapDiscovery buckets={buckets} themesBySlug={themesBySlug} research={research} />

        <p className="text-[10px] text-[#6f7d8a]">
          Research only - not financial advice. Scores are deterministic research rankings, not recommendations.
        </p>
      </div>
    </AppShell>
  );
}
