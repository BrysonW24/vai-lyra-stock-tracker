import { AppShell } from '@/components/AppShell';
import { ThemeRadar } from '@/components/themes/ThemeRadar';
import { getDashboardData } from '@/lib/data';
import { getCapitalEvents, getThemes, scoreThemeCompanies } from '@/lib/world-radar';

export default async function ThemesPage() {
  const data = await getDashboardData();
  const momentumBySymbol: Record<string, number> = Object.fromEntries(
    data.signals.map((s): [string, number] => [s.symbol, s.score]),
  );

  const themes = getThemes();

  const topBySlug: Record<string, { symbol: string; total: number }[]> = {};
  const latestEventBySlug: Record<string, { summary: string; date: string } | null> = {};
  for (const theme of themes) {
    topBySlug[theme.slug] = scoreThemeCompanies(theme.slug, momentumBySymbol)
      .slice(0, 3)
      .map((c) => ({ symbol: c.symbol, total: c.score.total }));
    const latest = getCapitalEvents(theme.slug)[0];
    latestEventBySlug[theme.slug] = latest ? { summary: latest.summary, date: latest.date } : null;
  }

  const themeNameBySlug: Record<string, string> = Object.fromEntries(
    themes.map((t): [string, string] => [t.slug, t.name]),
  );
  const newestEvents = getCapitalEvents().slice(0, 8);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <ThemeRadar themes={themes} topBySlug={topBySlug} latestEventBySlug={latestEventBySlug} />

        <section className="terminal-panel rounded-md p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#f3a33a]">
              Capital is moving here
            </h2>
            <p className="text-[10px] text-[#6f7d8a]">Newest disclosed commitments across tracked themes</p>
          </div>

          <div className="mt-1.5">
            {newestEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 border-b border-[#1b2530] py-1.5 last:border-b-0">
                <span className="shrink-0 font-mono text-[9px] text-[#8190a0]">{e.date}</span>
                <p className="min-w-0 flex-1 truncate text-[11px] text-[#c8d3de]">
                  {e.actor}
                  {e.beneficiary ? ` -> ${e.beneficiary}` : ''}
                </p>
                {typeof e.amountUsdM === 'number' && (
                  <span className="shrink-0 font-mono text-[10px] font-semibold text-[#43d18b]">
                    ${e.amountUsdM.toLocaleString('en-US', { maximumFractionDigits: 0 })}m
                  </span>
                )}
                <span className="max-w-[96px] shrink-0 truncate rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#a8b5c2]">
                  {themeNameBySlug[e.theme] ?? e.theme}
                </span>
              </div>
            ))}
            {newestEvents.length === 0 && (
              <p className="py-1.5 text-[11px] text-[#8190a0]">No capital events tracked yet.</p>
            )}
          </div>
        </section>

        <p className="text-[10px] text-[#6f7d8a]">
          Research only - not financial advice. Scores are deterministic research rankings, not recommendations.
        </p>
      </div>
    </AppShell>
  );
}
