/**
 * Telegram message templates - deterministic, HTML-native rendering of router-approved events.
 *
 * Telegram is a READING surface, not a wire. It allows 4096 characters and full HTML, so it
 * gets the same grain Slack does (slack-templates.ts) instead of the dense 399-char ASCII
 * fallback in templates.ts - that fallback stays the canonical format for WhatsApp and for
 * anything without rich text.
 *
 * Doctrine unchanged: every value here comes straight off the deterministic event. This module
 * formats numbers and picks emoji; it never creates a number and the AI is not involved.
 *
 * SAFETY: Telegram rejects the whole message (HTTP 400) on malformed HTML, which would drop a
 * real alert. Every interpolated value goes through escapeHtml(), and only the tags Telegram
 * actually supports are emitted - see https://core.telegram.org/bots/api#html-style.
 */
import type { NotificationEvent, NotificationSeverity, NotificationType, VoiceId } from './types';
import { RESEARCH_SUFFIX } from './templates';
import { renderVoiceFraming } from './voice';

/** Telegram renders literal Unicode, not Slack-style :shortcodes:. */
interface TelegramTypeStyle {
  emoji: string;
  label: string;
  /** One-line situational framing - tells the user what KIND of moment this is. */
  framing: string;
}

const TYPE_STYLE: Record<NotificationType, TelegramTypeStyle> = {
  signal_alert: { emoji: '🎯', label: 'Signal', framing: 'A setup crossed your alert threshold.' },
  signal_followup: { emoji: '⏱', label: 'Signal follow-up', framing: 'How an earlier setup actually played out - engine-measured.' },
  theme_breakout: { emoji: '🚀', label: 'Theme breakout', framing: 'A theme you track is moving as a group.' },
  small_cap_discovery: { emoji: '🔬', label: 'Small-cap discovery', framing: 'A new name surfaced by the discovery scan.' },
  capital_event: { emoji: '🏦', label: 'Capital event', framing: 'A raise, buyback, or balance-sheet event hit a tracked name.' },
  investor_move: { emoji: '🐋', label: 'Investor move', framing: 'A tracked investor changed a position.' },
  portfolio_news: { emoji: '📰', label: 'Portfolio news', framing: 'News on a stock in your book.' },
  portfolio_risk: { emoji: '⚠️', label: 'Portfolio risk', framing: 'A risk state changed on a stock you hold.' },
  portfolio_price_move: { emoji: '📈', label: 'Portfolio move', framing: 'A holding moved sharply.' },
  watchlist_price_move: { emoji: '👀', label: 'Watchlist move', framing: 'A watched name is on the move.' },
  paper_trade_opened: { emoji: '🟢', label: 'Paper trade opened', framing: 'The paper bot opened a simulated position.' },
  paper_trade_closed: { emoji: '🏁', label: 'Paper trade closed', framing: 'The paper bot closed a simulated position.' },
  paper_trade_stop_hit: { emoji: '🛑', label: 'Paper stop hit', framing: 'A simulated stop-loss executed.' },
  paper_approval_required: { emoji: '✋', label: 'Paper approval required', framing: 'The paper bot is waiting on your decision.' },
  paper_fill: { emoji: '✅', label: 'Paper fill', framing: 'A simulated order filled.' },
  paper_position_move: { emoji: '↕️', label: 'Paper position move', framing: 'An open simulated position moved sharply.' },
  risk_blocked: { emoji: '⛔', label: 'Risk blocked', framing: 'The risk engine stopped an action before it happened.' },
  order_intent_created: { emoji: '📝', label: 'Order intent', framing: 'An order intent was drafted - nothing has executed.' },
  order_approval_required: { emoji: '🔔', label: 'Approval required', framing: 'An order is waiting on your explicit approval.' },
  order_rejected: { emoji: '❌', label: 'Order rejected', framing: 'The deterministic risk engine rejected an intent.' },
  kill_switch_enabled: { emoji: '🔌', label: 'Kill switch', framing: 'Automated activity has been halted.' },
  daily_digest: { emoji: '☕', label: 'Daily digest', framing: 'Your day in one message.' },
  weekly_report: { emoji: '📊', label: 'Weekly review', framing: 'Your week, scored and measured.' },
  monthly_review: { emoji: '🗓', label: 'Monthly review', framing: 'A month of decisions, measured against what actually happened.' },
  quarterly_review: { emoji: '📆', label: 'Quarterly review', framing: 'Three months in - the trend behind the noise.' },
  yearly_review: { emoji: '🏆', label: 'Year in review', framing: 'A full year of your investing, honestly scored.' },
  macro_event: { emoji: '🏛️', label: 'Macro', framing: 'A central-bank or economic event that moves the whole board.' },
  cgt_anniversary: { emoji: '📅', label: 'CGT anniversary', framing: 'A date from your own records worth knowing about.' },
  test_notification: { emoji: '👋', label: 'Test', framing: 'Just checking this channel reaches you.' },
};

/** Types that report a measured outcome, so a performance badge is meaningful on them. */
const OUTCOME_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'weekly_report',
  'monthly_review',
  'quarterly_review',
  'yearly_review',
  'paper_trade_closed',
  'signal_followup',
]);

/**
 * Performance badge - escalating cash-with-wings so a good period LOOKS good before a
 * single word is read, and a bad one is never dressed up as anything else.
 *
 *   >= +15%  💸💸💸      >= +10%  💸💸      >= +5%  💸
 *   > 0      🟢          flat     ➖         < 0     🔻
 *
 * Tiers are on measured percent from the engine (event.performancePct), never inferred
 * from prose. Honesty is the point: a loss gets a red arrow, not a softer emoji.
 */
export function performanceBadge(pct: number): string {
  if (!Number.isFinite(pct)) return '';
  if (pct >= 15) return '💸💸💸';
  if (pct >= 10) return '💸💸';
  if (pct >= 5) return '💸';
  if (pct > 0) return '🟢';
  if (pct === 0) return '➖';
  return '🔻';
}

/** Signed percent, one decimal - always explicit about direction. */
export function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

const SEVERITY_TAG: Record<NotificationSeverity, string> = {
  low: '',
  medium: '',
  high: '🔴 High priority',
  critical: '🚨 CRITICAL',
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

/** Telegram's hard limit is 4096; stay under it so the adapter never has to truncate mid-tag. */
export const TELEGRAM_MESSAGE_LIMIT = 3_800;

/**
 * Escape the five characters that can break Telegram's HTML parser or inject markup.
 * Telegram only requires &, < and > - we also escape quotes so values are safe inside
 * an attribute (the href on the deep link).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A 10-cell relevance meter, coloured by band so the bar carries meaning on its own:
 * green = strong (70+), amber = middling (40-69), red = weak (<40).
 *
 * Deliberately emoji, not the ▓/░ block characters: Telegram renders those in a monospace
 * face where they come out as a solid black rectangle with a dotted tail - it reads as
 * redacted text, not a score. Emoji render identically on every client.
 */
export function scoreBar(score: number, cells = 10): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * cells);
  const fill = clamped >= 70 ? '🟩' : clamped >= 40 ? '🟨' : '🟥';
  return fill.repeat(filled) + '⬜'.repeat(cells - filled);
}

/** Only http(s) links are emitted - anything else is dropped rather than rendered as a tag. */
function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

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
        ? `👉 <b>Action needed:</b> approve or reject <code>${escapeHtml(event.relatedEntityId)}</code>. Nothing executes without approval.`
        : '👉 <b>Action needed:</b> approve or reject. Nothing executes without approval.';
    case 'order_intent_created':
      return '👉 No order executes without explicit approval.';
    case 'order_rejected':
      return '⛔ Intent blocked by the deterministic risk engine.';
    case 'kill_switch_enabled':
      return '🔌 Automated activity halted until manually re-enabled.';
    case 'risk_blocked':
      return '⛔ Risk gate blocked the action. Nothing executed.';
    default:
      return PAPER_TYPES.has(event.type) ? '<i>Paper trade - no real money moved.</i>' : '';
  }
}

/**
 * Render the Telegram message for an event. Layout:
 *
 *   🎯 <b>Signal</b> · $AMD          <- type emoji, label, symbol chip
 *   🔴 High priority                  <- severity, high/critical only
 *   <i>situational framing</i>        <- voice-aware
 *
 *   <b>title</b>
 *   body
 *
 *   <code>███████░░░</code> 71/100    <- relevance, made visual
 *
 *   💡 <b>Why</b>                     <- provenance, always present
 *   trigger reason
 *
 *   📎 3 linked items                 <- evidence, when carried
 *   👉 action line                    <- approval/risk types
 *   🔗 <a>Open in Lyra</a>
 *   <i>Research, not advice.</i>      <- research types only
 *
 * Body absorbs truncation pressure so provenance, action and the research suffix always survive.
 */
export function buildTelegramTextForEvent(
  event: NotificationEvent,
  options: { voice?: VoiceId; name?: string } = {},
): string {
  const style = TYPE_STYLE[event.type];
  const severity = event.severity ? SEVERITY_TAG[event.severity] : '';
  // Voice controls the framing prose only - null keeps the house line, '' omits it.
  const voicedFraming = renderVoiceFraming(event, options.voice ?? 'analyst', { name: options.name });
  const framing = voicedFraming === null ? style.framing : voicedFraming;

  const symbol =
    event.relatedEntityType === 'symbol' && event.relatedEntityId
      ? ` · <code>$${escapeHtml(event.relatedEntityId.toUpperCase())}</code>`
      : '';

  // Performance rides in the header for outcome types, so a good period is visible from the
  // chat list without opening the message - which is the whole point of a review.
  const perf =
    OUTCOME_TYPES.has(event.type) && Number.isFinite(event.performancePct)
      ? `${performanceBadge(event.performancePct!)} <b>${formatPct(event.performancePct!)}</b>`
      : '';

  // One dense header line: what fired, on what, how it went, how urgent.
  const head = [`${style.emoji} <b>${escapeHtml(style.label)}</b>${symbol}`, perf, severity]
    .filter(Boolean)
    .join(' · ');

  // No <code> wrapper - emoji need no monospace, and Telegram's mono face mangles them.
  const meter = Number.isFinite(event.relevanceScore)
    ? `${scoreBar(event.relevanceScore)}  <b>${Math.round(event.relevanceScore)}</b>/100`
    : '';

  const evidence =
    event.evidenceRefs.length > 0
      ? `📎 ${event.evidenceRefs.length} linked item${event.evidenceRefs.length === 1 ? '' : 's'}`
      : '';

  const action = actionLine(event);
  const url = safeUrl(event.url);
  const link = url ? `🔗 <a href="${escapeHtml(url)}">Open in Lyra</a>` : '';
  const suffix = SIGNAL_LIKE_TYPES.has(event.type) ? `<i>${RESEARCH_SUFFIX}</i>` : '';

  // Blockquote gives the provenance a real indent bar - it reads as a citation, which is
  // exactly what it is, and visually separates the engine's reason from the narrative body.
  const why = `<blockquote>💡 <b>Why:</b> ${escapeHtml(event.triggerReason.trim())}</blockquote>`;
  const title = `<b>${escapeHtml(event.title.trim())}</b>`;
  const framingLine = framing ? `<i>${escapeHtml(framing)}</i>` : '';
  const footer = [evidence, link].filter(Boolean).join('  ·  ');

  // Everything except the body is fixed cost; the body gets whatever budget is left.
  const fixed = [head, title, framingLine, meter, why, footer, action, suffix].filter(Boolean);
  const fixedLength = fixed.reduce((sum, block) => sum + block.length + 2, 0);
  const bodyBudget = TELEGRAM_MESSAGE_LIMIT - fixedLength;
  const rawBody = event.body.trim();
  const body = bodyBudget > 16 && rawBody ? escapeHtml(clamp(rawBody, bodyBudget)) : '';

  const blocks = [
    [head, title, framingLine].filter(Boolean).join('\n'),
    meter,
    body,
    why,
    action,
    [footer, suffix].filter(Boolean).join('\n'),
  ].filter(Boolean);

  return blocks.join('\n\n');
}
