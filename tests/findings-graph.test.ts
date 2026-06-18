import { describe, expect, it } from 'vitest';
import { buildInvestigationGraph, NODE_COLOR } from '@/lib/findings/graph';
import type { Finding } from '@/lib/findings/types';

describe('buildInvestigationGraph', () => {
  const g = buildInvestigationGraph();

  it('dedupes entities to unique nodes', () => {
    const ids = g.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(g.nodes.length).toBe(g.merged.entities.length);
  });

  it('only emits edges whose endpoints exist as nodes', () => {
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it('lays every node out inside the frame', () => {
    for (const n of g.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(g.width);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(g.height);
    }
  });

  it('is deterministic - same input renders identical coordinates', () => {
    const again = buildInvestigationGraph();
    expect(again.nodes.map((n) => [n.id, n.x, n.y])).toEqual(g.nodes.map((n) => [n.id, n.x, n.y]));
  });

  it('computes degree from the deduped edge set', () => {
    for (const n of g.nodes) {
      const expected = g.edges.filter((e) => e.from === n.id || e.to === n.id).length;
      expect(n.degree).toBe(expected);
    }
  });

  it('merges duplicate relationships across findings (no exact-duplicate edges)', () => {
    const keys = g.edges.map((e) => `${e.from}|${e.to}|${e.relationshipType}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a colour for every entity type present', () => {
    for (const n of g.nodes) expect(NODE_COLOR[n.type]).toBeTruthy();
  });

  it('does NOT stack multiple theme (tier-0) nodes on the exact center point', () => {
    const themes = g.nodes.filter((n) => n.type === 'theme');
    expect(themes.length).toBeGreaterThan(1); // demo has space-intelligence + ai-voice
    const coords = new Set(themes.map((n) => `${n.x},${n.y}`));
    expect(coords.size).toBe(themes.length); // every theme node has a distinct coordinate
    // none of them sit exactly on the center where they would overlap + occlude clicks
    const CENTER = g.width / 2;
    expect(themes.every((n) => n.x !== CENTER || n.y !== CENTER)).toBe(true);
  });

  it('collapses a node shared by two findings into one', () => {
    const shared: Finding[] = [
      {
        id: 'F1',
        type: 'small_cap_discovery',
        title: 'F1',
        summary: '',
        state: 'Monitor',
        scores: { total: 1 },
        whySurfaced: [],
        evidence: [],
        entities: [
          { id: 'AAA', type: 'company', name: 'Company A' },
          { id: 'node:x', type: 'supply_chain_node', name: 'Bottleneck X' },
        ],
        relationships: [{ fromEntityId: 'AAA', toEntityId: 'node:x', relationshipType: 'supplies', confidence: 0.5, evidenceIds: [] }],
        risks: [],
        timeline: [],
        actions: [],
        createdAt: '',
      },
      {
        id: 'F2',
        type: 'small_cap_discovery',
        title: 'F2',
        summary: '',
        state: 'Monitor',
        scores: { total: 1 },
        whySurfaced: [],
        evidence: [],
        entities: [
          { id: 'BBB', type: 'company', name: 'Company B' },
          { id: 'node:x', type: 'supply_chain_node', name: 'Bottleneck X' },
        ],
        relationships: [{ fromEntityId: 'BBB', toEntityId: 'node:x', relationshipType: 'supplies', confidence: 0.9, evidenceIds: [] }],
        risks: [],
        timeline: [],
        actions: [],
        createdAt: '',
      },
    ];
    const merged = buildInvestigationGraph(shared);
    expect(merged.nodes.filter((n) => n.id === 'node:x').length).toBe(1);
    // The shared bottleneck is now connected to both companies.
    expect(merged.nodes.find((n) => n.id === 'node:x')?.degree).toBe(2);
  });
});
