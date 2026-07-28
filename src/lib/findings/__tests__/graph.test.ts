import { describe, it, expect } from 'vitest';
import { buildInvestigationGraph } from '../graph';
import type { Entity, Finding, Relationship } from '../types';

/**
 * Behavioral pin for the deterministic investigation-graph builder (2026-07-27 audit V10 P2: graph.ts
 * owned dedup/degree/deterministic layout unpinned). Invariants: entities dedup by id, directed edges
 * dedup by from|to|type (merging evidence, keeping the strongest confidence), edges to a missing
 * entity are dropped, degree counts incident edges, and layout is byte-for-byte reproducible.
 */
function mkFinding(id: string, entities: Entity[], relationships: Relationship[] = []): Finding {
  return {
    id,
    type: 'scanner_signal',
    title: id,
    summary: id,
    state: 'Monitor',
    scores: { total: 50 },
    whySurfaced: [id],
    evidence: [],
    entities,
    relationships,
    risks: [],
    timeline: [],
    actions: [],
    createdAt: '2026-07-20T00:00:00Z',
  };
}

const NVDA: Entity = { id: 'NVDA', type: 'company', name: 'NVDA' };
const THEME: Entity = { id: 'theme:ai', type: 'theme', name: 'AI' };

describe('buildInvestigationGraph', () => {
  it('dedups entities by id across findings', () => {
    const g = buildInvestigationGraph([mkFinding('a', [NVDA, THEME]), mkFinding('b', [NVDA])]);
    expect(g.nodes.filter((n) => n.id === 'NVDA')).toHaveLength(1);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['NVDA', 'theme:ai']);
  });

  it('dedups directed edges by from|to|type, merging evidence and keeping the strongest confidence', () => {
    const rel = (confidence: number, evidenceIds: string[]): Relationship => ({
      fromEntityId: 'NVDA',
      toEntityId: 'theme:ai',
      relationshipType: 'exposed_to',
      confidence,
      evidenceIds,
    });
    const g = buildInvestigationGraph([
      mkFinding('a', [NVDA, THEME], [rel(0.6, ['e1'])]),
      mkFinding('b', [NVDA, THEME], [rel(0.9, ['e2'])]),
    ]);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].confidence).toBe(0.9);
    expect([...g.edges[0].evidenceIds].sort()).toEqual(['e1', 'e2']);
  });

  it('drops a relationship that points at an entity not present in any finding', () => {
    const g = buildInvestigationGraph([
      mkFinding('a', [NVDA], [{ fromEntityId: 'NVDA', toEntityId: 'ghost:x', relationshipType: 'supplies', confidence: 0.5, evidenceIds: [] }]),
    ]);
    expect(g.edges).toHaveLength(0);
  });

  it('counts node degree from incident edges', () => {
    const g = buildInvestigationGraph([
      mkFinding('a', [NVDA, THEME], [{ fromEntityId: 'NVDA', toEntityId: 'theme:ai', relationshipType: 'exposed_to', confidence: 0.7, evidenceIds: [] }]),
    ]);
    const nvda = g.nodes.find((n) => n.id === 'NVDA')!;
    const theme = g.nodes.find((n) => n.id === 'theme:ai')!;
    expect(nvda.degree).toBe(1);
    expect(theme.degree).toBe(1);
  });

  it('produces a byte-for-byte reproducible layout for the same input', () => {
    const findings = [mkFinding('a', [NVDA, THEME]), mkFinding('b', [{ id: 'AMD', type: 'company', name: 'AMD' }, THEME])];
    const a = buildInvestigationGraph(findings);
    const b = buildInvestigationGraph(findings);
    expect(a.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, tier: n.tier }))).toEqual(
      b.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, tier: n.tier })),
    );
  });

  it('merges every entity + unique evidence into the synthetic merged finding', () => {
    const g = buildInvestigationGraph([mkFinding('a', [NVDA, THEME]), mkFinding('b', [{ id: 'AMD', type: 'company', name: 'AMD' }])]);
    expect(g.merged.entities.map((e) => e.id).sort()).toEqual(['AMD', 'NVDA', 'theme:ai']);
  });
});
