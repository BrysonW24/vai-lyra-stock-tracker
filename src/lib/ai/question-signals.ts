/**
 * The "Listening layer" - a demand signal derived from Ask-Lyra questions.
 *
 * DELIBERATELY SEPARATE from the hash-only audit trail (audit.ts). The audit trail is privacy-first
 * (it never stores raw prompts) and exists for trust/forensics. THIS captures the question text +
 * the symbols/category on purpose, so the product can learn what users actually want: which symbols
 * and topics get asked about most, and what to build next. It powers founder-facing recommendations
 * and (later) app reconfiguration - turning "what people ask" into roadmap + layout decisions.
 *
 * In-memory today (per server process); structured so a Supabase `question_signals` table can back
 * it for durability with no call-site change. PRIVACY: before real users, disclose this capture in
 * PRIVACY.md and prefer aggregation; treat raw questions as user data.
 */

import { THEME_COMPANIES } from '@/lib/world-radar';

export type QuestionCategory =
  | 'watchlist'
  | 'portfolio'
  | 'risk'
  | 'catalysts'
  | 'signals'
  | 'macro'
  | 'thematic'
  | 'education'
  | 'other';

export interface QuestionSignal {
  question: string;
  symbols: string[];
  category: QuestionCategory;
  createdAt: string;
}

const SIGNALS: QuestionSignal[] = [];
const MAX_SIGNALS = 2000;

const CATEGORY_HINTS: [QuestionCategory, RegExp][] = [
  ['education', /what is|what does|explain|mean by|definition|how do(es)?/i],
  ['risk', /risk|downside|exposure|overextend|drawdown|stop|protect/i],
  ['catalysts', /catalyst|earnings|event|ipo|announc|launch/i],
  ['macro', /macro|market regime|rates|fed|inflation|economy/i],
  ['thematic', /theme|bottleneck|supply chain|agi|sector|infrastructure/i],
  ['portfolio', /portfolio|my book|holdings|my position|exposure|weight/i],
  ['watchlist', /watchlist|watching|watch list/i],
  ['signals', /signal|score|momentum|rsi|macd|setup|prime|volume/i],
];

/**
 * Ticker extraction: uppercase 2-5 letter tokens that are ACTUALLY known symbols (intersected with
 * the content-layer company universe + a common-tickers list), minus a few word-like tickers that
 * are far more often plain English ("NOW", "ON"). Intersecting kills the "RIGHT / BOOK / WHICH"
 * false positives a naive regex produces.
 */
const TOKEN_RE = /\b[A-Z]{2,5}\b/g;
const STOP = new Set(['NOW', 'ON', 'ALL', 'IT', 'BE', 'OR', 'SO', 'GO', 'AI', 'AT', 'AN', 'IS', 'PE']);
const COMMON_TICKERS = [
  'NVDA', 'AMD', 'AVGO', 'TSM', 'MU', 'INTC', 'QCOM', 'ARM', 'ASML', 'SMCI', 'DELL', 'MRVL', 'AMAT', 'LRCX', 'KLAC',
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'AMZN', 'TSLA', 'NFLX',
  'PANW', 'SNOW', 'CRWD', 'NET', 'DDOG', 'ZS', 'PLTR', 'MDB', 'ORCL', 'ADBE', 'CRM',
  'VRT', 'ETN', 'GEV', 'CEG', 'VST', 'NEE', 'OKLO', 'SMR', 'CCJ', 'MSTR', 'COIN', 'HOOD',
];
const KNOWN_SYMBOLS = new Set<string>([...COMMON_TICKERS, ...THEME_COMPANIES.map((c) => c.symbol.toUpperCase())]);

export function classifyQuestion(q: string): QuestionCategory {
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(q)) return cat;
  return 'other';
}

export function extractSymbols(q: string): string[] {
  const found = (q.toUpperCase().match(TOKEN_RE) ?? []).filter((s) => KNOWN_SYMBOLS.has(s) && !STOP.has(s));
  return [...new Set(found)].slice(0, 6);
}

/** Capture one user question as a demand signal. Fire-and-forget; never throws. */
export function recordQuestionSignal(question: string): void {
  try {
    const q = question.trim().slice(0, 500);
    if (!q) return;
    SIGNALS.push({ question: q, symbols: extractSymbols(q), category: classifyQuestion(q), createdAt: new Date().toISOString() });
    if (SIGNALS.length > MAX_SIGNALS) SIGNALS.splice(0, SIGNALS.length - MAX_SIGNALS);
  } catch {
    /* listening must never break a chat */
  }
}

export interface QuestionInsights {
  total: number;
  byCategory: { category: QuestionCategory; count: number }[];
  topSymbols: { symbol: string; count: number }[];
  recent: { question: string; category: QuestionCategory; createdAt: string }[];
}

/** Aggregate the captured questions into a founder-readable demand snapshot. */
export function summariseQuestionSignals(): QuestionInsights {
  const catCount = new Map<QuestionCategory, number>();
  const symCount = new Map<string, number>();
  for (const s of SIGNALS) {
    catCount.set(s.category, (catCount.get(s.category) ?? 0) + 1);
    for (const sym of s.symbols) symCount.set(sym, (symCount.get(sym) ?? 0) + 1);
  }
  return {
    total: SIGNALS.length,
    byCategory: [...catCount.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    topSymbols: [...symCount.entries()].map(([symbol, count]) => ({ symbol, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    recent: SIGNALS.slice(-25).reverse().map((s) => ({ question: s.question, category: s.category, createdAt: s.createdAt })),
  };
}
