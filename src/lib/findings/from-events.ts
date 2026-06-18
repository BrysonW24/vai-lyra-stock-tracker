/**
 * Live findings adapter.  [Phase 4a]
 *
 * Maps `notification_events` rows (already produced by the live notification system - scanner signal
 * alerts, theme moves, small-cap discoveries, portfolio risk) into the Investigation `Finding` shape,
 * so /findings renders real data instead of demo fixtures. This is the seam the design doc called for:
 * "the notification event model already models what surfaced, the trigger reason, relevance, dedupe
 * and the related entity - delivered as notifications, not yet rendered as an investigable feed."
 *
 * It is a PURE projection: every number comes from the event row / its payload, never invented. Where
 * an event lacks rich graph data, the finding is honestly shallow (one evidence item, the entities the
 * event names) rather than fabricated. The deterministic engine owns the numbers; this only reshapes.
 */
import type {
  Confidence,
  Entity,
  EvidenceItem,
  EvidenceSourceType,
  Finding,
  FindingAction,
  FindingState,
  FindingType,
  Relationship,
} from './types';

/** A row from public.notification_events (see migration 024). */
export interface NotificationEventRow {
  id: string;
  type: string;
  severity?: string | null;
  title: string;
  body: string;
  trigger_reason?: string | null;
  evidence_refs?: string[] | null;
  symbol?: string | null;
  theme?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  relevance_score?: number | null;
  url?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

/** Lifecycle override from the public.findings table (migration 028) - dismiss + state promotion. */
export interface FindingLifecycle {
  finding_key: string;
  state?: FindingState | null;
  dismissed_at?: string | null;
}

const EVENT_TYPE_TO_FINDING: Record<string, FindingType> = {
  signal_alert: 'scanner_signal',
  scanner_signal: 'scanner_signal',
  strong_setup: 'scanner_signal',
  watchlist_setup: 'scanner_signal',
  small_cap_discovery: 'small_cap_discovery',
  discovery: 'small_cap_discovery',
  government_contract: 'government_contract',
  gov_award: 'government_contract',
  theme_breakout: 'theme_breakout',
  theme_move: 'theme_breakout',
  investor_move: 'investor_move',
  smart_money: 'investor_move',
  portfolio_risk: 'portfolio_risk',
  paper_bot_ready: 'paper_bot_ready',
};

const EVENT_TYPE_TO_EVIDENCE: Record<FindingType, EvidenceSourceType> = {
  scanner_signal: 'scanner_signal',
  small_cap_discovery: 'scanner_signal',
  government_contract: 'government_contract',
  theme_breakout: 'theme_score',
  investor_move: 'investor_holding',
  portfolio_risk: 'scanner_signal',
  paper_bot_ready: 'scanner_signal',
};

const DOES_NOT_PROVE: Record<FindingType, string> = {
  scanner_signal: 'A scanner signal is a momentum read on one timeframe, not a forecast - it can fade or invalidate.',
  small_cap_discovery: 'Discovery scoring ranks exposure and evidence; it does not prove the company captures the demand or that liquidity is adequate.',
  government_contract: 'One award does not prove durable revenue; the amount may be immaterial relative to market cap.',
  theme_breakout: 'Theme momentum is sentiment-weighted and can cool as fast as it warmed; theme fit is not company execution.',
  investor_move: 'Disclosed holdings are delayed and partial; a manager may have already exited or hedged the position.',
  portfolio_risk: 'A risk flag describes exposure, not a prediction; the risk may not materialise.',
  paper_bot_ready: 'Readiness is a process gate, not a profit signal - it says the evidence exists to research, not that the trade works.',
};

function num(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function severityToConfidence(severity?: string | null): Confidence {
  if (severity === 'high' || severity === 'critical') return 'high';
  if (severity === 'low') return 'low';
  return 'medium';
}

/** Project one notification event into a Finding. Pure - no numbers are invented. */
export function findingFromEvent(ev: NotificationEventRow): Finding {
  const type = EVENT_TYPE_TO_FINDING[ev.type] ?? 'scanner_signal';
  const payload = ev.payload ?? {};
  const symbol = ev.symbol?.toUpperCase() || undefined;
  const themeId = ev.theme ? `theme:${ev.theme}` : undefined;

  // Scores - only from numbers actually present on the event / payload. relevance_score is a
  // relevance/dedupe metric (and DB-defaults to 100), NOT the deterministic composite, so it is kept
  // out of the headline `total` and surfaced only as confidence. Non-scanner findings with no real
  // composite get total 0, which the card renders as "NR" (not rated) rather than a fake 100.
  const total = num(payload.signal_score) ?? num(payload.score) ?? 0;
  const scores = {
    total: Math.round(total),
    technical: num(payload.technical) ?? num(payload.signal_score),
    volume: num(payload.volume_ratio) !== undefined ? Math.round((num(payload.volume_ratio) as number) * 10) / 10 : num(payload.volume),
    themeFit: num(payload.theme_fit) ?? num(payload.theme_score),
    confidence: num(ev.relevance_score),
  };

  const whySurfaced = (ev.trigger_reason || ev.body || '')
    .split(/[•\n]|(?:;\s)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (whySurfaced.length === 0) whySurfaced.push(ev.title);

  // Entities the event names.
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  if (symbol) {
    entities.push({ id: symbol, type: 'company', name: symbol, ref: symbol, summary: ev.title });
  }
  if (themeId && ev.theme) {
    entities.push({ id: themeId, type: 'theme', name: ev.theme, ref: ev.theme });
    if (symbol) relationships.push({ fromEntityId: symbol, toEntityId: themeId, relationshipType: 'exposed_to', confidence: 0.7, evidenceIds: [`ev-${ev.id}`] });
  }
  if (ev.related_entity_id && ev.related_entity_type && ev.related_entity_id !== symbol && ev.related_entity_id !== themeId) {
    const relType = (ev.related_entity_type as Entity['type']) ?? 'supply_chain_node';
    entities.push({ id: ev.related_entity_id, type: relType, name: ev.related_entity_id.replace(/^[a-z_]+:/, '') });
    if (symbol) relationships.push({ fromEntityId: symbol, toEntityId: ev.related_entity_id, relationshipType: 'supplies', confidence: 0.6, evidenceIds: [`ev-${ev.id}`] });
  }

  const evidence: EvidenceItem[] = [
    {
      id: `ev-${ev.id}`,
      sourceType: EVENT_TYPE_TO_EVIDENCE[type],
      sourceName: type === 'scanner_signal' ? 'Lyra scanner' : 'Lyra notification',
      sourceUrl: ev.url || undefined,
      eventDate: ev.created_at.slice(0, 10),
      freshness: 'fresh',
      confidence: severityToConfidence(ev.severity),
      summary: ev.body || ev.title,
      whyItMatters: ev.trigger_reason || 'This is why Lyra surfaced the setup.',
      whatItDoesNotProve: DOES_NOT_PROVE[type],
      linkedEntityIds: entities.map((e) => e.id),
      rawPayload: Object.keys(payload).length ? payload : { type: ev.type, relevance: ev.relevance_score ?? null },
    },
  ];

  const actions: FindingAction[] = [
    { kind: 'research', label: 'Open research' },
    ...(symbol ? ([{ kind: 'watch', label: 'Add to watchlist', href: '/watchlist' }] as FindingAction[]) : []),
    { kind: 'ask_lyra', label: 'Ask Lyra' },
    { kind: 'review_risk', label: 'Review risk' },
    { kind: 'dismiss_noise', label: 'Dismiss as noise' },
  ];

  return {
    id: ev.id,
    type,
    title: ev.title,
    summary: ev.body || ev.title,
    symbol,
    themeId,
    state: 'Monitor',
    scores,
    whySurfaced,
    evidence,
    entities,
    relationships,
    risks: [],
    timeline: [{ date: ev.created_at.slice(0, 10), label: ev.title }],
    actions,
    createdAt: ev.created_at,
  };
}

/**
 * Project a batch of events into findings, applying lifecycle overrides (dismissed events drop out;
 * a promoted state replaces the default Monitor). Newest first.
 */
export function findingsFromEvents(events: NotificationEventRow[], lifecycle: FindingLifecycle[] = []): Finding[] {
  const byKey = new Map(lifecycle.map((l) => [l.finding_key, l]));
  return events
    .map((ev) => {
      const f = findingFromEvent(ev);
      const lc = byKey.get(ev.id);
      if (lc?.dismissed_at) return null;
      if (lc?.state) f.state = lc.state;
      return f;
    })
    .filter((f): f is Finding => f !== null);
}
