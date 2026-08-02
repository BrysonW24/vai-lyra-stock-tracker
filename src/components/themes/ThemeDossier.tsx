'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import {
  ACTION_TONE,
  FILING_CAVEAT,
  MATURITY_TONE,
  SIZE_LABEL,
  type CapitalEvent,
  type Investor,
  type InvestorAction,
  type ScoredCompany,
  type SupplyChainNode,
  type Theme,
} from '@/lib/world-radar';

interface ThemeDossierProps {
  theme: Theme;
  nodes: SupplyChainNode[];
  companies: ScoredCompany[];
  events: CapitalEvent[];
  investors: Investor[];
}

const MOVE_TONE: Record<InvestorAction, string> = {
  new: 'border-positive/40 bg-positive-tint text-positive',
  increase: 'border-positive/40 bg-positive-tint text-positive',
  reduce: 'border-accent-border bg-accent-tint text-accent',
  exit: 'border-negative/40 bg-negative/10 text-negative-soft',
  hold: 'border-line-hair bg-panel text-ink-2',
};

function scoreTone(total: number): string {
  if (total >= 70) return 'text-positive';
  if (total >= 55) return 'text-accent';
  return 'text-ink-2';
}

function formatUsdM(amount?: number): string | null {
  if (amount === undefined) return null;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}B`;
  return `$${Math.round(amount)}M`;
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-title">{title}</h2>
      {meta ? <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">{meta}</span> : null}
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded border border-line bg-panel p-1.5">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
        <p className="font-mono text-[10px] font-semibold" style={{ color }}>
          {value}
        </p>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DetailBlock({ label, body, tone = 'text-ink-3' }: { label: string; body: string; tone?: string }) {
  return (
    <div>
      <p className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{label}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-title">{body}</p>
    </div>
  );
}

function RiskList({ risks }: { risks: string[] }) {
  return (
    <ul className="mt-0.5 space-y-0.5">
      {risks.map((r) => (
        <li key={r} className="text-[10px] leading-snug text-ink-2">
          • {r}
        </li>
      ))}
    </ul>
  );
}

/**
 * Full theme dossier - thesis, score strip, why-now vs falsifier, bottlenecks,
 * supply chain (layered accordion), ranked companies (accordion with the full
 * deterministic opportunity breakdown), capital events, tracked-investor activity
 * and risks. Research surface only - every number is a deterministic ranking.
 */
export function ThemeDossier({ theme, nodes, companies, events, investors }: ThemeDossierProps) {
  const [openNode, setOpenNode] = useState<string | null>(null);
  const [openCompany, setOpenCompany] = useState<string | null>(null);

  const sortedNodes = [...nodes].sort((a, b) => a.layer - b.layer);
  const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const themeSymbols = new Set(companies.map((c) => c.symbol));

  const scoreTiles: { label: string; value: number; tone: string }[] = [
    { label: 'Confidence', value: theme.confidence, tone: 'text-ink' },
    { label: 'Momentum', value: theme.momentum, tone: 'text-ink' },
    { label: 'Capital flow', value: theme.capitalFlow, tone: 'text-ink' },
    { label: 'Policy', value: theme.policySupport, tone: 'text-ink' },
    { label: 'Small-cap opp', value: theme.smallCapOpportunity, tone: 'text-ink' },
    { label: 'Crowding risk', value: theme.crowdingRisk, tone: theme.crowdingRisk >= 60 ? 'text-negative-soft' : 'text-ink' },
  ];

  return (
    <div className="space-y-3">
      {/* a) Header */}
      <section className="terminal-panel rounded-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg leading-none">{theme.emoji}</span>
          <h1 className="text-sm font-semibold text-ink">{theme.name}</h1>
          <div className="ml-auto flex flex-wrap gap-1">
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${MATURITY_TONE[theme.maturity]}`}>
              {theme.maturity}
            </span>
            <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2">
              {theme.horizon}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm leading-snug text-ink-title">{theme.thesis}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-2">{theme.thesisLong}</p>
      </section>

      {/* b) Score strip */}
      <section className="grid grid-cols-3 gap-1.5 md:grid-cols-6">
        {scoreTiles.map((tile) => (
          <div className="terminal-panel rounded-panel p-2" key={tile.label}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{tile.label}</p>
            <p className={`mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tile.tone}`}>{tile.value}</p>
          </div>
        ))}
      </section>

      {/* c) Why now + falsifier */}
      <section className="grid gap-1.5 sm:grid-cols-2">
        <div className="terminal-panel rounded-panel p-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-positive">Why now</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-title">{theme.whyNow}</p>
        </div>
        <div className="terminal-panel rounded-panel border border-negative/40 p-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-negative-soft">What would prove this wrong</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-title">{theme.falsifier}</p>
        </div>
      </section>

      {/* d) Bottlenecks */}
      <section className="terminal-panel rounded-panel p-2.5">
        <SectionTitle title="Physical bottlenecks" meta={`${theme.bottlenecks.length}`} />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {theme.bottlenecks.map((b) => (
            <span key={b} className="rounded border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[9px] text-accent">
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* e) Supply chain */}
      <section className="terminal-panel rounded-panel p-3">
        <SectionTitle title="Supply chain" meta={`${sortedNodes.length} nodes · layer 1 = demand end`} />
        <div className="mt-2 space-y-1.5">
          {sortedNodes.length === 0 && <p className="text-[10px] text-ink-3">No supply-chain nodes mapped for this theme yet.</p>}
          {sortedNodes.map((node) => {
            const open = openNode === node.id;
            return (
              <div key={node.id} className="overflow-hidden rounded-cell border border-line bg-panel-deep">
                <button
                  type="button"
                  onClick={() => setOpenNode(open ? null : node.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition hover:bg-panel"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-blue-deep bg-blue-tint font-mono text-[10px] font-semibold text-pending">
                      {node.layer}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-[12px] font-semibold text-ink">{node.name}</p>
                        {node.bottleneck >= 70 && (
                          <span className="shrink-0 rounded border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-accent">
                            Bottleneck
                          </span>
                        )}
                      </div>
                      {!open && <p className="truncate text-[10px] text-ink-3">{node.description}</p>}
                    </div>
                  </div>
                  <ChevronDown size={14} className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="space-y-2 border-t border-line px-2.5 py-2">
                    <p className="text-[10px] leading-snug text-ink-3">{node.description}</p>
                    <DetailBlock label="Why it matters" body={node.whyItMatters} tone="text-pending" />
                    <div className="grid grid-cols-3 gap-1.5">
                      <MiniBar label="Scarcity" value={node.scarcity} color="var(--lyra-blue-info)" />
                      <MiniBar label="Bottleneck" value={node.bottleneck} color="var(--lyra-accent)" />
                      <MiniBar label="Pricing power" value={node.pricingPower} color="var(--lyra-positive)" />
                    </div>
                    {node.commodities.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3">Commodities</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {node.commodities.map((c) => (
                            <span key={c} className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {node.risks.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-negative-soft">Risks</p>
                        <RiskList risks={node.risks} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* f) Companies */}
      <section className="terminal-panel rounded-panel p-3">
        <SectionTitle title="Companies" meta={`${companies.length} ranked`} />
        <div className="mt-2 space-y-1.5">
          {companies.length === 0 && <p className="text-[10px] text-ink-3">No companies mapped to this theme yet.</p>}
          {companies.map((company) => {
            const open = openCompany === company.symbol;
            return (
              <div key={company.symbol} className="overflow-hidden rounded-cell border border-line bg-panel-deep">
                <button
                  type="button"
                  onClick={() => setOpenCompany(open ? null : company.symbol)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition hover:bg-panel"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <TickerLogo symbol={company.symbol} companyName={company.name} size={13} />
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">{company.symbol}</span>
                    <span className="min-w-0 truncate text-[10px] text-ink-3">{company.name}</span>
                    <span className="hidden shrink-0 rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2 sm:inline">
                      {SIZE_LABEL[company.sizeBucket]}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`font-mono text-sm font-semibold ${scoreTone(company.score.total)}`}>{company.score.total}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${ACTION_TONE[company.score.action]}`}>
                      {company.score.action}
                    </span>
                    <ChevronDown size={14} className={`text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-line px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
                        {SIZE_LABEL[company.sizeBucket]}
                      </span>
                      <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
                        {company.exposure}
                      </span>
                      <span className="rounded border border-blue-info/40 bg-blue-tint px-1.5 py-0.5 font-mono text-[9px] text-blue-info">
                        {company.score.state}
                      </span>
                    </div>
                    <DetailBlock label="Why it matters" body={company.whyItMatters} tone="text-pending" />
                    <DetailBlock label="Evidence" body={company.evidenceSummary} tone="text-positive" />
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      {(
                        [
                          ['Theme fit', company.score.themeFit, 'text-ink-title'],
                          ['Bottleneck', company.score.bottleneck, 'text-ink-title'],
                          ['Evidence', company.score.evidence, 'text-ink-title'],
                          ['Momentum', company.score.momentum, 'text-ink-title'],
                          ['Quality', company.score.financialQuality, 'text-ink-title'],
                          ['Capital', company.score.capitalFlow, 'text-ink-title'],
                          ['Liquidity', company.score.liquidity, 'text-ink-title'],
                          ['Penalty', -company.score.riskPenalty, 'text-negative-soft'],
                        ] as const
                      ).map(([label, value, tone]) => (
                        <div key={label} className="rounded border border-line bg-panel p-1.5">
                          <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                          <p className={`mt-0.5 font-mono text-[11px] font-semibold ${tone}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {company.risks.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-negative-soft">Risks</p>
                        <RiskList risks={company.risks} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* g) Capital events */}
      <section className="terminal-panel rounded-panel p-3">
        <SectionTitle title="Capital events" meta={`${sortedEvents.length} tracked · newest first`} />
        <div className="mt-2 space-y-1.5">
          {sortedEvents.length === 0 && <p className="text-[10px] text-ink-3">No capital events tracked for this theme yet.</p>}
          {sortedEvents.map((event) => {
            const amount = formatUsdM(event.amountUsdM);
            return (
              <div key={event.id} className="rounded-cell border border-line bg-panel-deep p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] text-ink-3">{event.date}</span>
                  <span className="rounded border border-blue-info/40 bg-blue-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-blue-info">
                    {event.type}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[10px] text-ink-title">
                    {event.actor}
                    {event.beneficiary ? ` -> ${event.beneficiary}` : ''}
                  </span>
                  {amount && <span className="ml-auto shrink-0 font-mono text-[10px] font-semibold text-positive">{amount}</span>}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-ink-2">{event.summary}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* h) Investor activity */}
      {investors.length > 0 && (
        <>
          <section className="terminal-panel rounded-panel p-3">
            <SectionTitle title="Investor activity" meta={`${investors.length} tracked managers`} />
            <div className="mt-2 space-y-1.5">
              {investors.map((investor) => {
                const moves = investor.moves.filter((m) => themeSymbols.has(m.symbol));
                if (moves.length === 0) return null;
                return (
                  <div key={investor.id} className="rounded-cell border border-line bg-panel-deep p-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-[11px] font-semibold text-ink">{investor.firm}</p>
                      <p className="min-w-0 truncate text-[10px] text-ink-3">{investor.name}</p>
                      <p className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
                        {investor.filingType} · {investor.filingDate}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {moves.map((move) => (
                        <span
                          key={`${investor.id}-${move.symbol}`}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${MOVE_TONE[move.action]}`}
                        >
                          {move.symbol} · {move.action}
                          {move.weightPct !== undefined ? ` · ${move.weightPct}%` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <p className="text-[10px] leading-snug text-ink-3">{FILING_CAVEAT}</p>
        </>
      )}

      {/* i) Risks */}
      <section className="terminal-panel rounded-panel p-3">
        <SectionTitle title="Theme risks" meta={`${theme.risks.length}`} />
        <ul className="mt-2 space-y-1">
          {theme.risks.map((r) => (
            <li key={r} className="text-[11px] leading-snug text-ink-2">
              • {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
