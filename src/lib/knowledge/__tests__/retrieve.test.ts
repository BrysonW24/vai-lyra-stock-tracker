import { describe, expect, it } from 'vitest';
import { retrieveKnowledge, buildKnowledgeBlock } from '@/lib/knowledge/retrieve';

/**
 * Golden retrieval tests: the questions a friend actually asks must surface the right doc.
 * The corpus is the committed src/lib/generated/knowledge.json (rebuilt by
 * scripts/build-knowledge.mjs on every dev/build/type-check), so these also pin that the
 * knowledge pipeline keeps covering the core docs.
 */
describe('knowledge retrieval', () => {
  it('routes score questions to the score walkthrough', () => {
    const hits = retrieveKnowledge('how does the oversold recovery score work?');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.source.includes('05-understand-the-score'))).toBe(true);
  });

  it('routes deployment questions to the deploy docs', () => {
    const hits = retrieveKnowledge('how do I deploy this on coolify with docker?');
    expect(hits.length).toBeGreaterThan(0);
    expect(
      hits.some((h) => h.source.includes('coolify-deploy') || h.source.includes('04-deploy-your-own')),
    ).toBe(true);
  });

  it('routes cost questions to COSTS.md', () => {
    const hits = retrieveKnowledge('what does it cost to run lyra every month?');
    expect(hits.some((h) => h.source === 'COSTS.md')).toBe(true);
  });

  it('routes alert questions to the alerts walkthrough', () => {
    const hits = retrieveKnowledge('how do I get telegram alerts on my phone?');
    expect(hits.some((h) => h.source.includes('06-alerts-on-your-phone'))).toBe(true);
  });

  it('answers the flagship natural questions (recall)', () => {
    const lyra = retrieveKnowledge('what is lyra?');
    expect(lyra.length).toBeGreaterThan(0);
    expect(lyra[0].source).toContain('01-what-is-lyra');

    const cost = retrieveKnowledge('how much does this cost?');
    expect(cost.some((h) => h.source === 'COSTS.md')).toBe(true);

    expect(retrieveKnowledge('how do I set this up?').length).toBeGreaterThan(0);

    const run = retrieveKnowledge('how do I run it myself?');
    expect(run.some((h) => h.source.includes('02-run-it-yourself'))).toBe(true);
  });

  it('returns nothing for ordinary market questions (no noise in portfolio chat)', () => {
    expect(retrieveKnowledge('why did my NVDA position drop today?')).toEqual([]);
  });

  it('fails closed for the whole advice/market class, not one phrasing', () => {
    expect(retrieveKnowledge('should I buy AAPL now?')).toEqual([]);
    expect(retrieveKnowledge('what stocks look oversold right now?')).toEqual([]);
    expect(retrieveKnowledge('is MACD improving for NVDA?')).toEqual([]);
    expect(retrieveKnowledge('is AMD a good buy at this price?')).toEqual([]);
  });

  it('returns nothing for empty or stopword-only queries', () => {
    expect(retrieveKnowledge('')).toEqual([]);
    expect(retrieveKnowledge('what is it')).toEqual([]);
  });

  it('is deterministic: same query, same ranked ids', () => {
    const q = 'connect my own supabase database';
    expect(retrieveKnowledge(q).map((h) => h.id)).toEqual(retrieveKnowledge(q).map((h) => h.id));
  });
});

describe('buildKnowledgeBlock', () => {
  it('formats hits with the KNOWLEDGE header and a citable source per entry', () => {
    const block = buildKnowledgeBlock('how does the score work?');
    expect(block.startsWith('KNOWLEDGE (part of your grounded context')).toBe(true);
    expect(block).toContain('05-understand-the-score');
    expect(block.length).toBeLessThanOrEqual(2600);
  });

  it('returns an empty string when the question is not about Lyra itself', () => {
    expect(buildKnowledgeBlock('why did my NVDA position drop today?')).toBe('');
  });

  it('never contains an em dash', () => {
    const block = buildKnowledgeBlock('deploy on vercel costs');
    expect(block.includes('—')).toBe(false);
  });
});
