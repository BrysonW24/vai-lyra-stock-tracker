/**
 * The answer Lyra gives when no model can: the engine's own figures, without commentary.
 *
 * The free pool of open models is a daily allowance, and it runs out. "Try again later" would
 * leave someone who asked about their book with nothing - but the answer to most questions is
 * mostly figures the engine has already computed, and those need no model. So when the pool cannot
 * answer, chat says so in one line and prints what the dashboard holds for the tickers the question
 * named (or for the reader's own book, or the day's brief when it named none).
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

const MAX_NAMES = 4;
const MAX_BRIEF_LINES = 4;

export const FIGURES_ONLY_LEAD =
  "Lyra's free answers are busy or used up for the moment, so here are the engine's own figures without commentary.";
export const FIGURES_ONLY_CLOSE = 'Ask again in a few minutes for a written answer.';

function signalLine(signal: SignalRow): string {
  const status = STATUS_WORDS[signal.status] ?? signal.status.replace(/_/g, ' ');
  return (
    `- ${signal.symbol}: score ${Math.round(signal.score)} (${formatSignedNumber(signal.scoreDelta, 0)}), ${status}, ` +
    `${formatSignedPercent(signal.priceChange1d)} on the day, RSI ${Math.round(signal.rsi)}, volume ${signal.volumeRatio.toFixed(1)}x`
  );
}

/**
 * The figures for a question. `ownSymbols` is the caller's book as the route knows it (the signed-in
 * portfolio, or the device-local holdings a no-account request carried) - used when the question
 * names no ticker of its own. `brief` is the day's brief, or null when its market backdrop is not
 * live: sample values are never printed as today's figures.
 */
export function figuresOnlyAnswer(question: string, data: DashboardData, brief: DailyBrief | null, ownSymbols: string[] = []): string {
  const bySymbol = new Map(data.signals.map((signal) => [signal.symbol.toUpperCase(), signal]));
  const asked = extractSymbols(question).filter((symbol) => bySymbol.has(symbol));
  const wanted = (asked.length > 0 ? asked : ownSymbols.map((symbol) => symbol.toUpperCase()).filter((symbol) => bySymbol.has(symbol))).slice(0, MAX_NAMES);

  const lines: string[] = [FIGURES_ONLY_LEAD];
  if (wanted.length > 0) {
    for (const symbol of wanted) lines.push(signalLine(bySymbol.get(symbol)!));
  } else if (brief && brief.lines.length > 0) {
    lines.push(brief.headline);
    for (const line of brief.lines.slice(0, MAX_BRIEF_LINES)) lines.push(`- ${line.label}: ${line.text}`);
  } else {
    const top = [...data.signals].sort((a, b) => b.score - a.score).slice(0, 3);
    if (top.length > 0) {
      lines.push('The highest scores on the scan right now:');
      for (const signal of top) lines.push(signalLine(signal));
    } else {
      lines.push('- Nothing on the dashboard matches that question yet.');
    }
  }
  lines.push(FIGURES_ONLY_CLOSE);
  return lines.join('\n');
}
