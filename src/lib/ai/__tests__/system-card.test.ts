import { describe, it, expect } from 'vitest';
import { buildAiSystemCard, renderSystemCardMarkdown } from '../system-card';
import { AI_AGENT_NAMES, FORBIDDEN_TOOLS } from '../policy';
import { STOCK_OPS_GUARDS } from '../guardrails/engine';

describe('ai system card', () => {
  const card = buildAiSystemCard();

  it('represents every agent with its tool grants', () => {
    expect(card.agents.map((a) => a.name).sort()).toEqual([...AI_AGENT_NAMES].sort());
    for (const a of card.agents) expect(Array.isArray(a.allowedTools)).toBe(true);
  });

  it('lists the forbidden tools and the active guard set', () => {
    expect(card.tools.forbidden).toEqual(FORBIDDEN_TOOLS);
    expect(card.guardrails.guards).toEqual(STOCK_OPS_GUARDS);
    expect(card.guardrails.version).toBeGreaterThanOrEqual(2);
  });

  it('reports LIVE eval status - and the gates are green', () => {
    expect(card.evaluations.safetyGate.ok).toBe(true);
    expect(card.evaluations.safetyGate.passed).toBe(card.evaluations.safetyGate.total);
    expect(card.evaluations.qualityGate.ok).toBe(true);
    expect(card.evaluations.retrieval.recallAt3).toBeGreaterThanOrEqual(0.9);
    expect(card.evaluations.retrieval.precisionGuard).toBe(1);
    expect(card.evaluations.recoveryModel.oosAuc).toBeGreaterThan(0.65);
  });

  it('carries doctrine and honest limits', () => {
    expect(card.doctrine.join(' ')).toMatch(/deterministic engine decides/i);
    expect(card.limits.join(' ')).toMatch(/reference dataset/i);
  });

  it('renders a human-readable markdown card', () => {
    const md = renderSystemCardMarkdown(card);
    expect(md).toContain('# Lyra AI - System Card');
    expect(md).toContain('## Guardrails');
    expect(md).toContain('## Evaluations (live)');
    expect(md.includes('—')).toBe(false); // no em dashes in user-visible copy
  });
});
