/**
 * The answer Lyra gives when no model can: the engine's own figures, without commentary.
 *
 * The free pool of open models is a daily allowance, and it runs out. "Try again later" would
 * leave someone who asked about their book with nothing - but the answer to most questions is
 * mostly figures the engine has already computed, and those need no model. So when the pool cannot
 * answer, chat says so in one line and prints what the dashboard holds for the tickers the question
 * named (or for the reader's own book, or the day's brief when it named none).
 *
 * Three things it will not do:
 *   * PRINT A SAMPLE AS A FIGURE. The no-account screen keeps an authored sample row on display
 *     when a live recompute fails (`SignalRow.sample`). Those rows are never printed here, and the
 *     day's brief is only used when its market backdrop is live.
 *   * ANSWER A DIFFERENT QUESTION. Asked about a ticker the scan has no live figures for, it says
 *     so. It does not offer the reader's book, or anything else, in its place.
 *   * HAND OUT A SHORTLIST. With nothing specific to show it gives the count of setups by status -
 *     never "the highest scores right now", which reads like a list of picks.
 *
 * Everything here is composed by code from scanner rows: there is no model text to guard, and
 * nothing that is not already on the caller's own screen.
 */
import type { DashboardData, SignalRow } from '@/types/scanner';
import type { DailyBrief } from '@/lib/daily-brief';
import { extractSymbols } from '@/lib/ai/question-signals';
import { formatSignedNumber, formatSignedPercent } from '@/lib/format';

const STATUS_WORDS: Record<string, string> = {
  strong_setup: 'strong setup',
  watchlist_setup: 'watchlist setup',
  weakening: 'weakening',
  invalidated: 'invalidated',
  no_signal: 'no signal',
};

/** The order the statuses are counted in - the engine's own, strongest first. */
const STATUS_ORDER: Array<[status: string, one: string, many: string]> = [
  ['strong_setup', 'strong setup', 'strong setups'],
  ['watchlist_setup', 'watchlist setup', 'watchlist setups'],
  ['weakening', 'weakening', 'weakening'],
  ['invalidated', 'invalidated', 'invalidated'],
  ['no_signal', 'with no signal', 'with no signal'],
];

const MAX_NAMES = 4;
const MAX_BRIEF_LINES = 4;

/**
 * Why there is no written answer. `used_up`: the day's free allowance is spent. `unavailable`: the
 * providers are busy, down or misconfigured - the reader is told the truth either way.
 */
export type FiguresReason = 'used_up' | 'unavailable';

export const FIGURES_ONLY_LEADS: Record<FiguresReason, string> = {
  used_up: "Lyra's free answers are used up for the moment, so here are the engine's own figures without commentary.",
  unavailable: "Lyra's free model could not answer just now, so here are the engine's own figures without commentary.",
};
export const FIGURES_ONLY_CLOSE = 'Ask again in a few minutes for a written answer.';

function signalLine(signal: SignalRow): string {
  const status = STATUS_WORDS[signal.status] ?? signal.status.replace(/_/g, ' ');
  return (
    `- ${signal.symbol}: score ${Math.round(signal.score)} (${formatSignedNumber(signal.scoreDelta, 0)}), ${status}, ` +
    `${formatSignedPercent(signal.priceChange1d)} on the day, RSI ${Math.round(signal.rsi)}, volume ${signal.volumeRatio.toFixed(1)}x`
  );
}

/** "On the scan now: 61 names - 3 strong setups, 12 watchlist setups, 16 weakening, ..." */
function countsLine(signals: SignalRow[]): string {
  const parts: string[] = [];
  for (const [status, one, many] of STATUS_ORDER) {
    const count = signals.filter((signal) => signal.status === status).length;
    if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`);
  }
  const names = `${signals.length} ${signals.length === 1 ? 'name' : 'names'}`;
  return parts.length > 0 ? `- On the scan now: ${names} - ${parts.join(', ')}.` : `- On the scan now: ${names}.`;
}

/**
 * The figures for a question. `ownSymbols` is the caller's book as the route knows it (the signed-in
 * portfolio, or the device-local holdings a no-account request carried) - used when the question
 * names no ticker of its own. `brief` is the day's brief, or null when its market backdrop is not
 * live: sample values are never printed as today's figures.
 */
export function figuresOnlyAnswer(
  question: string,
  data: DashboardData,
  brief: DailyBrief | null,
  ownSymbols: string[] = [],
  reason: FiguresReason = 'used_up',
): string {
  const live = data.signals.filter((signal) => !signal.sample);
  const bySymbol = new Map(live.map((signal) => [signal.symbol.toUpperCase(), signal]));
  const named = extractSymbols(question);
  const asked = named.filter((symbol) => bySymbol.has(symbol));
  const missing = named.filter((symbol) => !bySymbol.has(symbol)).slice(0, MAX_NAMES);
  // The reader's own book answers a question that named nothing - never one that named something else.
  const own = named.length === 0 ? [...new Set(ownSymbols.map((symbol) => symbol.toUpperCase()))].filter((symbol) => bySymbol.has(symbol)) : [];
  const wanted = (asked.length > 0 ? asked : own).slice(0, MAX_NAMES);

  const lines: string[] = [FIGURES_ONLY_LEADS[reason]];
  for (const symbol of wanted) lines.push(signalLine(bySymbol.get(symbol)!));
  if (missing.length > 0) {
    lines.push(`- ${missing.join(', ')}: no live figures on the scan right now, so there is nothing to show for ${missing.length === 1 ? 'it' : 'them'}.`);
  }
  if (wanted.length === 0 && missing.length === 0) {
    if (brief && brief.lines.length > 0) {
      lines.push(brief.headline);
      for (const line of brief.lines.slice(0, MAX_BRIEF_LINES)) lines.push(`- ${line.label}: ${line.text}`);
    } else if (live.length > 0) {
      lines.push(countsLine(live));
    } else {
      lines.push('- No live figures are available right now.');
    }
  }
  lines.push(FIGURES_ONLY_CLOSE);
  return lines.join('\n');
}
