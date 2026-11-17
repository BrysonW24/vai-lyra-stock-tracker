import { ArrowUpRight } from 'lucide-react';
import { periodLabel } from '@/lib/economy/period';
import { THRESHOLDS } from '@/lib/economy/read';
import type { EconomyIndicator, EconomyQuestion, EconomyRead } from '@/lib/economy/types';
import { VerdictChip } from '@/components/economy/VerdictChip';
import { QUESTION_SHORT, primaryFigure, secondaryFigure } from '@/components/economy/economy-format';

/**
 * The Australian economy, read as a whole (founder brief 2026-11-18: the numbers were there,
 * "however it doesn't actually tell me what it means").
 *
 * Layout follows the brief's own shape - what happened, why, who feels it, what to watch -
 * and Simple view's rules: no charts, nothing that moves, plain words first, the evidence one
 * tap down. Every figure links to the agency that published it.
 */

const CONTRIBUTION_IDS = new Set([
  'contribHousehold',
  'contribPrivateInvestment',
  'contribGovernment',
  'contribPublicInvestment',
  'contribExports',
]);

function IndicatorRow({ indicator }: { indicator: EconomyIndicator }) {
  const unavailable = indicator.provenance !== 'live';
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[13px] font-medium text-ink-title">{indicator.label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{indicator.measures}</p>
      </div>
      {/* Phone: the figure wraps under the label, full width and left-aligned so it reads
          straight down. Wider: it sits beside the label, right-aligned like a ledger. */}
      <div className="w-full sm:w-auto sm:shrink-0 sm:text-right">
        <p className={`font-mono text-[13px] font-semibold ${unavailable ? 'text-ink-dim' : 'text-ink-title'}`}>
          {primaryFigure(indicator)}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-3">{secondaryFigure(indicator)}</p>
      </div>
    </li>
  );
}

function SourceList({ indicators }: { indicators: EconomyIndicator[] }) {
  return (
    <details className="group mt-3 rounded-cell border border-line bg-well/40 px-3 py-2">
      <summary className="cursor-pointer select-none text-[12px] font-medium text-ink-3 transition hover:text-ink-2">
        Where these numbers come from
      </summary>
      <ul className="mt-2 space-y-1.5">
        {indicators.map((i) => (
          <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] text-ink-3">
            <span className="min-w-0">
              <span className="text-ink-2">{i.label}</span>
              {' - '}
              <span className="font-mono">{i.seriesKey}</span>
              {i.period && <span>{` - ${periodLabel(i.period)}`}</span>}
              {i.annualSpan && <span>{` (yearly change ${i.annualSpan})`}</span>}
            </span>
            {i.sourceUrl && (
              <a
                href={i.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-0.5 text-ink-2 underline-offset-2 hover:text-accent hover:underline"
              >
                {i.agency} release <ArrowUpRight size={11} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function QuestionCard({ question }: { question: EconomyQuestion }) {
  const contributions = question.indicators.filter((i) => CONTRIBUTION_IDS.has(i.id));
  const main = question.indicators.filter((i) => !CONTRIBUTION_IDS.has(i.id));
  const quarter = contributions.find((i) => i.period)?.period;
  return (
    <section id={question.id} className="terminal-panel scroll-mt-24 overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold text-ink-title">{question.question}</h2>
        <VerdictChip verdict={question.verdict} />
      </div>
      <div className="px-4 py-3">
        <p className="text-[14px] leading-relaxed text-ink-2">{question.answer}</p>

        {main.length > 0 && (
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {main.map((i) => (
              <IndicatorRow key={i.id} indicator={i} />
            ))}
          </ul>
        )}

        {contributions.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] font-medium text-ink-2">
              Where the {quarter ? periodLabel(quarter) : 'latest quarter'}&apos;s growth came from
            </p>
            <p className="text-[11px] text-ink-3">Percentage points of that quarter&apos;s growth. Imports and stock changes are not listed.</p>
            <ul className="mt-1 divide-y divide-line">
              {contributions.map((i) => (
                <IndicatorRow key={i.id} indicator={i} />
              ))}
            </ul>
          </div>
        )}

        {question.wouldChange && (
          <p className="mt-3 text-[12px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink-title">What would change this: </span>
            {question.wouldChange}
          </p>
        )}
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          <span className="font-medium text-ink-2">What this cannot tell you: </span>
          {question.cannotTell}
        </p>
        <SourceList indicators={question.indicators} />
      </div>
    </section>
  );
}

/** "June quarter 2026 national accounts, September 2026 jobs and prices, October 2026 cash rate". */
function freshness(read: EconomyRead): string {
  const find = (qid: string, iid: string) =>
    read.questions.find((q) => q.id === qid)?.indicators.find((i) => i.id === iid && i.provenance === 'live');
  const parts: string[] = [];
  const gdp = find('growth', 'gdp');
  if (gdp) parts.push(`${periodLabel(gdp.period)} national accounts`);
  const jobs = find('jobs', 'unemployment');
  const cpi = find('prices', 'cpi') ?? find('prices', 'cpiTrimmed');
  if (jobs && cpi && jobs.period === cpi.period) parts.push(`${periodLabel(jobs.period)} jobs and prices`);
  else {
    if (jobs) parts.push(`${periodLabel(jobs.period)} jobs`);
    if (cpi) parts.push(`${periodLabel(cpi.period)} prices`);
  }
  const cash = find('prices', 'cashRate');
  if (cash) parts.push(`${periodLabel(cash.period)} cash rate`);
  return parts.join(', ');
}

export function EconomyReport({ read }: { read: EconomyRead }) {
  if (read.empty) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel rounded-panel px-4 py-5">
          <h1 className="text-[18px] font-semibold text-ink-title">Australia&apos;s economy</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Lyra could not reach the Australian Bureau of Statistics or the Reserve Bank just now, so there is nothing to
            read yet. It does not fill the gap with old or made-up figures - try again shortly.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <a className="text-ink-2 hover:text-accent" href="https://www.abs.gov.au/statistics/economy" target="_blank" rel="noopener noreferrer">
              ABS economy statistics
            </a>
            <a className="text-ink-2 hover:text-accent" href="https://www.rba.gov.au/statistics/" target="_blank" rel="noopener noreferrer">
              RBA statistics
            </a>
          </p>
        </section>
      </div>
    );
  }

  const when = freshness(read);
  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-28 xl:pb-6">
      <section className="terminal-panel overflow-hidden rounded-panel">
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold text-ink-title">Australia&apos;s economy</h1>
            <span className="rounded-full border border-positive/40 bg-positive-tint px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-positive">
              Live - ABS and RBA
            </span>
          </div>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-title">{read.headline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {read.questions.map((q) => (
              <a key={q.id} href={`#${q.id}`} className="rounded-full transition hover:opacity-80">
                <VerdictChip verdict={q.verdict} prefix={QUESTION_SHORT[q.id] ?? q.id} />
              </a>
            ))}
          </div>
          {when && <p className="mt-3 text-[12px] text-ink-3">Latest figures: {when}.</p>}
          {read.missing.length > 0 && (
            <p className="mt-2 text-[12px] text-pending">
              Not loaded this time: {read.missing.join(', ')}. The read leaves them out rather than guess.
            </p>
          )}
        </div>
      </section>

      {read.questions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}

      <section className="terminal-panel overflow-hidden rounded-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-ink-title">How to read these numbers</h2>
        </div>
        <div className="space-y-3 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <p>
            <span className="font-medium text-ink-title">Bigger is not the same as better off. </span>
            GDP measures everything the country produces. It can grow just because there are more people. Output per person
            is the share each of us gets, and real income per person is closer still to what we can actually afford.
          </p>
          <p>
            <span className="font-medium text-ink-title">More output is not the same as more productive. </span>
            Productivity is output per hour worked. Output can rise because more hours are worked while each hour produces
            no more than before. Over time, productivity is what lets wages rise without prices rising with them.
          </p>
          <p>
            <span className="font-medium text-ink-title">Falling inflation still means rising prices. </span>
            Inflation easing from 4% to 3% means prices are still going up - just more slowly. Real wages compare pay rises
            with price rises over the same year.
          </p>
          <p>
            <span className="font-medium text-ink-title">Government spending is not good or bad on its own. </span>
            Lyra shows how much public and private demand added to growth. It cannot show whether the spending was worthwhile,
            how it was paid for, or whether it pushed private activity out.
          </p>
        </div>
      </section>

      <details className="terminal-panel group overflow-hidden rounded-panel">
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-medium text-ink-2 hover:text-ink-title">
          The rules Lyra reads by
        </summary>
        <div className="space-y-1.5 border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-3">
          <p>Each verdict comes from fixed rules over the published figures. The same figures always give the same read.</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Growth reads healthy at {THRESHOLDS.gdpAnnualSolid}% or more a year in total and {THRESHOLDS.perPersonAnnualSolid}% or
              more per person, and under pressure if either total output or output per person shrinks.
            </li>
            <li>
              Living standards weigh real income per person, real wages and output per hour. Real wages within{' '}
              {THRESHOLDS.realWageFlatBand} points of zero count as flat. Output per hour counts as a gain at{' '}
              {THRESHOLDS.productivitySolid}% a year or more, and as a loss below zero.
            </li>
            <li>
              Jobs read weak at {THRESHOLDS.unemploymentWeak}% unemployment, or when the three-month average climbs{' '}
              {THRESHOLDS.unemploymentRiseWarning} points above the recent low, and healthy below{' '}
              {THRESHOLDS.unemploymentHealthy}% when it is not rising.
            </li>
            <li>
              Inflation is judged on the trimmed mean against the RBA&apos;s {THRESHOLDS.targetLow}-{THRESHOLDS.targetHigh}% target
              band.
            </li>
          </ul>
          <p>
            Figures are fetched from the ABS Data API and the RBA&apos;s statistical tables and refreshed every few hours.
            Research context, not financial advice. Lyra does not forecast the economy or RBA decisions.
          </p>
        </div>
      </details>
    </div>
  );
}
