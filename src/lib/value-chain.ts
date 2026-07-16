/**
 * Value-Chain Tracer - the end-to-end map the flagship is built around: for any company, walk the
 * chain ALL THE WAY BACK to the raw materials that feed it, and forward to the end demand that pays
 * for it, with the capital (government + big-tech) flowing in overlaid at each layer.
 *
 * The founder's ask: "trace them through the entire lifecycle ... all the way back to raw materials
 * and the companies along that." The substrate already encodes this - supply-chain nodes carry a
 * `layer` (1 = end demand, higher = deeper into physical inputs) and a `commodities` list (the raw
 * materials each node consumes), and companies attach to nodes (across themes). This module composes
 * those into a single linear chain plus a raw-material -> downstream-company reverse index.
 *
 * Deterministic and read-only. Nothing here is a buy/sell call.
 */
import {
  getTheme,
  getNodesForTheme,
  getNode,
  getThemeCompanies,
  getSmallCapCompanies,
  getCapitalEvents,
  type SupplyChainNode,
  type ThemeCompany,
  type CapitalEvent,
} from '@/lib/world-radar';
import { COMMODITIES, type Commodity } from '@/lib/commodities';

/** A raw material consumed by a node, enriched with catalogue data when it is a tradeable commodity. */
export interface RawMaterial {
  name: string;
  /** Present when the material matches the tradeable-commodity catalogue. */
  commodity?: Commodity;
  /** True when it is an AI/electrification-buildout commodity. */
  aiLinked: boolean;
  /** Source countries, when known (from the commodity catalogue). */
  from?: string;
}

/** One tier of the chain, from end demand (tierIndex 0) down to the upstream bottleneck. */
export interface ChainTier {
  layer: number;
  tierIndex: number;
  /** 'Demand' | 'Upstream / bottleneck' | 'Tier N'. */
  label: string;
  nodes: ChainNode[];
}

export interface ChainNode {
  node: SupplyChainNode;
  /** Companies (any size) attached to this node. */
  companies: ThemeCompany[];
  /** Raw materials this node consumes. */
  rawMaterials: RawMaterial[];
  /** Capital events landing on this node (funding flowing to this layer). */
  capital: CapitalEvent[];
  /** True when the traced company sits on this node. */
  hasFocus: boolean;
}

export interface ValueChain {
  themeSlug: string;
  themeName: string;
  themeEmoji: string;
  thesis: string;
  falsifier: string;
  tiers: ChainTier[];
  /** All distinct raw materials across the chain, deduped. */
  rawMaterials: RawMaterial[];
  /** The company the chain is focused on, if any. */
  focusSymbol?: string;
}

function tierLabel(tierIndex: number, total: number): string {
  if (tierIndex === 0) return 'Demand';
  if (tierIndex === total - 1) return 'Upstream / bottleneck';
  return `Tier ${tierIndex + 1}`;
}

/** Resolve a raw-material name against the tradeable-commodity catalogue (case-insensitive). */
export function resolveRawMaterial(name: string): RawMaterial {
  const match = COMMODITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return match ? { name, commodity: match, aiLinked: match.ai, from: match.from } : { name, aiLinked: false };
}

/**
 * Trace the full value chain for a theme. When `focusSymbol` is given, the node(s) that company sits
 * on are flagged so the UI can highlight the company's position in the chain. Companies attached to a
 * node are matched across ALL themes (a company can appear on a node even if its primary theme differs).
 */
export function traceThemeChain(themeSlug: string, focusSymbol?: string): ValueChain | null {
  const theme = getTheme(themeSlug);
  if (!theme) return null;

  const nodes = getNodesForTheme(themeSlug); // already sorted demand-first
  const layers = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const allCompanies = getThemeCompanies(); // every company; match by node membership
  const events = getCapitalEvents(themeSlug);
  const focus = focusSymbol?.toUpperCase();

  const rawMaterialSet = new Map<string, RawMaterial>();

  const tiers: ChainTier[] = layers.map((layer, tierIndex) => {
    const layerNodes = nodes.filter((n) => n.layer === layer);
    const chainNodes: ChainNode[] = layerNodes.map((node) => {
      const companies = allCompanies.filter((c) => c.nodes.includes(node.id));
      const rawMaterials = node.commodities.map(resolveRawMaterial);
      rawMaterials.forEach((rm) => rawMaterialSet.set(rm.name, rm));
      const capital = events.filter((e) => e.node === node.id);
      const hasFocus = Boolean(focus && companies.some((c) => c.symbol.toUpperCase() === focus));
      return { node, companies, rawMaterials, capital, hasFocus };
    });
    return { layer, tierIndex, label: tierLabel(tierIndex, layers.length), nodes: chainNodes };
  });

  return {
    themeSlug,
    themeName: theme.name,
    themeEmoji: theme.emoji,
    thesis: theme.thesis,
    falsifier: theme.falsifier,
    tiers,
    rawMaterials: [...rawMaterialSet.values()].sort((a, b) => a.name.localeCompare(b.name)),
    focusSymbol: focus,
  };
}

export interface CompanyChainPosition {
  symbol: string;
  name: string;
  primaryTheme: string;
  /** Every (theme, node) the company touches, so cross-theme exposure is visible. */
  positions: { themeSlug: string; themeName: string; node: SupplyChainNode; tierLabel: string }[];
  /** All raw materials feeding the nodes this company touches. */
  rawMaterials: RawMaterial[];
}

/**
 * Where does one company sit across the whole map? A company can touch nodes in several themes (NVDA
 * is in AGI infra but also a semiconductor designer), so this resolves EVERY (theme, node) it
 * attaches to and rolls up the raw materials beneath them - the company's full upstream footprint.
 */
export function companyChainPosition(symbol: string): CompanyChainPosition | null {
  const sym = symbol.toUpperCase();
  const company = getThemeCompanies().find((c) => c.symbol.toUpperCase() === sym);
  if (!company) return null;

  const positions: CompanyChainPosition['positions'] = [];
  const rawMaterialSet = new Map<string, RawMaterial>();

  for (const nodeId of company.nodes) {
    const node = getNode(nodeId);
    if (!node) continue;
    const theme = getTheme(node.theme);
    const themeNodes = getNodesForTheme(node.theme);
    const layers = [...new Set(themeNodes.map((n) => n.layer))].sort((a, b) => a - b);
    const tierIndex = layers.indexOf(node.layer);
    positions.push({
      themeSlug: node.theme,
      themeName: theme?.name ?? node.theme,
      node,
      tierLabel: tierLabel(tierIndex, layers.length),
    });
    node.commodities.map(resolveRawMaterial).forEach((rm) => rawMaterialSet.set(rm.name, rm));
  }

  return {
    symbol: company.symbol,
    name: company.name,
    primaryTheme: company.theme,
    positions,
    rawMaterials: [...rawMaterialSet.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface RawMaterialExposure {
  material: RawMaterial;
  /** Nodes across all themes that consume this material. */
  nodes: { node: SupplyChainNode; themeName: string }[];
  /** Small/micro-cap companies sitting downstream of this material. */
  smallCaps: ThemeCompany[];
}

/**
 * The reverse lens: start from a RAW MATERIAL and find the small-caps downstream of it. Lets the
 * founder begin at "copper" or "uranium" and walk out to the emerging names that depend on it - the
 * "back to raw materials" direction of the trace.
 */
export function rawMaterialExposure(materialName: string): RawMaterialExposure {
  const material = resolveRawMaterial(materialName);
  const smallCapsByNode = groupSmallCapsByNode();

  const nodesConsuming: { node: SupplyChainNode; themeName: string }[] = [];
  const downstream = new Map<string, ThemeCompany>();

  for (const theme of allThemesWithNodes()) {
    for (const node of getNodesForTheme(theme.slug)) {
      if (!node.commodities.some((c) => c.toLowerCase() === materialName.toLowerCase())) continue;
      nodesConsuming.push({ node, themeName: theme.name });
      for (const company of smallCapsByNode.get(node.id) ?? []) downstream.set(company.symbol, company);
    }
  }

  return { material, nodes: nodesConsuming, smallCaps: [...downstream.values()] };
}

function groupSmallCapsByNode(): Map<string, ThemeCompany[]> {
  const map = new Map<string, ThemeCompany[]>();
  for (const company of getSmallCapCompanies()) {
    for (const nodeId of company.nodes) {
      const list = map.get(nodeId) ?? [];
      list.push(company);
      map.set(nodeId, list);
    }
  }
  return map;
}

function allThemesWithNodes() {
  // Themes that actually have nodes (avoids importing THEMES directly to keep one source of truth).
  const seen = new Set<string>();
  const out: { slug: string; name: string }[] = [];
  for (const company of getThemeCompanies()) {
    for (const nodeId of company.nodes) {
      const node = getNode(nodeId);
      if (node && !seen.has(node.theme)) {
        seen.add(node.theme);
        const theme = getTheme(node.theme);
        out.push({ slug: node.theme, name: theme?.name ?? node.theme });
      }
    }
  }
  return out;
}
