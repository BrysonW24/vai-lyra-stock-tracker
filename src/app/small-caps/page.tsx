import { AppShell } from '@/components/AppShell';
import { SmallCapDiscovery } from '@/components/smallcaps/SmallCapDiscovery';
import { getDashboardData } from '@/lib/data';
import { buildSmallCapResearchBackend } from '@/lib/small-cap-research';
import { bucketSmallCaps, getThemes, scoreThemeCompanies } from '@/lib/world-radar';

export default async function SmallCapsPage() {
  const data = await getDashboardData();
  const momentumBySymbol = Object.fromEntries(data.signals.map((s) => [s.symbol, s.score]));

  const scored = scoreThemeCompanies(undefined, momentumBySymbol).filter(
    (c) => c.sizeBucket === 'small' || c.sizeBucket === 'micro',
  );
  const buckets = bucketSmallCaps(scored);
  const themesBySlug = Object.fromEntries(getThemes().map((t) => [t.slug, { name: t.name, emoji: t.emoji }]));
  const research = buildSmallCapResearchBackend(data.signals);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-md p-3">
          <h1 className="text-sm font-semibold text-[#eef3f8]">Small-Cap Discovery</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#a8b5c2]">
            Small and micro caps ranked by the deterministic opportunity engine - theme fit, bottleneck exposure,
            evidence on record, financial quality and the momentum scanner, with hype, dilution and crowding applied as
            penalties. Filter by theme and tap any name for the full breakdown.
          </p>
        </section>

        <SmallCapDiscovery buckets={buckets} themesBySlug={themesBySlug} research={research} />

        <p className="text-[10px] text-[#6f7d8a]">
          Research only - not financial advice. Scores are deterministic research rankings, not recommendations.
        </p>
      </div>
    </AppShell>
  );
}
