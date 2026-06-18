/**
 * Investigation graph - the deep-investigation surface.  [Phase 3]
 *
 * Merges every finding's entities, relationships and evidence into ONE deduplicated, explorable
 * relationship map. Shared nodes (a supply-chain bottleneck two companies both touch, a theme several
 * names sit under) collapse to a single node, so the graph reveals the connective tissue the
 * per-finding drawer cannot: "these three names all depend on the same bottleneck."
 *
 * Layout is fully deterministic (concentric tiers by entity type, even angular spacing, fixed start
 * offsets) - no randomness - so the same data always renders the same map and the build is testable.
 * The graph owns no numbers it did not receive; it composes existing Finding data into a `merged`
 * synthetic Finding that the existing drawer stack resolves against (connections + linked evidence).
 */
import type { Entity, EvidenceItem, Finding, Relationship } from './types';
import { DEMO_FINDINGS } from './demo-findings';

export interface GraphNode extends Entity {
  /** Number of edges touching this node - drives size + ranking. */
  degree: number;
  x: number;
  y: number;
  tier: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationshipType: Relationship['relationshipType'];
  confidence: number;
  evidenceIds: string[];
}

export interface InvestigationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Synthetic Finding carrying every entity / relationship / evidence so the drawer resolves the whole graph. */
  merged: Finding;
  width: number;
  height: number;
}

/** Concentric tier by entity type: thesis anchors inner, the companies in the middle, sources outer. */
const TIER_BY_TYPE: Record<Entity['type'], number> = {
  theme: 0,
  supply_chain_node: 1,
  commodity: 1,
  company: 2,
  government_agency: 3,
  investor: 3,
  contract: 3,
  patent: 3,
  filing: 3,
};

const TIER_RADIUS = [0, 165, 265, 345];
const CENTER = 380;
const SIZE = 760;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the merged investigation graph from findings (demo by default; pass live findings later).
 * Pure + deterministic.
 */
export function buildInvestigationGraph(findings: Finding[] = DEMO_FINDINGS): InvestigationGraph {
  // 1. Dedup entities by id (first definition wins - they are stable references).
  const entityMap = new Map<string, Entity>();
  for (const f of findings) for (const e of f.entities) if (!entityMap.has(e.id)) entityMap.set(e.id, e);

  // 2. Dedup directed relationships by from|to|type; merge evidence + keep the strongest confidence.
  const edgeMap = new Map<string, GraphEdge>();
  for (const f of findings) {
    for (const r of f.relationships) {
      if (!entityMap.has(r.fromEntityId) || !entityMap.has(r.toEntityId)) continue;
      const key = `${r.fromEntityId}|${r.toEntityId}|${r.relationshipType}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.evidenceIds = Array.from(new Set([...existing.evidenceIds, ...r.evidenceIds]));
        existing.confidence = Math.max(existing.confidence, r.confidence);
      } else {
        edgeMap.set(key, {
          from: r.fromEntityId,
          to: r.toEntityId,
          relationshipType: r.relationshipType,
          confidence: r.confidence,
          evidenceIds: [...r.evidenceIds],
        });
      }
    }
  }
  const edges = Array.from(edgeMap.values());

  // 3. Degree.
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  // 4. Layout - group by tier, sort within tier for determinism, distribute evenly on the ring.
  const byTier = new Map<number, Entity[]>();
  for (const e of entityMap.values()) {
    const tier = TIER_BY_TYPE[e.type] ?? 3;
    const arr = byTier.get(tier) ?? [];
    arr.push(e);
    byTier.set(tier, arr);
  }
  const nodes: GraphNode[] = [];
  for (const [tier, ents] of Array.from(byTier.entries()).sort((a, b) => a[0] - b[0])) {
    const sorted = [...ents].sort((a, b) => a.id.localeCompare(b.id));
    const n = sorted.length;
    const baseRadius = TIER_RADIUS[tier] ?? 345;
    // A zero-radius (center) tier holds a node at the exact middle only when it is ALONE. With more
    // than one (e.g. several themes), spread them on a small inner ring so they do not all stack on
    // (CENTER, CENTER) - which would render as one unreadable, half-unclickable blob.
    const radius = baseRadius === 0 && n > 1 ? 95 : baseRadius;
    sorted.forEach((e, i) => {
      const single = n === 1 && radius === 0;
      // Offset each tier's start angle so adjacent rings do not line up radially (fewer overlaps).
      const angle = (2 * Math.PI * i) / Math.max(1, n) + tier * 0.7 - Math.PI / 2;
      const x = single ? CENTER : CENTER + radius * Math.cos(angle);
      const y = single ? CENTER : CENTER + radius * Math.sin(angle);
      nodes.push({ ...e, degree: degree.get(e.id) ?? 0, x: round(x), y: round(y), tier });
    });
  }

  // 5. Merged synthetic finding - every entity, every deduped relationship, every unique evidence
  //    item, so the existing drawer resolves connections + linked evidence across the whole graph.
  const evidenceMap = new Map<string, EvidenceItem>();
  for (const f of findings) for (const ev of f.evidence) if (!evidenceMap.has(ev.id)) evidenceMap.set(ev.id, ev);

  const merged: Finding = {
    id: 'investigation-graph',
    type: 'theme_breakout',
    title: 'Investigation graph',
    summary: 'The connective tissue across every finding - shared themes, bottlenecks, agencies and peers.',
    state: 'Monitor',
    scores: { total: 0 },
    whySurfaced: [],
    evidence: Array.from(evidenceMap.values()),
    entities: Array.from(entityMap.values()),
    relationships: edges.map((e) => ({
      fromEntityId: e.from,
      toEntityId: e.to,
      relationshipType: e.relationshipType,
      confidence: e.confidence,
      evidenceIds: e.evidenceIds,
    })),
    risks: [],
    timeline: [],
    actions: [],
    createdAt: '',
  };

  return { nodes, edges, merged, width: SIZE, height: SIZE };
}

/** Node colour by entity type - matches the drawer + nav palette. */
export const NODE_COLOR: Record<Entity['type'], string> = {
  company: '#5bc8ff',
  theme: '#a78bfa',
  supply_chain_node: '#43d18b',
  commodity: '#f3a33a',
  government_agency: '#f0758a',
  investor: '#60a5fa',
  contract: '#8190a0',
  patent: '#8190a0',
  filing: '#8190a0',
};
