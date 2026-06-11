/**
 * WhatsApp message template builders - typed, deterministic, no AI. [Part 9]
 *
 * WhatsApp business-initiated messages outside the 24-hour customer-service window
 * MUST use pre-approved templates registered in Meta Business Manager. The canonical
 * body text for each template lives here (used for registration and for demo-mode
 * previews); builders only fill the {{n}} parameter slots with values produced by the
 * deterministic engine (workers/stock_scanner, src/lib/trading/risk-engine.ts).
 *
 * Doctrine: AI never originates a notification and never invents a number - every
 * value passed into a template parameter is a verbatim deterministic field
 * (src/lib/notifications/types.ts). The order-approval template carries the explicit
 * "research platform - live execution disabled" line because no live broker
 * execution exists in this codebase (src/lib/trading/risk-engine.ts fails closed on
 * any live mode).
 */

export type WhatsAppTemplateName =
  | 'lyra_signal_alert'
  | 'lyra_daily_digest'
  | 'lyra_portfolio_risk'
  | 'lyra_order_approval_required';

export interface WhatsAppTemplateParameter {
  type: 'text';
  text: string;
}

export interface WhatsAppTemplateComponent {
  type: 'body';
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateMessage {
  kind: 'template';
  name: WhatsAppTemplateName;
  languageCode: string;
  components: WhatsAppTemplateComponent[];
  /** Deterministic rendering of the full body - used for demo-mode logs and tests. */
  previewText: string;
}

export interface WhatsAppTextMessage {
  kind: 'text';
  body: string;
}

export type WhatsAppOutboundMessage = WhatsAppTemplateMessage | WhatsAppTextMessage;

/**
 * Canonical template bodies as registered in Meta Business Manager. If a body changes
 * here it must be re-submitted for approval there - the two must never drift.
 */
export const WHATSAPP_TEMPLATE_BODIES: Record<WhatsAppTemplateName, string> = {
  lyra_signal_alert:
    'Lyra signal: {{1}} score {{2}} ({{3}} vs last scan). Action state: {{4}}. Trigger: {{5}}. Review the evidence in the web app: {{6}}. Research, not advice.',
  lyra_daily_digest:
    'Lyra daily digest for {{1}}. Top movers: {{2}}. Watchlist triggers: {{3}}. Portfolio: {{4}}. Full digest: {{5}}. Research, not advice.',
  lyra_portfolio_risk:
    'Lyra portfolio risk: {{1}} is {{2}}. {{3}}. Review in the web app: {{4}}. Research, not advice.',
  lyra_order_approval_required:
    'Lyra approval requested: {{1}} {{2}} {{3}} (~{{4}}) from strategy {{5}}. Reply APPROVE {{6}} or REJECT {{6}}, or decide in the web app. This is a research platform - live execution disabled. Approving records a paper decision only; no live order can be placed.',
};

const DEFAULT_LANGUAGE_CODE = 'en';

/**
 * WhatsApp rejects template parameters containing newlines, tabs, or 4+ consecutive
 * spaces. Sanitise every parameter so a stray value can never break a send.
 */
function sanitizeParameter(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

function textParam(value: string): WhatsAppTemplateParameter {
  return { type: 'text', text: sanitizeParameter(value) };
}

/** Render the registered body with the given parameters - demo-mode preview truth. */
export function renderTemplatePreview(name: WhatsAppTemplateName, parameters: string[]): string {
  return WHATSAPP_TEMPLATE_BODIES[name].replace(/\{\{(\d+)\}\}/g, (match, index: string) => {
    const value = parameters[Number(index) - 1];
    return value === undefined ? match : sanitizeParameter(value);
  });
}

function buildTemplate(name: WhatsAppTemplateName, parameters: string[]): WhatsAppTemplateMessage {
  return {
    kind: 'template',
    name,
    languageCode: DEFAULT_LANGUAGE_CODE,
    components: [{ type: 'body', parameters: parameters.map(textParam) }],
    previewText: renderTemplatePreview(name, parameters),
  };
}

// --- signal_alert -------------------------------------------------------------

export interface SignalAlertTemplateInput {
  symbol: string;
  /** Deterministic 0-100 signal score from the scanner. */
  signalScore: number;
  /** Score delta vs the previous scan - signed. */
  scoreDelta: number;
  /** Deterministic action state, e.g. "watch", "entry_zone". */
  actionState: string;
  /** Deterministic trigger reason from the alert engine - never AI-originated. */
  triggerReason: string;
  /** Deep link back to the evidence in the web app. */
  evidenceUrl: string;
}

export function buildSignalAlertTemplate(input: SignalAlertTemplateInput): WhatsAppTemplateMessage {
  const delta = input.scoreDelta >= 0 ? `+${input.scoreDelta}` : String(input.scoreDelta);
  return buildTemplate('lyra_signal_alert', [
    input.symbol,
    String(input.signalScore),
    delta,
    input.actionState,
    input.triggerReason,
    input.evidenceUrl,
  ]);
}

// --- daily_digest ---------------------------------------------------------------

export interface DailyDigestTemplateInput {
  /** Human date label, e.g. "Wed 11 Jun". */
  dateLabel: string;
  /** Deterministic top movers, already ranked by the engine. */
  topMovers: Array<{ symbol: string; signalScore: number; scoreDelta: number }>;
  watchlistTriggerCount: number;
  /** One-line deterministic portfolio summary, e.g. "2 holdings flagged, none critical". */
  portfolioSummary: string;
  digestUrl: string;
}

export function buildDailyDigestTemplate(input: DailyDigestTemplateInput): WhatsAppTemplateMessage {
  const movers =
    input.topMovers.length === 0
      ? 'no significant movers'
      : input.topMovers
          .slice(0, 3)
          .map((m) => `${m.symbol} ${m.signalScore} (${m.scoreDelta >= 0 ? '+' : ''}${m.scoreDelta})`)
          .join(', ');
  return buildTemplate('lyra_daily_digest', [
    input.dateLabel,
    movers,
    String(input.watchlistTriggerCount),
    input.portfolioSummary,
    input.digestUrl,
  ]);
}

// --- portfolio_risk -------------------------------------------------------------

export interface PortfolioRiskTemplateInput {
  symbol: string;
  /** Deterministic risk state from the portfolio overlay, e.g. "stop_proximity". */
  riskState: string;
  /** One-line deterministic detail, e.g. "Price within 2.1% of stop level". */
  detail: string;
  evidenceUrl: string;
}

export function buildPortfolioRiskTemplate(input: PortfolioRiskTemplateInput): WhatsAppTemplateMessage {
  return buildTemplate('lyra_portfolio_risk', [
    input.symbol,
    input.riskState,
    input.detail,
    input.evidenceUrl,
  ]);
}

// --- order_approval_required -----------------------------------------------------

export interface OrderApprovalTemplateInput {
  /** Order intent fields - produced by deterministic strategy logic, never by AI. */
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  notionalValue: number;
  strategyId: string;
  /**
   * Short single-use approval code minted server-side for this intent. Inbound
   * APPROVE/REJECT replies must match it exactly (src/lib/notifications/types.ts:
   * "High-risk inbound commands require an exact pending-approval match").
   */
  approvalCode: string;
}

/**
 * Approval-request template. The registered body hard-codes the line
 * "This is a research platform - live execution disabled." because the pre-trade
 * engine refuses every live mode (src/lib/trading/risk-engine.ts, check
 * no_live_execution) - approving via WhatsApp can only ever record a paper decision.
 */
export function buildOrderApprovalRequiredTemplate(
  input: OrderApprovalTemplateInput,
): WhatsAppTemplateMessage {
  return buildTemplate('lyra_order_approval_required', [
    input.symbol,
    input.side,
    String(input.quantity),
    `$${input.notionalValue.toFixed(2)}`,
    input.strategyId,
    input.approvalCode,
  ]);
}
