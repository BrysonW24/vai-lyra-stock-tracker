import { describe, it, expect } from 'vitest';
import { retrieveHybrid, buildHybridKnowledgeBlock } from '../hybrid';
import { buildVectorIndex, vectorizeQuery, cosine } from '../vectorize';
import { compareRetrievers, evaluateRetriever, RETRIEVAL_CASES } from '../eval/retrieval-eval';
import { retrieveKnowledge } from '../retrieve';

describe('knowledge vectorize · cosine', () => {
  const idx = buildVectorIndex([
    { id: 'a', text: 'deploy lyra on coolify with docker' },
    { id: 'b', text: 'the oversold recovery score uses rsi and macd' },
    { id: 'c', text: 'telegram alerts on your phone' },
  ]);

  it('scores a morphological variant close to the exact term (deploy ~ deploying)', () => {
    const q = vectorizeQuery('deploying with docker', idx);
    const toA = cosine(q, idx.vectors.get('a')!);
    const toB = cosine(q, idx.vectors.get('b')!);
    expect(toA).toBeGreaterThan(toB); // deploy doc beats the score doc
    expect(toA).toBeGreaterThan(0);
  });

  it('is symmetric and bounded in [0,1]', () => {
    const q = vectorizeQuery('rsi macd score', idx);
    const s = cosine(q, idx.vectors.get('b')!);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
    expect(cosine(idx.vectors.get('b')!, q)).toBeCloseTo(s, 10);
  });

  it('returns 0 against an empty/disjoint vector', () => {
    const q = vectorizeQuery('zzzz', idx);
    expect(cosine(q, idx.vectors.get('a')!)).toBe(0);
  });
});

describe('knowledge hybrid · precision preserved', () => {
  it('returns nothing for market/advice questions (inherits the lexical gate)', () => {
    expect(retrieveHybrid('why did my NVDA position drop today?')).toEqual([]);
    expect(retrieveHybrid('should I buy AAPL now?')).toEqual([]);
    expect(retrieveHybrid('')).toEqual([]);
  });

  it('routes core questions to the right doc', () => {
    expect(retrieveHybrid('how does the oversold recovery score work?').some((h) => h.source.includes('05-understand-the-score'))).toBe(true);
    expect(retrieveHybrid('what is lyra?')[0].source).toContain('01-what-is-lyra');
  });

  it('is deterministic: same query, same ranked ids', () => {
    const q = 'connect my own supabase database';
    expect(retrieveHybrid(q).map((h) => h.id)).toEqual(retrieveHybrid(q).map((h) => h.id));
  });

  it('buildHybridKnowledgeBlock formats like the lexical block and is empty off-topic', () => {
    const block = buildHybridKnowledgeBlock('how does the score work?');
    expect(block.startsWith('KNOWLEDGE (part of your grounded context')).toBe(true);
    expect(block).toContain('05-understand-the-score');
    expect(block.length).toBeLessThanOrEqual(2600);
    expect(buildHybridKnowledgeBlock('why did my NVDA position drop today?')).toBe('');
  });
});

describe('knowledge retrieval · measured quality (hybrid >= lexical)', () => {
  it('hybrid never regresses the lexical baseline on recall@1/@3/MRR', () => {
    const { lexical, hybrid } = compareRetrievers();
    // Non-regression: the semantic rerank must not make ranking worse.
    expect(hybrid.recallAt1).toBeGreaterThanOrEqual(lexical.recallAt1);
    expect(hybrid.recallAt3).toBeGreaterThanOrEqual(lexical.recallAt3);
    expect(hybrid.mrr).toBeGreaterThanOrEqual(lexical.mrr);
  });

  it('both retrievers clear the quality floor and hold the precision guard', () => {
    const { hybrid } = compareRetrievers();
    expect(hybrid.recallAt3).toBeGreaterThanOrEqual(0.9); // finds the right doc in top-3 for >=90% of questions
    expect(hybrid.mrr).toBeGreaterThanOrEqual(0.75);
    expect(hybrid.precisionGuard).toBe(1); // silent on every market/advice question
  });

  it('the labelled set covers the core docs', () => {
    const sources = RETRIEVAL_CASES.flatMap((c) => c.relevantSource);
    for (const s of ['05-understand-the-score', 'COSTS.md', '01-what-is-lyra', '06-alerts-on-your-phone']) {
      expect(sources.some((src) => src.includes(s))).toBe(true);
    }
    // Sanity: the lexical retriever alone already answers most - the eval is meaningful, not trivial.
    const lex = evaluateRetriever((q, k) => retrieveKnowledge(q, k));
    expect(lex.recallAt3).toBeGreaterThan(0.5);
  });
});
