import { describe, it, expect } from 'vitest';
import { aggregateAiRuns } from '../metrics';
import type { AiRunRecord } from '../audit';

/** Build a minimal audit record with sensible defaults. */
function rec(over: Partial<AiRunRecord>): AiRunRecord {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'local',
    agentName: 'research_analyst',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    inputHash: 'h',
    outputHash: 'o',
    toolsUsed: [],
    injectionFlags: [],
    validationErrors: [],
    citationCount: 1,
    status: 'ok',
    refusalReason: null,
    latencyMs: 100,
    createdAt: '2026-07-16T00:00:00.000Z',
    ...over,
  };
}

describe('ai metrics · aggregateAiRuns', () => {
  it('handles an empty set without dividing by zero', () => {
    const r = aggregateAiRuns([]);
    expect(r.runs).toBe(0);
    expect(r.rates.okRate).toBe(0);
    expect(r.latency).toBeNull();
    expect(r.since).toBeNull();
  });

  it('computes status counts and rates', () => {
    const r = aggregateAiRuns([
      rec({ status: 'ok' }),
      rec({ status: 'ok' }),
      rec({ status: 'refused', refusalReason: 'guardrail_block: directive advice to trade' }),
      rec({ status: 'error', provider: 'openai' }),
    ]);
    expect(r.runs).toBe(4);
    expect(r.status.ok).toBe(2);
    expect(r.status.refused).toBe(1);
    expect(r.status.error).toBe(1);
    expect(r.rates.okRate).toBe(0.5);
    expect(r.rates.refusalRate).toBe(0.25);
    expect(r.rates.errorRate).toBe(0.25);
  });

  it('counts a guardrail block from the refusal reason', () => {
    const r = aggregateAiRuns([
      rec({ status: 'refused', refusalReason: 'guardrail_block: directive advice to trade' }),
      rec({ status: 'refused', refusalReason: 'fabricated_number' }),
      rec({ status: 'ok', injectionFlags: ['external content contains instruction-injection patterns'] }),
    ]);
    expect(r.guardBlocks).toBe(2); // the guardrail_block refusal + the injection-flagged run
    expect(r.rates.guardBlockRate).toBeCloseTo(0.667, 2);
  });

  it('computes latency percentiles from the recorded latencies', () => {
    const r = aggregateAiRuns([10, 20, 30, 40, 100].map((l) => rec({ latencyMs: l })));
    expect(r.latency).not.toBeNull();
    expect(r.latency!.max).toBe(100);
    expect(r.latency!.p50).toBeGreaterThanOrEqual(20);
    expect(r.latency!.mean).toBe(40);
  });

  it('breaks down by agent and by provider, most-active first', () => {
    const r = aggregateAiRuns([
      rec({ agentName: 'research_analyst', provider: 'anthropic' }),
      rec({ agentName: 'research_analyst', provider: 'anthropic' }),
      rec({ agentName: 'risk_analyst', provider: 'openai', status: 'error' }),
    ]);
    expect(r.byAgent[0].agent).toBe('research_analyst');
    expect(r.byAgent[0].runs).toBe(2);
    const openai = r.byProvider.find((p) => p.provider === 'openai');
    expect(openai?.errorRate).toBe(1);
  });

  it('histograms the top refusal reasons by class', () => {
    const r = aggregateAiRuns([
      rec({ status: 'refused', refusalReason: 'guardrail_block: advice' }),
      rec({ status: 'refused', refusalReason: 'guardrail_block: injection' }),
      rec({ status: 'refused', refusalReason: 'fabricated_number' }),
    ]);
    expect(r.topRefusalReasons[0]).toEqual({ reason: 'guardrail_block', count: 2 });
  });

  it('reports the earliest run timestamp as the window start', () => {
    const r = aggregateAiRuns([
      rec({ createdAt: '2026-07-16T05:00:00.000Z' }),
      rec({ createdAt: '2026-07-16T01:00:00.000Z' }),
    ]);
    expect(r.since).toBe('2026-07-16T01:00:00.000Z');
  });
});
