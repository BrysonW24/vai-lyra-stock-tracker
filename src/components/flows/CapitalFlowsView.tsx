import { Factory, UserRound } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { SourceFavicon } from '@/components/SourceFavicon';
import { HelpDrawer, type HelpTerm } from '@/components/education/HelpDrawer';
import { INSIDER_FLOW_SAMPLE, TX_META, listInsiderFlow } from '@/lib/insider-flow';
import { CAPEX_SAMPLE, KIND_LABEL, listCapex } from '@/lib/capex-events';
import { formatCompactCurrency, formatNumber } from '@/lib/format';

const CAPITAL_FLOWS_TERMS: HelpTerm[] = [
  { term: 'Form 4', what: 'An SEC filing a company insider (director, officer, large holder) must lodge within two business days of buying or selling their own stock. It is prompt, but a single filing proves little on its own.' },
  { term: 'open-market vs planned', what: 'An open-market buy is a discretionary purchase and carries more signal. A planned (10b5-1) sale is pre-scheduled and routine, so it carries far less - read the context, not just the dollar value.' },
  { term: 'cluster', what: 'Several insiders at the same company filing the same direction around the same time. Clustered, repeated open-market buying is a stronger tell than one lone transaction.' },
  { term: '13F', what: 'A quarterly SEC filing where large institutions (>$100M) disclose their US equity holdings. It shows what big money owned at quarter-end - lagged, and blind to shorts and non-US books. Sits on the Investor Radar alongside this view.' },
  { term: 'capex', what: 'Capital expenditure - money a company commits to physical expansion: factory builds, datacentres, procurement, hiring. It moves the outlook before it shows up in earnings.', moduleId: 'free-cash-flow' },
];

const TONE_CLASS: Record<'pos' | 'neg' | 'neutral', string> = {
  pos: 'border-positive/40 bg-positive-tint text-positive',
  neg: 'border-negative/40 bg-negative/10 text-negative-soft',
  neutral: 'border-line-strong bg-panel text-ink-3',
};

function InsiderSection() {
  const rows = listInsiderFlow();
  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-positive">
          <UserRound size={14} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Insider flow · Form 4</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-2">Who bought or sold - read in context (open-market vs planned, clustered, repeated).</p>
        </div>
      </div>
      <div className="divide-y divide-line">
        {rows.map((tx) => {
          const meta = TX_META[tx.txType];
          return (
            <div key={tx.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <TickerLogo symbol={tx.symbol} companyName={tx.companyName} size={14} />
                <span className="font-mono text-[12px] font-semibold text-ink">{tx.symbol}</span>
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>
                {tx.clustered && <span className="rounded border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-accent">cluster</span>}
                <span className="font-mono text-[10px] text-ink-2">{tx.insider} · {tx.role}</span>
                <span className="ml-auto font-mono text-[11px] font-semibold text-ink-title">{formatCompactCurrency(tx.valueUsd)}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-ink-3">{formatNumber(tx.shares, 0)} sh · {tx.pattern} · {tx.date}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-ink-2">{tx.context}</p>
              <a href={tx.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] text-ink-dim transition hover:text-ink-title">
                <SourceFavicon domain="sec.gov" sourceName="SEC EDGAR" /> SEC Form 4
              </a>
            </div>
          );
        })}
      </div>
      {INSIDER_FLOW_SAMPLE && (
        <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
          Illustrative sample until the live Form 3/4/5 feed wires in. Form 4 is prompt but one filing proves little alone. Research only.
        </p>
      )}
    </section>
  );
}

function CapexSection() {
  const events = listCapex();
  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-accent">
          <Factory size={14} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Capex & expansion</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-2">Factory builds, datacentres, procurement + hiring - capex before it hits earnings.</p>
        </div>
      </div>
      <div className="divide-y divide-line">
        {events.map((e) => (
          <div key={e.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-line-strong bg-chrome px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-blue-info">{KIND_LABEL[e.kind]}</span>
              <span className="text-[12px] font-semibold text-ink">{e.recipient}</span>
              <span className="font-mono text-[9px] text-ink-dim">{e.location} · {e.date}</span>
              <span className="ml-auto font-mono text-sm font-semibold text-positive">{e.amount}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-2">{e.summary}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-ink-2"><span className="font-semibold text-positive">Why: </span>{e.why}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">{e.theme}</span>
              {e.tickers.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[10px] text-ink-title">
                  <TickerLogo symbol={t} size={12} /> {t}
                </span>
              ))}
              <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] text-ink-3 transition hover:text-ink-title">
                <SourceFavicon domain={new URL(e.sourceUrl).hostname} sourceName={e.source} /> {e.source}
              </a>
            </div>
          </div>
        ))}
      </div>
      {CAPEX_SAMPLE && (
        <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
          Illustrative sample until live filings / permits / procurement feeds wire in. Research only.
        </p>
      )}
    </section>
  );
}

/**
 * Capital Flows - the ownership-intent + physical-expansion layer: SEC Form-4 insider
 * activity read in context, and the capex/expansion pipeline that moves the outlook before
 * earnings. Sits alongside Investor Radar (13F) and Smart Money. Research only.
 */
export function CapitalFlowsView() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Capital flows - ownership intent + physical expansion</p>
        <HelpDrawer
          title="What the terms mean"
          subtitle="Form 4, 13F, clusters and capex - in plain English"
          ariaLabel="What the capital-flows terms mean"
          intro="This layer reads who is buying or building before it shows up in earnings. Here is what each term on the cards means."
          terms={CAPITAL_FLOWS_TERMS}
          footnote="Insider and capex data are curated research context with source links. Lyra surfaces what is happening and why it matters - it never tells you to buy or sell. Research only."
        />
      </div>
      <InsiderSection />
      <CapexSection />
    </div>
  );
}
