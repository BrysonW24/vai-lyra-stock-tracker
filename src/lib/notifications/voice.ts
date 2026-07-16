/**
 * Agent voice presets - pre-created template sets that control HOW alerts speak,
 * never WHAT they say. Each preset supplies one framing line per event FAMILY with
 * variable slots ({name}, {symbol}) filled deterministically from the event and the
 * user's profile. The engine-owned parts of a message (title, body, Why, relevance,
 * evidence, links, action lines, the research disclaimer) are identical in every
 * voice - a personality can rewrite the greeting, not the numbers.
 *
 * Design notes:
 * - 'analyst' returns null framing: the channel template keeps its own per-type
 *   framing line (the house voice). Other presets override at family granularity.
 * - 'minimal' returns '' - the framing line is omitted entirely.
 * - {name} degrades gracefully: "{name}, worth a look" with no name becomes
 *   "Worth a look".
 * - A future 'ai' voice can slot in here (BYOK rephrase behind the same fabrication
 *   guard GenUI uses); these presets stay as the no-LLM fallback, per doctrine.
 */
import type { NotificationEvent, NotificationType, VoiceId } from './types';

export type EventFamily = 'research' | 'portfolio' | 'watchlist' | 'paper' | 'orders' | 'digest' | 'test';

const FAMILY_BY_TYPE: Record<NotificationType, EventFamily> = {
  signal_alert: 'research',
  signal_followup: 'research',
  theme_breakout: 'research',
  small_cap_discovery: 'research',
  capital_event: 'research',
  investor_move: 'research',
  portfolio_news: 'portfolio',
  portfolio_risk: 'portfolio',
  portfolio_price_move: 'portfolio',
  watchlist_price_move: 'watchlist',
  paper_trade_opened: 'paper',
  paper_trade_closed: 'paper',
  paper_trade_stop_hit: 'paper',
  paper_approval_required: 'orders',
  paper_fill: 'paper',
  paper_position_move: 'paper',
  risk_blocked: 'orders',
  order_intent_created: 'orders',
  order_approval_required: 'orders',
  order_rejected: 'orders',
  kill_switch_enabled: 'orders',
  daily_digest: 'digest',
  weekly_report: 'digest',
  test_notification: 'test',
};

export function familyForType(type: NotificationType): EventFamily {
  return FAMILY_BY_TYPE[type];
}

export interface VoicePreset {
  id: VoiceId;
  /** Wizard card title. */
  name: string;
  /** Wizard card one-liner - what this personality sounds like. */
  tagline: string;
  /**
   * Framing template per family. Variables: {name} (user's first name), {symbol}.
   * null = keep the channel's own per-type framing (house voice); '' = omit the line.
   */
  framing: Record<EventFamily, string | null>;
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'analyst',
    name: 'Analyst',
    tagline: 'The house voice - precise, neutral, straight to the setup.',
    framing: { research: null, portfolio: null, watchlist: null, paper: null, orders: null, digest: null, test: null },
  },
  {
    id: 'coach',
    name: 'Coach',
    tagline: 'In your corner - warm, direct, tells you where to look.',
    framing: {
      research: '{name}, worth a look - {symbol} just crossed your threshold.',
      portfolio: '{name}, one of your holdings is moving - here is the read.',
      watchlist: '{name}, one you are watching just made its move.',
      paper: 'Your paper bot made a move - here is what happened.',
      orders: '{name}, decision time - this one needs your call.',
      digest: 'Here is your day, {name} - the short version.',
      test: 'All good, {name} - this channel reaches you.',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Just the data - no greeting, no prose, every number intact.',
    framing: { research: '', portfolio: '', watchlist: '', paper: '', orders: '', digest: '', test: '' },
  },
  {
    id: 'narrator',
    name: 'Narrator',
    tagline: 'The market, told as a story - colour without losing the numbers.',
    framing: {
      research: 'The tape shifted - {symbol} is trying to turn.',
      portfolio: 'Plot development in your book - {symbol} moved.',
      watchlist: 'One from your watchlist steps on stage: {symbol}.',
      paper: 'The paper bot writes its next chapter.',
      orders: 'A decision point enters the story - your move.',
      digest: 'Today\'s episode, in brief.',
      test: 'A hello from Lyra - the line is live.',
    },
  },
];

export function voicePreset(id: VoiceId): VoicePreset {
  return VOICE_PRESETS.find((preset) => preset.id === id) ?? VOICE_PRESETS[0];
}

/**
 * Fill template variables from deterministic sources. A missing {name} degrades
 * gracefully: leading "{name}, worth..." becomes "Worth..."; interior ", {name} -"
 * collapses to " -". A missing {symbol} drops the slot's clause separator cleanly.
 */
export function fillVoiceTemplate(template: string, vars: { name?: string; symbol?: string }): string {
  let out = template;

  if (vars.name && vars.name.trim()) {
    out = out.split('{name}').join(vars.name.trim());
  } else {
    out = out.replace(/\{name\},\s*/g, '').replace(/,\s*\{name\}/g, '').replace(/\{name\}/g, '');
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  if (vars.symbol && vars.symbol.trim()) {
    out = out.split('{symbol}').join(vars.symbol.trim().toUpperCase());
  } else {
    out = out.replace(/\s*[-:]\s*\{symbol\}/g, '').replace(/\{symbol\}\s*/g, 'it ').replace(/\bit\s+is\b/g, 'it is');
  }

  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * The voice-selected framing line for an event. Returns:
 * - null  -> keep the channel template's own per-type framing (analyst/house voice)
 * - ''    -> omit the framing line entirely (minimal)
 * - text  -> use this filled line instead
 */
export function renderVoiceFraming(
  event: NotificationEvent,
  voice: VoiceId,
  vars: { name?: string } = {},
): string | null {
  const template = voicePreset(voice).framing[familyForType(event.type)];
  if (template === null) return null;
  if (template === '') return '';
  const symbol = event.relatedEntityType === 'symbol' ? (event.relatedEntityId ?? undefined) : undefined;
  return fillVoiceTemplate(template, { name: vars.name, symbol });
}
