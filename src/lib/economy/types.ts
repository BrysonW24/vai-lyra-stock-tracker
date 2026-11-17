/**
 * The Australian economic read - types.
 *
 * Lyra already showed macro NUMBERS (a seven-item ticker of seeded values). The founder's
 * brief (2026-11-18) is the gap after that: "it doesn't actually tell me what it means...
 * when we have a higher amount of government spending, [and] a lower amount of GDP per
 * capita, we're getting more productive by the 2.1% GDP but we're not getting rich with a
 * 0.7 GDP per capita". So this module exists to JOIN indicators, not to list more of them.
 *
 * Three rules, inherited from the honesty audits and the repo doctrine:
 *
 * 1. EVERY FIGURE IS LIVE OR ABSENT. There is no seeded fallback in here. A series that
 *    fails to fetch becomes `provenance: 'unavailable'` with a NaN value and is NAMED in
 *    the read as missing. A macro page that invents a GDP number is worse than no page.
 * 2. THE ENGINE DECIDES, THE COPY EXPLAINS. Verdicts come from documented thresholds over
 *    real values (`read.ts`), never from stored prose. The 2026-08-11 audit deleted the one
 *    hardcoded joined read ("a supportive backdrop for risk") precisely because it survived
 *    any data change. Nothing here may do that: each sentence is assembled from the figures
 *    it cites, so it cannot say "under pressure" when the numbers turn.
 * 3. EVERY CLAIM IS CHECKABLE. Each indicator carries the agency, the exact dataflow/series
 *    key it came from, the period, and the release URL. "Trust us" is not provenance.
 *
 * Research context, never advice - this describes the economy, it does not tell anyone what
 * to do about it.
 */

/** Where a number came from. There is no 'sample': a figure is live or it is absent. */
export type EconomyProvenance = 'live' | 'unavailable';

/** Direction of the latest move. Never coloured good/bad - a rise in unemployment and a rise
 *  in GDP both point up and mean opposite things (the same rule the macro strip follows). */
export type EconomyDirection = 'up' | 'down' | 'flat';

/** How a value should be rendered. Drives formatting only, never meaning. */
export type EconomyUnit = 'percent' | 'percentChange' | 'index' | 'ratio' | 'points';

/** A verdict over a group of indicators. 'unknown' when too much is missing to say. */
export type EconomyVerdict = 'improving' | 'mixed' | 'under-pressure' | 'unknown';

/** One observation in a series. */
export interface EconomyObservation {
  /** Period exactly as the agency labels it: "2026-Q2", "2026-09". Never reformatted away. */
  period: string;
  value: number;
}

/** A single indicator, ready to render and ready to audit. */
export interface EconomyIndicator {
  id: string;
  /** Short label, e.g. "GDP per person". Plain English, not the agency's series name. */
  label: string;
  /** The latest value. NaN when `provenance` is 'unavailable' - never 0 as a stand-in. */
  value: number;
  /** The observation before the latest, for "and before that". NaN when there is none. */
  previous: number;
  unit: EconomyUnit;
  /** Period of `value`, as published. Empty when unavailable. */
  period: string;
  direction?: EconomyDirection;
  provenance: EconomyProvenance;
  /** What this measures - one sentence, read once, no jargon. */
  measures: string;
  /** Publishing agency. */
  agency: 'ABS' | 'RBA';
  /** The exact dataflow + series key (ABS) or table + series id (RBA) behind `value`. */
  seriesKey: string;
  /** The agency's own release page for this series. */
  sourceUrl: string;
  /** Oldest-first recent history. Used for a trend WORD, never a chart (no charts in Simple). */
  history: EconomyObservation[];
  /**
   * Change over a year, computed from the ABS level series (chain volumes or an index) when
   * the registry names one. NaN when there are no levels or not enough history.
   */
  annual: number;
  /** The two periods `annual` spans, e.g. "2025-Q2 to 2026-Q2". Empty when NaN. */
  annualSpan: string;
}

/**
 * One of the questions the read answers. Each is a question a person actually asks, with a
 * sentence built from its own indicators and an explicit note on what it cannot establish.
 */
export interface EconomyQuestion {
  id: string;
  /** The question, phrased as a person would ask it. */
  question: string;
  /** The answer, assembled from the figures in `indicators`. Changes when they change. */
  answer: string;
  verdict: EconomyVerdict;
  /** Ids of the indicators that produced `verdict`, in the order they were weighed. */
  because: string[];
  /** What this reading genuinely cannot tell you. Always populated - every read has limits. */
  cannotTell: string;
  /**
   * What would change this verdict, stated from the thresholds that produced it - so "what to
   * watch" is always true by construction, never a dated release calendar we do not fetch.
   * Empty when the verdict is 'unknown'.
   */
  wouldChange: string;
  indicators: EconomyIndicator[];
}

/** The whole read. */
export interface EconomyRead {
  country: 'Australia';
  /** The joined read in one sentence, built from the real figures it cites. */
  headline: string;
  /** Growth and its drivers. */
  overall: EconomyVerdict;
  /** Whether people are actually getting better off - deliberately separate from growth. */
  livingStandards: EconomyVerdict;
  /** The most recent period across every live indicator, as published. */
  asOf: string;
  questions: EconomyQuestion[];
  /** Labels of indicators that could not be fetched. Shown, never hidden. */
  missing: string[];
  /** True when nothing at all could be fetched - the page says so rather than guessing. */
  empty: boolean;
}
