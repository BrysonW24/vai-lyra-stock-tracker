/**
 * Retrieval evaluation - the measurement that turns "we have retrieval" into "we have retrieval we
 * can prove is good and can't silently regress." A labelled set of real user questions, each with
 * the source doc a correct retrieval must surface, scored with standard IR metrics (recall@k, MRR)
 * for BOTH the lexical retriever and the hybrid retriever. The CI test asserts the hybrid never
 * regresses the lexical baseline and both clear a quality floor.
 */
import { retrieveKnowledge } from '../retrieve';
import { retrieveHybrid } from '../hybrid';

export interface RetrievalCase {
  query: string;
  /** A hit is relevant when its `source` includes ANY of these substrings. */
  relevantSource: string[];
  /** Off-topic queries that must return NOTHING (precision guard). */
  expectEmpty?: boolean;
}

export const RETRIEVAL_CASES: readonly RetrievalCase[] = [
  { query: 'how does the oversold recovery score work?', relevantSource: ['05-understand-the-score'] },
  { query: 'what is the rsi reset band', relevantSource: ['05-understand-the-score'] },
  { query: 'how do I deploy this on coolify with docker?', relevantSource: ['coolify-deploy', '04-deploy-your-own'] },
  { query: 'deploying to my own server', relevantSource: ['coolify-deploy', '04-deploy-your-own'] },
  { query: 'what does it cost to run lyra every month?', relevantSource: ['COSTS.md'] },
  { query: 'how much does this cost', relevantSource: ['COSTS.md'] },
  { query: 'how do I get telegram alerts on my phone?', relevantSource: ['06-alerts-on-your-phone'] },
  { query: 'set up notifications on my phone', relevantSource: ['06-alerts-on-your-phone'] },
  { query: 'what is lyra?', relevantSource: ['01-what-is-lyra'] },
  { query: 'how do I run it myself?', relevantSource: ['02-run-it-yourself'] },
  { query: 'connect my own supabase database', relevantSource: ['03-go-live-supabase'] },
  { query: 'going live with supabase', relevantSource: ['03-go-live-supabase'] },
  { query: 'what is the emerging winner engine?', relevantSource: ['README.md'] },
  // Precision guards - the retriever must stay silent on market/advice questions.
  { query: 'why did my NVDA position drop today?', relevantSource: [], expectEmpty: true },
  { query: 'should I buy AAPL now?', relevantSource: [], expectEmpty: true },
];

type Retriever = (query: string, k?: number) => Array<{ source: string }>;

function isRelevant(source: string, relevant: string[]): boolean {
  return relevant.some((r) => source.includes(r));
}

export interface RetrievalMetrics {
  cases: number;
  /** Fraction of answerable cases whose top-1 hit is relevant. */
  recallAt1: number;
  /** Fraction of answerable cases with a relevant hit anywhere in top-k. */
  recallAt3: number;
  /** Mean reciprocal rank of the first relevant hit (answerable cases). */
  mrr: number;
  /** Fraction of expect-empty cases the retriever correctly returned nothing for. */
  precisionGuard: number;
}

/** Score a retriever over the labelled set. */
export function evaluateRetriever(retrieve: Retriever, cases: readonly RetrievalCase[] = RETRIEVAL_CASES): RetrievalMetrics {
  const answerable = cases.filter((c) => !c.expectEmpty);
  const emptyCases = cases.filter((c) => c.expectEmpty);

  let top1 = 0;
  let anyTop3 = 0;
  let rrSum = 0;
  for (const c of answerable) {
    const hits = retrieve(c.query, 3);
    const rank = hits.findIndex((h) => isRelevant(h.source, c.relevantSource));
    if (rank === 0) top1 += 1;
    if (rank >= 0) {
      anyTop3 += 1;
      rrSum += 1 / (rank + 1);
    }
  }

  let guarded = 0;
  for (const c of emptyCases) {
    if (retrieve(c.query, 3).length === 0) guarded += 1;
  }

  const n = Math.max(1, answerable.length);
  return {
    cases: cases.length,
    recallAt1: Math.round((top1 / n) * 1000) / 1000,
    recallAt3: Math.round((anyTop3 / n) * 1000) / 1000,
    mrr: Math.round((rrSum / n) * 1000) / 1000,
    precisionGuard: emptyCases.length === 0 ? 1 : Math.round((guarded / emptyCases.length) * 1000) / 1000,
  };
}

/** Compare the lexical baseline against the hybrid retriever on the same labelled set. */
export function compareRetrievers(cases: readonly RetrievalCase[] = RETRIEVAL_CASES): {
  lexical: RetrievalMetrics;
  hybrid: RetrievalMetrics;
} {
  return {
    lexical: evaluateRetriever((q, k) => retrieveKnowledge(q, k), cases),
    hybrid: evaluateRetriever((q, k) => retrieveHybrid(q, k), cases),
  };
}
