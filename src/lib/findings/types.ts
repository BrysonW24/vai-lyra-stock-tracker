/**
 * Investigation System - core types.  [Phase 1]
 *
 * The model behind Lyra's "progressive investigation interface": every surfaced company, contract,
 * theme shift, investor move, or price move is an Opportunity FINDING. A finding links to EVIDENCE,
 * evidence links to ENTITIES, entities link to other entities via RELATIONSHIPS, and the user peels
 * back each layer through a nested drawer stack. The deterministic engine owns every number; the
 * AI explains. Every evidence item carries an explicit "what it does not prove" so this is trusted
 * investigation, not hype - the same research-not-advice doctrine the rest of Lyra runs on.
 *
 * This module is presentation-layer truth: it composes data Lyra already produces (notification
 * events, scanner signals, world-radar themes/supply-chain nodes, research_analyst cited evidence,
 * small-cap research) into one investigable shape. Net-new persistence is deferred to a later phase;
 * Phase 1 runs on demo data to prove the interaction model.
 */

/** Where a finding sits in its research lifecycle. Findings accrete evidence and get promoted. */
export type FindingState =
  | 'Monitor'
  | 'Watchlist candidate'
  | 'Deep research candidate'
  | 'Paper-bot research queue'
  | 'Review risk';

export type FindingType =
  | 'small_cap_discovery'
  | 'government_contract'
  | 'theme_breakout'
  | 'scanner_signal'
  | 'investor_move'
  | 'portfolio_risk'
  | 'paper_bot_ready';

export type Confidence = 'high' | 'medium' | 'low';

/** Freshness of an evidence item relative to its event - drives the "is this still true?" read. */
export type Freshness = 'fresh' | 'recent' | 'stale' | 'delayed';

export type EvidenceSourceType =
  | 'government_contract'
  | 'filing'
  | 'patent'
  | 'investor_holding'
  | 'scanner_signal'
  | 'news'
  | 'theme_score';

export type EntityType =
  | 'company'
  | 'theme'
  | 'supply_chain_node'
  | 'commodity'
  | 'government_agency'
  | 'contract'
  | 'patent'
  | 'filing'
  | 'investor';

/** Typed relationship edges between entities - the graph layer. */
export type RelationshipType =
  | 'exposed_to'
  | 'won_contract_from'
  | 'supplies'
  | 'depends_on'
  | 'mentioned_in'
  | 'owned_by'
  | 'increased_by'
  | 'affects_portfolio'
  | 'eligible_for_paper_bot';

/** Research-only action vocabulary. NEVER "Buy" - Lyra researches, it does not advise. */
export type FindingActionKind =
  | 'research'
  | 'watch'
  | 'monitor'
  | 'compare'
  | 'ask_lyra'
  | 'set_alert'
  | 'paper_bot'
  | 'review_risk'
  | 'dismiss_noise';

export interface FindingScores {
  /** 0-100 composite. The headline. */
  total: number;
  government?: number;
  technical?: number;
  volume?: number;
  themeFit?: number;
  /** Subtracted, not added - higher = more risk. */
  riskPenalty?: number;
  confidence?: number;
}

export interface EvidenceItem {
  id: string;
  sourceType: EvidenceSourceType;
  /** Human source name, e.g. "USAspending / SAM.gov" or "Lyra scanner". */
  sourceName: string;
  sourceUrl?: string;
  eventDate: string;
  freshness: Freshness;
  confidence: Confidence;
  summary: string;
  /** Why this advances the thesis. */
  whyItMatters: string;
  /** The honesty line - the limits of this single piece of evidence. Never empty. */
  whatItDoesNotProve: string;
  /** Entity ids this evidence touches (company / theme / node / agency). */
  linkedEntityIds: string[];
  /** The raw underlying object (award row, signal snapshot, holding) for the source-record drawer. */
  rawPayload?: Record<string, unknown>;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  /** Short symbol/code where relevant (ticker, award id, agency code). */
  ref?: string;
  /** One-line "why it matters" for the entity drawer. */
  summary?: string;
  /** Freeform, type-specific facts rendered as a definition list in the entity drawer. */
  facts?: { label: string; value: string }[];
}

export interface Relationship {
  fromEntityId: string;
  toEntityId: string;
  relationshipType: RelationshipType;
  /** 0-1. */
  confidence: number;
  evidenceIds: string[];
}

export interface TimelineEvent {
  date: string;
  label: string;
  /** Optional pointer to the evidence that produced this timeline beat. */
  evidenceId?: string;
  /** A state promotion (e.g. "promoted to Watchlist candidate") renders distinctly. */
  stateChange?: FindingState;
}

export interface RiskNote {
  id: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface FindingAction {
  kind: FindingActionKind;
  label: string;
  /** Optional deep-link target (e.g. /watchlist, /paper-bot, /tickers/BKSY). */
  href?: string;
}

export interface Finding {
  id: string;
  type: FindingType;
  title: string;
  /** One-line thesis - the executive summary that opens the drawer. */
  summary: string;
  symbol?: string;
  themeId?: string;
  state: FindingState;
  scores: FindingScores;
  /** The mandatory "Why surfaced" lines (evidence / market / technical / theme / risk). */
  whySurfaced: string[];
  evidence: EvidenceItem[];
  entities: Entity[];
  relationships: Relationship[];
  risks: RiskNote[];
  timeline: TimelineEvent[];
  actions: FindingAction[];
  createdAt: string;
}

// ---- Drawer stack (URL-persisted, nested investigation) -------------------------------------

export type DrawerType =
  | 'finding'
  | 'evidence'
  | 'source_record'
  | 'company'
  | 'theme'
  | 'supply_chain_node'
  | 'investor'
  | 'risk';

export interface DrawerStackItem {
  type: DrawerType;
  /** Finding id, evidence id, or entity id depending on type. */
  id: string;
  /** Optional display title carried for breadcrumb without a re-lookup. */
  title?: string;
}

/** Section groupings for the /intelligence feed. */
export type FeedSection =
  | 'top_signal'
  | 'paper_bot_queue'
  | 'government_backed'
  | 'accumulation'
  | 'theme_acceleration'
  | 'supply_chain_bottleneck'
  | 'portfolio_impact'
  | 'watchlist_movement';

export const FEED_SECTION_LABELS: Record<FeedSection, string> = {
  top_signal: "Today's highest-signal findings",
  paper_bot_queue: 'Paper-bot research queue',
  government_backed: 'Government-backed discoveries',
  accumulation: 'Insider / institutional accumulation',
  theme_acceleration: 'Theme acceleration',
  supply_chain_bottleneck: 'Supply-chain bottlenecks',
  portfolio_impact: 'Portfolio-impacting findings',
  watchlist_movement: 'Watchlist movement',
};

/** Tone colour for a finding state (dense dark aesthetic). Returns a Tailwind text class. */
export function stateTone(state: FindingState): string {
  switch (state) {
    case 'Paper-bot research queue':
      return 'text-[#43d18b]';
    case 'Deep research candidate':
    case 'Watchlist candidate':
      return 'text-[#60a5fa]';
    case 'Review risk':
      return 'text-[#f3a33a]';
    default:
      return 'text-[#8190a0]';
  }
}
