'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Compass } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { HelpDrawer, type HelpTerm } from '@/components/education/HelpDrawer';
import { ACTION_TONE, SIZE_LABEL } from '@/lib/world-radar';
import type { ScoredCompany, SmallCapBucket } from '@/lib/world-radar';
import type { SmallCapResearchBackend, SmallCapResearchCandidate } from '@/lib/small-cap-research';

const AVOID_BUCKET = 'Avoid - dilution/hype risk';
const EMERGING_BUCKET = 'Emerging opportunities';

const SMALL_CAP_TERMS: HelpTerm[] = [
  { term: 'Theme fit', what: 'How squarely the company sits inside its theme thesis - core exposure scores higher than a loose, derivative connection.' },
  { term: 'Bottleneck', what: 'How exposed the company is to a hard-to-replace link in the supply chain, where pricing power tends to concentrate.' },
  { term: 'Evidence', what: 'Strength of the supporting evidence - filings, contracts, spend and disclosures behind the thesis, not just narrative.' },
  { term: 'Momentum', what: 'The technical / price momentum component - whether the name is already turning rather than just cheap.', moduleId: 'momentum-recovery' },
  { term: 'Quality', what: 'Financial-quality score - balance-sheet health, cash position and how sustainably the business is funded.', moduleId: 'free-cash-flow' },
  { term: 'Liquidity', what: 'How easily the stock can be traded. Small caps are thin - low liquidity means wider spreads and harder exits.', moduleId: 'market-cap' },
  { term: 'Capital', what: 'Capital-flow score - whether money (institutional, government, deals) is rotating into the name.' },
  { term: 'Penalty', what: 'A negative deduction for risk flags - dilution, hype, governance or single-point-of-failure exposure. It drags the total down.' },
  { term: 'Gov / Vol / Tech / Risk', what: 'The research-candidate sub-scores: Government spend exposure, Buyer-volume signal, Technical setup, and a negative Risk penalty.' },
  { term: 'Paper bot ready', what: 'The candidate clears the bar to be tracked by a paper-only (simulated, no real money) trading bot. It is a research flag, never a trade instruction.' },
  { term: 'Avoid - dilution/hype risk', what: 'A bucket for names where the risk penalty dominates - heavy share issuance, promotional hype or weak fundamentals outweigh the opportunity.' },
];

interface ThemeMeta {
  name: string;
  emoji: string;
}

interface SmallCapDiscoveryProps {
  buckets: SmallCapBucket[];
  themesBySlug: Record<string, ThemeMeta>;
  research: SmallCapResearchBackend;
}

/** Deterministic tone for the 0-100 opportunity total. */
function scoreTone(total: number): string {
  if (total >= 72) return 'text-positive';
  if (total >= 58) return 'text-accent';
  if (total >= 45) return 'text-ink-2';
  return 'text-negative-soft';
}

interface CompanyRowProps {
  company: ScoredCompany;
  theme: ThemeMeta;
  open: boolean;
  onToggle: () => void;
}

function CompanyRow({ company, theme, open, onToggle }: CompanyRowProps) {
  const s = company.score;
  const breakdown: { label: string; value: string; tone: string }[] = [
    { label: 'Theme fit', value: String(s.themeFit), tone: 'text-ink' },
    { label: 'Bottleneck', value: String(s.bottleneck), tone: 'text-ink' },
    { label: 'Evidence', value: String(s.evidence), tone: 'text-ink' },
    { label: 'Momentum', value: String(s.momentum), tone: 'text-ink' },
    { label: 'Quality', value: String(s.financialQuality), tone: 'text-ink' },
    { label: 'Liquidity', value: String(s.liquidity), tone: 'text-ink' },
    { label: 'Capital', value: String(s.capitalFlow), tone: 'text-ink' },
    { label: 'Penalty', value: `-${s.riskPenalty}`, tone: 'text-negative-soft' },
  ];

  return (
    <div className="overflow-hidden rounded-cell border border-line bg-panel-deep">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-panel"
      >
        <TickerLogo symbol={company.symbol} companyName={company.name} size={13} />
        <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">{company.symbol}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-ink-3">{company.name}</span>
        <span className="shrink-0 text-[10px]" title={theme.name} aria-hidden>
          {theme.emoji}
        </span>
        <span className={`numeric shrink-0 font-mono text-sm font-semibold ${scoreTone(s.total)}`}>{s.total}</span>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${ACTION_TONE[s.action]}`}>
          {s.action}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-line px-2.5 py-2 text-[11px] leading-snug">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3">Why it matters</p>
            <p className="mt-0.5 text-ink-title">{company.whyItMatters}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3">Evidence</p>
            <p className="mt-0.5 text-ink-title">{company.evidenceSummary}</p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {breakdown.map((cell) => (
              <div key={cell.label} className="rounded-cell border border-line-strong bg-panel p-1.5">
                <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{cell.label}</p>
                <p className={`numeric mt-0.5 font-mono text-xs font-semibold ${cell.tone}`}>{cell.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${ACTION_TONE[s.action]}`}>
              {s.state}
            </span>
            <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2">
              {SIZE_LABEL[company.sizeBucket]}
            </span>
            <Link
              href={`/themes/${company.theme}`}
              className="rounded border border-blue-info/40 bg-blue-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-blue-info transition hover:bg-blue/15"
            >
              Theme dossier {'->'}
            </Link>
          </div>

          {company.risks.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-negative-soft">Risks</p>
              <ul className="mt-0.5 space-y-0.5">
                {company.risks.map((risk) => (
                  <li key={risk} className="text-[10px] text-ink-title">
                    - {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResearchCandidateRow({ candidate }: { candidate: SmallCapResearchCandidate }) {
  const scoreCells = [
    ['Gov', candidate.score.governmentScore],
    ['Vol', candidate.score.buyerVolumeScore],
    ['Tech', candidate.score.technicalScore],
    ['Risk', -candidate.score.riskPenalty],
  ] as const;

  return (
    <div className="rounded-cell border border-line bg-panel-deep p-2">
      <div className="flex items-center gap-2">
        <TickerLogo symbol={candidate.symbol} companyName={candidate.name} size={14} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12px] font-semibold text-ink">
            {candidate.symbol} <span className="font-sans text-[10px] font-normal text-ink-3">{candidate.name}</span>
          </p>
          <p className="truncate text-[10px] text-ink-3">{candidate.vertical}</p>
        </div>
        <span className={`numeric font-mono text-base font-semibold ${scoreTone(candidate.score.totalScore)}`}>
          {candidate.score.totalScore}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {scoreCells.map(([label, value]) => (
          <div key={label} className="rounded border border-line-strong bg-panel px-1.5 py-1">
            <p className="text-[8px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
            <p className={`numeric font-mono text-[11px] font-semibold ${value >= 0 ? 'text-ink' : 'text-negative-soft'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-ink-2">{candidate.evidenceSummary}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2">
          {candidate.researchState}
        </span>
        {candidate.paperBot.eligible ? (
          <Link
            href={candidate.paperBot.route}
            className="rounded border border-positive/40 bg-positive-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-positive transition hover:bg-positive/15"
          >
            Paper bot ready
          </Link>
        ) : (
          <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">
            Paper bot watch
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Small-cap discovery engine. Deterministic buckets from world-radar rendered as dense
 * inline accordions, with client-side theme filtering. Research surface only - no
 * output here is a buy or sell call.
 */
export function SmallCapDiscovery({ buckets, themesBySlug, research }: SmallCapDiscoveryProps) {
  const [activeTheme, setActiveTheme] = useState<string>('all');
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);

  const themeSlugs = useMemo(() => {
    const slugs: string[] = [];
    for (const bucket of buckets) {
      for (const company of bucket.items) {
        if (!slugs.includes(company.theme)) slugs.push(company.theme);
      }
    }
    return slugs;
  }, [buckets]);

  const visibleBuckets = useMemo(() => {
    const rest = buckets.filter((b) => b.bucket !== AVOID_BUCKET);
    const avoid = buckets.filter((b) => b.bucket === AVOID_BUCKET);
    return [...rest, ...avoid]
      .map((b) => ({
        ...b,
        items: activeTheme === 'all' ? b.items : b.items.filter((c) => c.theme === activeTheme),
      }))
      .filter((b) => b.items.length > 0);
  }, [buckets, activeTheme]);

  const namesTracked = visibleBuckets.reduce((n, b) => n + b.items.length, 0);
  const emergingNow = visibleBuckets.find((b) => b.bucket === EMERGING_BUCKET)?.items.length ?? 0;
  const flaggedRisky = visibleBuckets.find((b) => b.bucket === AVOID_BUCKET)?.items.length ?? 0;

  const themeMeta = (slug: string): ThemeMeta => themesBySlug[slug] ?? { name: slug, emoji: '' };

  return (
    <div className="space-y-3">
      <section className="terminal-panel rounded-panel p-3">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-positive" />
          <h2 className="text-sm font-semibold text-ink">Research backend</h2>
          <span className="ml-auto rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-3">
            {research.sources.filter((source) => source.integration === 'live-now').length} live / {research.sources.length} mapped
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-ink-3">
          Official spend, filings, buyer-volume and technical markers are blended into a paper-only research queue.
        </p>

        <div className="mt-2 grid gap-2 lg:grid-cols-3">
          {research.candidates.slice(0, 6).map((candidate) => (
            <ResearchCandidateRow key={candidate.symbol} candidate={candidate} />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {research.sources.slice(0, 5).map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-line-strong bg-panel px-2 py-0.5 font-mono text-[9px] text-ink-3 transition hover:text-ink-title"
            >
              {source.name}
            </a>
          ))}
        </div>
      </section>

      <section className="terminal-panel rounded-panel p-3">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-blue-info" />
          <h2 className="text-sm font-semibold text-ink">Discovery engine</h2>
          <HelpDrawer
            title="What the scores mean"
            subtitle="The small-cap discovery score, by component"
            ariaLabel="What the small-cap discovery scores mean"
            intro="Each name carries a deterministic 0-100 opportunity score built from these components, minus a risk penalty. Here is what each one reads."
            terms={SMALL_CAP_TERMS}
            footnote="Discovery ranks are deterministic research scores - small caps carry real liquidity and dilution risk. Nothing here is a buy or sell call. Research only."
          />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {([
            ['Names tracked', namesTracked, 'text-ink'],
            ['Emerging now', emergingNow, 'text-positive'],
            ['Flagged risky', flaggedRisky, 'text-negative-soft'],
          ] as const).map(([label, value, tone]) => (
            <div key={label} className="rounded-cell border border-line-strong bg-panel p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
              <p className={`numeric mt-0.5 font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTheme('all')}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition ${
              activeTheme === 'all'
                ? 'border-blue-deep bg-blue-tint text-pending'
                : 'border-line bg-panel text-ink-3 hover:text-ink-title'
            }`}
          >
            All
          </button>
          {themeSlugs.map((slug) => {
            const meta = themeMeta(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => setActiveTheme(slug)}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] transition ${
                  activeTheme === slug
                    ? 'border-blue-deep bg-blue-tint text-pending'
                    : 'border-line bg-panel text-ink-3 hover:text-ink-title'
                }`}
              >
                {meta.emoji} {meta.name}
              </button>
            );
          })}
        </div>
      </section>

      {visibleBuckets.length === 0 && (
        <section className="terminal-panel rounded-panel p-3">
          <p className="text-[11px] text-ink-2">No names match this theme filter yet.</p>
        </section>
      )}

      {visibleBuckets.map((bucket) => {
        const isAvoid = bucket.bucket === AVOID_BUCKET;
        return (
          <section key={bucket.bucket} className="terminal-panel rounded-panel p-3">
            <div className="flex items-center gap-2">
              <h3 className={`text-[12px] font-semibold ${isAvoid ? 'text-negative-soft' : 'text-ink'}`}>
                {bucket.bucket}
              </h3>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${
                  isAvoid
                    ? 'border-negative/40 bg-negative/10 text-negative-soft'
                    : 'border-line-strong bg-panel text-ink-3'
                }`}
              >
                {bucket.items.length}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-ink-3">{bucket.blurb}</p>

            <div className="mt-2 space-y-1.5">
              {bucket.items.map((company) => (
                <CompanyRow
                  key={company.symbol}
                  company={company}
                  theme={themeMeta(company.theme)}
                  open={openSymbol === company.symbol}
                  onToggle={() => setOpenSymbol(openSymbol === company.symbol ? null : company.symbol)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-[10px] leading-snug text-ink-dim">
        Discovery ranks are deterministic research scores built on evidence, bottleneck exposure and risk penalties -
        small caps carry real liquidity and dilution risk.
      </p>
    </div>
  );
}
