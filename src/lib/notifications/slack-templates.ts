/**
 * Slack message templates - deterministic, mrkdwn-native rendering of router-approved
 * events. Telegram/WhatsApp keep the dense ASCII wire format (templates.ts); Slack is a
 * reading surface, so each NotificationType gets its own emoji, framing line, and the
 * full grain of data the event actually carries: what fired, why (trigger provenance),
 * how relevant, how severe, the evidence count, and a deep link back into Lyra.
 *
 * Doctrine unchanged: every value below comes straight off the deterministic event -
 * this module formats numbers, it never creates them. AI is not involved.
 */
import type { NotificationEvent, NotificationSeverity, NotificationType, VoiceId } from './types';
import { RESEARCH_SUFFIX } from './templates';
import { renderVoiceFraming } from './voice';

/** Slack renders shortcodes everywhere (including plain-text fallbacks), so we use them over literals. */
interface SlackTypeStyle {
  emoji: string;
  label: string;
  /** One-line situational framing shown under the header - tells the user what KIND of moment this is. */
  framing: string;
}

const TYPE_STYLE: Record<NotificationType, SlackTypeStyle> = {
  signal_alert: { emoji: ':dart:', label: 'Signal', framing: 'A setup crossed your alert threshold.' },
  signal_followup: { emoji: ':stopwatch:', label: 'Signal follow-up', framing: 'How an earlier setup actually played out - engine-measured.' },
  theme_breakout: { emoji: ':rocket:', label: 'Theme breakout', framing: 'A theme you track is moving as a group.' },
  small_cap_discovery: { emoji: ':microscope:', label: 'Small-cap discovery', framing: 'A new name surfaced by the discovery scan.' },
  capital_event: { emoji: ':bank:', label: 'Capital event', framing: 'A raise, buyback, or balance-sheet event hit a tracked name.' },
  investor_move: { emoji: ':whale:', label: 'Investor move', framing: 'A tracked investor changed a position.' },
  portfolio_news: { emoji: ':newspaper:', label: 'Portfolio news', framing: 'News on a stock in your book.' },
  portfolio_risk: { emoji: ':warning:', label: 'Portfolio risk', framing: 'A risk state changed on a stock you hold.' },
  portfolio_price_move: { emoji: ':chart_with_upwards_trend:', label: 'Portfolio move', framing: 'A holding moved sharply.' },
  watchlist_price_move: { emoji: ':eyes:', label: 'Watchlist move', framing: 'A watched name is on the move.' },
  paper_trade_opened: { emoji: ':large_green_circle:', label: 'Paper trade opened', framing: 'The paper bot opened a simulated position.' },
  paper_trade_closed: { emoji: ':checkered_flag:', label: 'Paper trade closed', framing: 'The paper bot closed a simulated position.' },
  paper_trade_stop_hit: { emoji: ':octagonal_sign:', label: 'Paper stop hit', framing: 'A simulated stop-loss executed.' },
  paper_approval_required: { emoji: ':raised_hand:', label: 'Paper approval required', framing: 'The paper bot is waiting on your decision.' },
  paper_fill: { emoji: ':white_check_mark:', label: 'Paper fill', framing: 'A simulated order filled.' },
  paper_position_move: { emoji: ':arrow_up_down:', label: 'Paper position move', framing: 'An open simulated position moved sharply.' },
  risk_blocked: { emoji: ':no_entry:', label: 'Risk blocked', framing: 'The risk engine stopped an action before it happened.' },
  order_intent_created: { emoji: ':memo:', label: 'Order intent', framing: 'An order intent was drafted - nothing has executed.' },
  order_approval_required: { emoji: ':bell:', label: 'Approval required', framing: 'An order is waiting on your explicit approval.' },
  order_rejected: { emoji: ':x:', label: 'Order rejected', framing: 'The deterministic risk engine rejected an intent.' },
  kill_switch_enabled: { emoji: ':electric_plug:', label: 'Kill switch', framing: 'Automated activity has been halted.' },
  daily_digest: { emoji: ':coffee:', label: 'Daily digest', framing: 'Your day in one message.' },
  weekly_report: { emoji: ':bar_chart:', label: 'Weekly review', framing: 'Your week, scored and measured.' },
  monthly_review: { emoji: ':calendar:', label: 'Monthly review', framing: 'A month of decisions, measured against what actually happened.' },
  quarterly_review: { emoji: ':date:', label: 'Quarterly review', framing: 'Three months in - the trend behind the noise.' },
  yearly_review: { emoji: ':trophy:', label: 'Year in review', framing: 'A full year of your investing, honestly scored.' },
  macro_event: { emoji: ':classical_building:', label: 'Macro', framing: 'A central-bank or economic event that moves the whole board.' },
  cgt_anniversary: { emoji: ':spiral_calendar_pad:', label: 'CGT anniversary', framing: 'A date from your own records worth knowing about.' },
  test_notification: { emoji: ':wave:', label: 'Test', framing: 'Just checking this channel reaches you.' },
};

const SEVERITY_TAG: Record<NotificationSeverity, string> = {
  low: '',
  medium: '',
  high: ':red_circle: High priority',
  critical: ':rotating_light: *CRITICAL*',
};

/** Same research/account split as templates.ts - research output carries the suffix, account activity does not. */
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
  'monthly_review',
  'quarterly_review',
  'yearly_review',
  'macro_event',
]);

const PAPER_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'paper_trade_opened',
  'paper_trade_closed',
  'paper_trade_stop_hit',
  'paper_approval_required',
  'paper_fill',
  'paper_position_move',
]);

/**
 * Types that report a measured outcome - same roster as telegram-templates. Only these may
 * show the performance grain, and only from event.performancePct (engine-measured): a
 * renderer must never infer "this went well" from prose.
 */
const OUTCOME_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'weekly_report',
  'monthly_review',
  'quarterly_review',
  'yearly_review',
  'paper_trade_closed',
  'signal_followup',
]);

/**
 * Slack-native mirror of the Telegram cash-with-wings tiers (shortcodes, per this file's
 * doctrine): 5% one, 10% two, 15% three; modest gain green dot, flat dash, loss red triangle.
 */
function slackPerformanceBadge(pct: number): string {
  if (!Number.isFinite(pct)) return '';
  if (pct >= 15) return ':money_with_wings::money_with_wings::money_with_wings:';
  if (pct >= 10) return ':money_with_wings::money_with_wings:';
  if (pct >= 5) return ':money_with_wings:';
  if (pct > 0) return ':large_green_circle:';
  if (pct === 0) return ':heavy_minus_sign:';
  return ':small_red_triangle_down:';
}

function formatSlackPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** Keep comfortably inside the adapter's 4000-char clamp while allowing digests room to breathe. */
export const SLACK_MESSAGE_LIMIT = 2_900;

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

/** Per-type action/context tail - mirrors templates.ts so channels never disagree on meaning. */
function actionLine(event: NotificationEvent): string {
  switch (event.type) {
    case 'order_approval_required':
    case 'paper_approval_required':
      return event.relatedEntityId
        ? `:point_right: *Action needed:* approve or reject \`${event.relatedEntityId}\`. Nothing executes without approval.`
        : ':point_right: *Action needed:* approve or reject. Nothing executes without approval.';
    case 'order_intent_created':
      return 'No order executes without explicit approval.';
    case 'order_rejected':
      return 'Intent blocked by the deterministic risk engine.';
    case 'kill_switch_enabled':
      return 'Automated activity halted until manually re-enabled.';
    case 'risk_blocked':
      return 'Risk gate blocked the action. Nothing executed.';
    default:
      return PAPER_TYPES.has(event.type) ? '_Paper trade - no real money moved._' : '';
  }
}

/**
 * Render the Slack message for an event. Layout:
 *
 *   :emoji: *Label* - severity tag (high/critical only)
 *   _situational framing line_
 *   *title*
 *   body
 *   > Why: trigger reason              (provenance, always present)
 *   > Symbol / Relevance / Evidence    (whichever grains the event carries)
 *   :point_right: action line          (approval/risk/paper types)
 *   <url|Open in Lyra>
 *   _Research, not advice._            (research types only)
 */
export function buildSlackTextForEvent(
  event: NotificationEvent,
  options: { voice?: VoiceId; name?: string } = {},
): string {
  const style = TYPE_STYLE[event.type];
  const severity = event.severity ? SEVERITY_TAG[event.severity] : '';
  // Voice controls the framing prose only - null keeps the house per-type line,
  // '' omits it (minimal), anything else replaces it. Numbers are untouched.
  const voicedFraming = renderVoiceFraming(event, options.voice ?? 'analyst', { name: options.name });
  const framing = voicedFraming === null ? style.framing : voicedFraming;

  const header = severity ? `${style.emoji} *${style.label}* - ${severity}` : `${style.emoji} *${style.label}*`;

  const grains: string[] = [];
  if (OUTCOME_TYPES.has(event.type) && Number.isFinite(event.performancePct)) {
    grains.push(
      `> *Period return:* ${slackPerformanceBadge(event.performancePct!)} *${formatSlackPct(event.performancePct!)}*`,
    );
  }
  grains.push(`> *Why:* ${event.triggerReason}`);
  if (event.relatedEntityType === 'symbol' && event.relatedEntityId) {
    grains.push(`> *Symbol:* \`${event.relatedEntityId.toUpperCase()}\``);
  }
  if (Number.isFinite(event.relevanceScore)) {
    grains.push(`> *Relevance:* ${event.relevanceScore}/100`);
  }
  if (event.evidenceRefs.length > 0) {
    grains.push(`> *Evidence:* ${event.evidenceRefs.length} linked item${event.evidenceRefs.length === 1 ? '' : 's'}`);
  }

  const lines = [
    header,
    framing ? `_${framing}_` : '',
    `*${event.title.trim()}*`,
    event.body.trim(),
    ...grains,
    actionLine(event),
    event.url ? `<${event.url}|Open in Lyra>` : '',
    SIGNAL_LIKE_TYPES.has(event.type) ? `_${RESEARCH_SUFFIX}_` : '',
  ].filter((line) => line.length > 0);

  return clamp(lines.join('\n'), SLACK_MESSAGE_LIMIT);
}
