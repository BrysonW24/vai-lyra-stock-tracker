/**
 * Notification text templates - deterministic rendering of router-approved events.  [NOTIF-02]
 *
 * One dense, mono-friendly message per NotificationType: plain ASCII, newline
 * separated, always under 400 characters so it fits a single Telegram/WhatsApp
 * bubble without wrapping into noise. The trigger reason is always included
 * (deterministic provenance), and every signal-like type carries an explicit
 * "Research, not advice." suffix. AI may rephrase a payload elsewhere; this module
 * is the no-LLM fallback and the canonical wire format.
 */
import type { NotificationEvent, NotificationType } from './types';

export const RESEARCH_SUFFIX = 'Research, not advice.';

/** Hard cap - the rendered message is always strictly under 400 characters. */
export const MAX_MESSAGE_LENGTH = 399;

const HEADER_BUDGET = 90;
const REASON_BUDGET = 130;

/** Compact uppercase label per type - the first thing the eye hits in a chat list. */
const TYPE_LABELS: Record<NotificationType, string> = {
  signal_alert: 'SIGNAL',
  signal_followup: 'SIGNAL FOLLOW-UP',
  theme_breakout: 'THEME BREAKOUT',
  small_cap_discovery: 'SMALL CAP',
  capital_event: 'CAPITAL EVENT',
  investor_move: 'INVESTOR MOVE',
  portfolio_news: 'PORTFOLIO NEWS',
  portfolio_risk: 'PORTFOLIO RISK',
  portfolio_price_move: 'PORTFOLIO MOVE',
  watchlist_price_move: 'WATCHLIST MOVE',
  paper_trade_opened: 'PAPER OPEN',
  paper_trade_closed: 'PAPER CLOSE',
  paper_trade_stop_hit: 'PAPER STOP',
  paper_approval_required: 'PAPER APPROVAL',
  paper_fill: 'PAPER FILL',
  paper_position_move: 'PAPER MOVE',
  risk_blocked: 'RISK BLOCKED',
  order_intent_created: 'ORDER INTENT',
  order_approval_required: 'APPROVAL REQUIRED',
  order_rejected: 'ORDER REJECTED',
  kill_switch_enabled: 'KILL SWITCH',
  daily_digest: 'DAILY DIGEST',
  weekly_report: 'WEEKLY REPORT',
  test_notification: 'TEST',
};

/**
 * Types whose content is market research output (signals, discoveries, news,
 * digests). These always carry the research-not-advice suffix. Account-activity
 * types (paper trades, order lifecycle, kill switch) describe the user's own
 * system state and are not framed as research.
 */
const SIGNAL_LIKE_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'signal_alert',
  'signal_followup',
  'theme_breakout',
  'small_cap_discovery',
  'capital_event',
  'investor_move',
  'portfolio_news',
  'portfolio_risk',
  'portfolio_price_move',
  'watchlist_price_move',
  'daily_digest',
  'weekly_report',
]);

/** Truncate with a trailing ellipsis marker, never exceeding `max` characters. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, Math.max(0, max));
  return `${text.slice(0, max - 3)}...`;
}

/** Per-type trailing context line. Empty string means no extra line. */
function typeExtraLine(event: NotificationEvent): string {
  switch (event.type) {
    case 'order_approval_required':
    case 'paper_approval_required':
      return event.relatedEntityId
        ? `Action: approve ${event.relatedEntityId} or reject ${event.relatedEntityId}. Nothing executes without approval.`
        : 'Action: approve or reject. Nothing executes without approval.';
    case 'order_intent_created':
      return 'No order executes without explicit approval.';
    case 'order_rejected':
      return 'Intent blocked by the deterministic risk engine.';
    case 'kill_switch_enabled':
      return 'Automated activity halted until manually re-enabled.';
    case 'paper_trade_opened':
    case 'paper_trade_closed':
    case 'paper_trade_stop_hit':
    case 'paper_fill':
    case 'paper_position_move':
      return 'Paper trade - no real money moved.';
    case 'risk_blocked':
      return 'Risk gate blocked action. Nothing executed.';
    default:
      return '';
  }
}

/**
 * Render the canonical single-message text for an event. Layout:
 *
 *   [LABEL] title
 *   body (clamped to the remaining budget)
 *   Why: triggerReason
 *   <per-type action/context line>
 *   Research, not advice.   (signal-like types only)
 *
 * The body absorbs all truncation pressure so the trigger reason, action line,
 * and research suffix always survive intact.
 */
export function renderNotificationText(event: NotificationEvent): string {
  const header = clamp(`[${TYPE_LABELS[event.type]}] ${event.title}`.trim(), HEADER_BUDGET);
  const why = clamp(`Why: ${event.triggerReason}`, REASON_BUDGET);
  const extra = typeExtraLine(event);
  const suffix = SIGNAL_LIKE_TYPES.has(event.type) ? RESEARCH_SUFFIX : '';

  const fixedLines = [header, why, extra, suffix].filter((line) => line.length > 0);
  // +1 newline per fixed line covers the joins, including the body's own join.
  const fixedLength = fixedLines.reduce((sum, line) => sum + line.length, 0) + fixedLines.length;
  const bodyBudget = MAX_MESSAGE_LENGTH - fixedLength;
  const body = bodyBudget > 8 ? clamp(event.body.trim(), bodyBudget) : '';

  const lines = [header, body, why, extra, suffix].filter((line) => line.length > 0);
  return clamp(lines.join('\n'), MAX_MESSAGE_LENGTH);
}

/**
 * Push-tuned body. The OS notification already shows the title bold, so this omits the
 * `[LABEL] title` header line but keeps the data body, the `Why:` provenance line, the per-type
 * action line, and the `Research, not advice.` suffix. Used for web push so it carries the same
 * substance as the Telegram/WhatsApp message instead of a bare title.
 */
export function renderNotificationPushBody(event: NotificationEvent): string {
  const why = clamp(`Why: ${event.triggerReason}`, REASON_BUDGET);
  const extra = typeExtraLine(event);
  const suffix = SIGNAL_LIKE_TYPES.has(event.type) ? RESEARCH_SUFFIX : '';
  const fixedLines = [why, extra, suffix].filter((line) => line.length > 0);
  const fixedLength = fixedLines.reduce((sum, line) => sum + line.length, 0) + fixedLines.length;
  const bodyBudget = MAX_MESSAGE_LENGTH - fixedLength;
  const body = bodyBudget > 8 ? clamp(event.body.trim(), bodyBudget) : '';
  const lines = [body, why, extra, suffix].filter((line) => line.length > 0);
  return clamp(lines.join('\n'), MAX_MESSAGE_LENGTH);
}
