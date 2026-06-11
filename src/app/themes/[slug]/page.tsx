import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ThemeDossier } from '@/components/themes/ThemeDossier';
import { getDashboardData } from '@/lib/data';
import {
  getCapitalEvents,
  getInvestorsForTheme,
  getNodesForTheme,
  getTheme,
  getThemes,
  scoreThemeCompanies,
} from '@/lib/world-radar';

export function generateStaticParams(): { slug: string }[] {
  return getThemes().map((theme) => ({ slug: theme.slug }));
}

export default async function ThemeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) {
    notFound();
  }

  const data = await getDashboardData();
  const momentumBySymbol = Object.fromEntries(data.signals.map((s) => [s.symbol, s.score] as const));

  const nodes = getNodesForTheme(slug);
  const companies = scoreThemeCompanies(slug, momentumBySymbol);
  const events = getCapitalEvents(slug);
  const themeSymbols = new Set(companies.map((c) => c.symbol));
  const investors = getInvestorsForTheme(slug).filter((investor) =>
    investor.moves.some((move) => themeSymbols.has(move.symbol)),
  );

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <Link
          href="/themes"
          className="inline-flex items-center gap-1 font-mono text-xs text-[#8190a0] transition hover:text-[#eef3f8]"
        >
          <ArrowLeft size={12} /> World Radar
        </Link>

        <ThemeDossier theme={theme} nodes={nodes} companies={companies} events={events} investors={investors} />

        <p className="text-[10px] text-[#6f7d8a]">
          Research only - not financial advice. Scores are deterministic research rankings, not recommendations.
        </p>
      </div>
    </AppShell>
  );
}
