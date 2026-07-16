import { describe, it, expect } from 'vitest';
import { executeTool, ToolDeniedError } from '../runtime';

/**
 * The tool runtime is the security boundary: an agent may only run a tool its policy matrix grants,
 * forbidden tools are structurally unrunnable, and unknown tools fail closed. These tests exercise
 * that gate plus the read-only intelligence tools (which fall back to demo data with no Supabase env).
 */
describe('ai tool runtime · fail-closed gate', () => {
  it('denies a forbidden tool for every agent', async () => {
    await expect(
      // create_order is on the FORBIDDEN list - no agent may ever run it.
      executeTool('research_analyst', 'create_order' as never),
    ).rejects.toBeInstanceOf(ToolDeniedError);
  });

  it('denies an unknown tool name', async () => {
    await expect(executeTool('research_analyst', 'delete_everything' as never)).rejects.toBeInstanceOf(ToolDeniedError);
  });

  it('denies a real tool the agent was not granted', async () => {
    // news_classifier is granted only classify_news; read_signals is off-limits.
    await expect(executeTool('news_classifier', 'read_signals')).rejects.toBeInstanceOf(ToolDeniedError);
  });
});

describe('ai tool runtime · read_convergence', () => {
  it('is granted to the research analyst and returns engine-computed convergences', async () => {
    const result = (await executeTool('research_analyst', 'read_convergence')) as {
      generatedAt: string;
      stats: { entities: number; dataPoints: number; convergentEntities: number };
      convergence: Array<{ symbol: string; convergenceScore: number; kinds: string[]; points: unknown[]; freshness: string }>;
    };
    expect(typeof result.generatedAt).toBe('string');
    expect(result.stats.dataPoints).toBeGreaterThan(0);
    expect(Array.isArray(result.convergence)).toBe(true);
  });

  it('enforces convergence discipline: every returned name has at least 2 independent signal kinds', async () => {
    const result = (await executeTool('research_analyst', 'read_convergence', { minKinds: 2 })) as {
      convergence: Array<{ kinds: string[]; convergenceScore: number }>;
    };
    for (const c of result.convergence) {
      expect(c.kinds.length).toBeGreaterThanOrEqual(2);
    }
    // Ranked by conviction, descending.
    const scores = result.convergence.map((c) => c.convergenceScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('honours the limit argument', async () => {
    const result = (await executeTool('research_analyst', 'read_convergence', { limit: 3 })) as {
      convergence: unknown[];
    };
    expect(result.convergence.length).toBeLessThanOrEqual(3);
  });

  it('is denied to an agent without the grant (filing_analyst)', async () => {
    await expect(executeTool('filing_analyst', 'read_convergence')).rejects.toBeInstanceOf(ToolDeniedError);
  });
});

describe('ai tool runtime · read_trading_twin', () => {
  it('is granted to the portfolio assistant and returns a research-only twin marker', async () => {
    // With no Supabase env in tests, the twin has no signed-in user -> not-enough-data marker.
    const result = (await executeTool('portfolio_assistant', 'read_trading_twin')) as {
      hasEnoughData: boolean;
      note?: string;
    };
    expect(result).toHaveProperty('hasEnoughData');
    expect(result.hasEnoughData).toBe(false);
  });

  it('is denied to an agent without the grant (news_classifier)', async () => {
    await expect(executeTool('news_classifier', 'read_trading_twin')).rejects.toBeInstanceOf(ToolDeniedError);
  });
});
