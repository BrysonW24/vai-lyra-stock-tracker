import type { DashboardData } from '@/types/scanner';
import type { MarketContextSnapshot } from '@/lib/market-context';
import { formatPercent, formatSignedNumber, formatSignedPercent, statusLabel } from '@/lib/format';

/**
 * Daily Brief - a plain-English synthesis of today's scan.
 *
 * This is DETERMINISTIC on purpose (per the product doctrine: backend is truth, AI is
 * interpretation). It reads the real signal/portfolio/watchlist/market state and states
 * the facts - no model call, no network, works offline and for free.
 *
 * It is also the seam for the AI layer: when AI is enabled (Account → AI assistance),
 * these same facts become the grounding context handed to the model to phrase, so the
 * AI can never invent numbers that aren't in `buildDailyBrief`.
 */

export type BriefTone = 'pos' | 'neg' | 'warn' | 'neutral';

export interface BriefLine {
  label: string;
  text: string;
  tone: BriefTone;
  /** The ticker this line is about, if any - makes the line click through to its analysis. */
  symbol?: string;
}

export interface DailyBrief {
  headline: string;
  regimeLabel: string;
  regimeTone: BriefTone;
  lines: BriefLine[];
}

const REGIME_LABEL: Record<MarketContextSnapshot['regime'], string> = {
  risk_on: 'Risk-on',
  neutral: 'Neutral',
  risk_off: 'Risk-off',
};

const REGIME_TONE: Record<MarketContextSnapshot['regime'], BriefTone> = {
  risk_on: 'pos',
  neutral: 'neutral',
  risk_off: 'neg',
};

const RISK_FLAGS: ReadonlyArray<string> = ['overextended', 'elevated_risk', 'invalidated'];

export function buildDailyBrief(data: DashboardData, market: MarketContextSnapshot): DailyBrief {
  const lines: BriefLine[] = [];

  const strongSetups = data.signals
    .filter((signal) => signal.status === 'strong_setup')
    .sort((a, b) => b.score - a.score);
  const topSetup = strongSetups[0] ?? [...data.signals].sort((a, b) => b.score - a.score)[0];

  const holdings = data.portfolio;
  const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const totalPnl = holdings.reduce((sum, holding) => sum + holding.unrealisedPnl, 0);
  const cost = totalValue - totalPnl;
  const pnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0;

  // Headline
  const setupCount = strongSetups.length;
  const setupClause = setupCount > 0
    ? `${setupCount} strong setup${setupCount > 1 ? 's' : ''} on the radar`
    : 'No strong setups on the radar right now';
  const bookClause = holdings.length > 0
    ? ` · your book is ${formatSignedPercent(pnlPct)} unrealised`
    : '';
  const headline = `${setupClause}${bookClause}.`;

  // Market backdrop
  const regimeLabel = REGIME_LABEL[market.regime];
  const nasdaq = market.nasdaqChangePct;
  const vix = market.vixPrice;
  lines.push({
    label: 'Market',
    text: `${regimeLabel} backdrop${nasdaq !== null ? ` - Nasdaq ${formatSignedPercent(nasdaq)}` : ''}${vix !== null ? `, VIX ${vix.toFixed(1)}` : ''}.`,
    tone: REGIME_TONE[market.regime],
  });

  // Leading setup
  if (topSetup) {
    lines.push({
      label: 'Lead setup',
      text: `${topSetup.symbol} leads at ${topSetup.score}/100 (${formatSignedNumber(topSetup.scoreDelta, 0)}) - ${statusLabel(topSetup.status).toLowerCase()}.`,
      tone: topSetup.scoreDelta >= 0 ? 'pos' : 'neg',
      symbol: topSetup.symbol,
    });
  }

  // Biggest mover in the book
  if (holdings.length > 0) {
    const mover = [...holdings].sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta))[0];
    if (mover && mover.scoreDelta !== 0) {
      const rising = mover.scoreDelta > 0;
      lines.push({
        label: 'Your book',
        text: `${mover.symbol} ${rising ? 'is strengthening' : 'is cooling'} (${formatSignedNumber(mover.scoreDelta, 0)}) - ${statusLabel(mover.signalStatus).toLowerCase()}.`,
        tone: rising ? 'pos' : 'neg',
        symbol: mover.symbol,
      });
    }

    const flagged = holdings.filter((holding) => RISK_FLAGS.includes(holding.riskState));
    if (flagged.length > 0) {
      lines.push({
        label: 'Risk watch',
        text: `${flagged.map((h) => h.symbol).join(', ')} flagged ${flagged[0].riskState.replaceAll('_', ' ')} - review exposure before adding.`,
        tone: 'warn',
        symbol: flagged[0].symbol,
      });
    }
  }

  // Closest watchlist trigger
  if (data.watchlist.length > 0) {
    const nearest = [...data.watchlist].sort((a, b) => Math.abs(a.distanceToTarget) - Math.abs(b.distanceToTarget))[0];
    if (nearest) {
      lines.push({
        label: 'Watchlist',
        text: `${nearest.symbol} is closest to triggering - ~${formatPercent(Math.abs(nearest.distanceToTarget))} from target.`,
        tone: 'neutral',
        symbol: nearest.symbol,
      });
    }
  }

  // Discipline reminder
  lines.push({
    label: 'Reminder',
    text: 'Research only - Lyra never trades for you. Confirm each setup before acting.',
    tone: 'neutral',
  });

  return { headline, regimeLabel, regimeTone: REGIME_TONE[market.regime], lines };
}
