'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { BRIEFING_CATEGORY_STYLE, briefingDayLabel, type Briefing, type BriefingItem } from '@/lib/briefing';
import { pageTitleClass, panelClass, panelSoftClass, tagPillClass } from '@/lib/ui';

interface BriefingViewProps {
  briefings: Briefing[];
  source: 'live' | 'none';
}

const MODEL_NAMES: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-fable-5-1': 'Claude Fable 5.1',
};

function ItemCard({ item }: { item: BriefingItem }) {
  const style = BRIEFING_CATEGORY_STYLE[item.category];
  return (
    <article className={`${panelClass} space-y-2 p-3`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-base leading-none" aria-hidden="true">
          {style.emoji}
        </span>
        <h3 className="text-sm font-semibold text-ink">{item.headline}</h3>
        <span className={tagPillClass}>{style.label}</span>
        {!item.listed && <span className={tagPillClass}>private</span>}
        {item.catchUp && <span className={tagPillClass}>catch-up</span>}
        {item.lyraSymbols.map((symbol) => (
          <Link key={symbol} href={`/tickers/${symbol}`} className={`${tagPillClass} font-mono`}>
            {symbol}
          </Link>
        ))}
      </header>
      <p className="text-sm text-ink">{item.whatHappened}</p>
      <dl className="space-y-1 text-xs text-ink-muted">
        <div>
          <dt className="inline font-semibold text-ink-soft">Why it matters: </dt>
          <dd className="inline">{item.whyItMatters}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-ink-soft">Risks: </dt>
          <dd className="inline">{item.risks}</dd>
        </div>
        {item.notDisclosed && (
          <div>
            <dt className="inline font-semibold text-ink-soft">Not disclosed: </dt>
            <dd className="inline">{item.notDisclosed}</dd>
          </div>
        )}
      </dl>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {item.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline"
          >
            {source.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ))}
      </p>
    </article>
  );
}

function BriefingBody({ briefing }: { briefing: Briefing }) {
  const model = MODEL_NAMES[briefing.model] ?? briefing.model;
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">
        {briefing.items.length} item{briefing.items.length === 1 ? '' : 's'}, each checked against the source it was taken from
        {briefing.removed > 0 ? ` (${briefing.removed} removed by those checks)` : ''}.
        {model ? ` Researched by ${model}` : ''}
        {briefing.searches > 0 ? ` with ${briefing.searches} searches and ${briefing.pagesOpened} pages opened` : ''}.
      </p>
      {briefing.items.map((item) => (
        <ItemCard key={`${briefing.date}:${item.headline}`} item={item} />
      ))}
      {briefing.ipoNote && (
        <p className={`${panelSoftClass} p-3 text-xs text-ink-muted`}>
          <span aria-hidden="true">🚀 </span>
          <span className="font-semibold text-ink-soft">IPOs: </span>
          {briefing.ipoNote}
        </p>
      )}
    </div>
  );
}

/**
 * BriefingView - tonight's briefing in full, earlier evenings folded behind their dates.
 */
export function BriefingView({ briefings, source }: BriefingViewProps) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [latest, ...earlier] = briefings;

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className={pageTitleClass}>AI Briefing</h1>
        <p className="text-xs text-ink-muted">
          What moved in AI for investors - model releases, AI-related deals and listings, infrastructure, emerging companies -
          researched from the web each evening and checked against the original sources. Research, not advice.
        </p>
        <p className="text-xs text-ink-muted">
          Anyone can get it on Telegram or by email without an account - share{' '}
          <a href="/subscribe" className="text-blue-info hover:underline">
            /subscribe
          </a>
          .
        </p>
      </header>

      {source === 'none' || !latest ? (
        <div className={`${panelClass} p-4 text-sm text-ink-muted`}>
          No briefing yet. The first one goes out at 8pm Sydney, Tuesday to Saturday, and appears here as soon as it is checked.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">{briefingDayLabel(latest.date)}</h2>
            <BriefingBody briefing={latest} />
          </div>

          {earlier.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Earlier</h2>
              {earlier.map((briefing) => {
                const open = openDate === briefing.date;
                return (
                  <div key={briefing.date} className={`${panelSoftClass} p-3`}>
                    <button
                      type="button"
                      onClick={() => setOpenDate(open ? null : briefing.date)}
                      className="flex w-full items-center justify-between text-left text-sm text-ink"
                      aria-expanded={open}
                    >
                      <span>
                        {briefingDayLabel(briefing.date)} · {briefing.items.length} item{briefing.items.length === 1 ? '' : 's'}
                      </span>
                      {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    {open && (
                      <div className="pt-2">
                        <BriefingBody briefing={briefing} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
