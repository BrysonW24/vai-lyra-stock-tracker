import { describe, it, expect } from 'vitest';
import {
  traceThemeChain,
  companyChainPosition,
  rawMaterialExposure,
  resolveRawMaterial,
} from '@/lib/value-chain';
import { getThemes, getSmallCapCompanies, getNodesForTheme } from '@/lib/world-radar';

describe('resolveRawMaterial', () => {
  it('enriches a tradeable commodity with source countries + AI flag', () => {
    const copper = resolveRawMaterial('Copper');
    expect(copper.commodity).toBeDefined();
    expect(copper.aiLinked).toBe(true);
    expect(copper.from).toBeTruthy();
  });

  it('returns a bare material for non-tradeable inputs (e.g. Electricity)', () => {
    const power = resolveRawMaterial('Electricity');
    expect(power.commodity).toBeUndefined();
    expect(power.aiLinked).toBe(false);
  });
});

describe('traceThemeChain', () => {
  it('builds tiers demand-first down to the bottleneck for every theme', () => {
    for (const theme of getThemes()) {
      const nodes = getNodesForTheme(theme.slug);
      if (nodes.length === 0) continue;
      const chain = traceThemeChain(theme.slug);
      expect(chain).not.toBeNull();
      expect(chain!.tiers.length).toBeGreaterThan(0);
      expect(chain!.tiers[0].label).toBe('Demand');
      // Layers strictly ascend across tiers (demand=lowest layer number first).
      const layers = chain!.tiers.map((t) => t.layer);
      for (let i = 1; i < layers.length; i++) expect(layers[i]).toBeGreaterThan(layers[i - 1]);
    }
  });

  it('collects every raw material across the chain, deduped + sorted', () => {
    const chain = traceThemeChain('agi-infrastructure')!;
    const names = chain.rawMaterials.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(names); // already sorted
    expect(names.length).toBeGreaterThan(0);
  });

  it('flags the focus company node when a symbol is traced', () => {
    // Pick a real company in this theme and confirm exactly its node is flagged.
    const chain = traceThemeChain('agi-infrastructure', 'NVDA')!;
    const flaggedNodes = chain.tiers.flatMap((t) => t.nodes).filter((n) => n.hasFocus);
    expect(flaggedNodes.length).toBeGreaterThan(0);
    for (const n of flaggedNodes) {
      expect(n.companies.some((c) => c.symbol === 'NVDA')).toBe(true);
    }
  });

  it('returns null for an unknown theme', () => {
    expect(traceThemeChain('not-a-theme')).toBeNull();
  });
});

describe('companyChainPosition', () => {
  it('resolves every (theme,node) a company touches, with raw materials rolled up', () => {
    // A small cap with cross-theme nodes exercises the multi-theme roll-up.
    const sample = getSmallCapCompanies()[0];
    const pos = companyChainPosition(sample.symbol);
    expect(pos).not.toBeNull();
    expect(pos!.positions.length).toBe(sample.nodes.length);
    // Every position references a real node id from the company.
    for (const p of pos!.positions) {
      expect(sample.nodes).toContain(p.node.id);
    }
  });

  it('returns null for an unknown symbol', () => {
    expect(companyChainPosition('ZZZZ')).toBeNull();
  });
});

describe('rawMaterialExposure', () => {
  it('walks from a commodity to the small-caps downstream of it', () => {
    const copper = rawMaterialExposure('Copper');
    expect(copper.material.name).toBe('Copper');
    // Copper feeds nodes; each downstream small cap is unique.
    const syms = copper.smallCaps.map((c) => c.symbol);
    expect(new Set(syms).size).toBe(syms.length);
    // Every returned company genuinely sits on a copper-consuming node.
    for (const node of copper.nodes) {
      expect(node.node.commodities).toContain('Copper');
    }
  });
});
