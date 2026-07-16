/**
 * Unified notification system - types. Channel-independent: Push/Telegram/WhatsApp (and
 * later email/push) are delivery adapters behind the router. Every notification has a
 * deterministic trigger reason, evidence links, preference + quiet-hours checks, a
 * dedupe key, and an idempotency key. AI never originates notifications - it may only
 * phrase a payload the deterministic router has already approved.
 */

export type ChannelType = 'push' | 'telegram' | 'whatsapp' | 'slack';

/**
 * Agent voice - HOW alert prose is worded, never WHAT it says. Each id maps to a
 * pre-created template set with variables (see voice.ts); the deterministic engine
 * owns every number regardless of voice. 'analyst' is the default house voice.
 */
export type VoiceId = 'analyst' | 'coach' | 'minimal' | 'narrator';
export const VOICE_IDS: readonly VoiceId[] = ['analyst', 'coach', 'minimal', 'narrator'];
export const isVoiceId = (value: unknown): value is VoiceId => VOICE_IDS.includes(value as VoiceId);

export type NotificationType =
  | 'signal_alert'
  | 'signal_followup'
  | 'theme_breakout'
  | 'small_cap_discovery'
  | 'capital_event'
  | 'investor_move'
  | 'portfolio_news'
  | 'portfolio_risk'
  | 'portfolio_price_move'
  | 'watchlist_price_move'
  | 'paper_trade_opened'
  | 'paper_trade_closed'
  | 'paper_trade_stop_hit'
  | 'paper_approval_required'
  | 'paper_fill'
  | 'paper_position_move'
  | 'risk_blocked'
  | 'order_intent_created'
  | 'order_approval_required'
  | 'order_rejected'
  | 'kill_switch_enabled'
  | 'daily_digest'
  | 'weekly_report'
  | 'test_notification';

export type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationEvent {
  /** Stable id for this event instance. */
  id: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  userId: string;
  /** Deterministic trigger reason - never AI-originated. */
  triggerReason: string;
  title: string;
  body: string;
  /** Links back to evidence (source documents, signals, entities). */
  evidenceRefs: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  url?: string;
  /** 0-100 relevance from the deterministic engine. */
  relevanceScore: number;
  /** Same-content collapse key (e.g. `${type}:${symbol}:${day}`). */
  dedupeKey: string;
  /** Exactly-once delivery key per channel attempt. */
  idempotencyKey: string;
  createdAt: string;
}

export interface NotificationPreferences {
  instantAlerts: boolean;
  dailyDigest: boolean;
  weeklyDigest: boolean;
  pushEnabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  slackEnabled: boolean;
  /** How the agent speaks in alert prose - see voice.ts presets. */
  voice: VoiceId;
  quietHoursEnabled: boolean;
  /** "22:00" 24h, wall-clock in `timezone`. */
  quietStart: string;
  quietEnd: string;
  /** IANA timezone the quiet window is expressed in (e.g. "Australia/Sydney"). Optional so
   * existing literals are unaffected; the routing path always sets it from the DB row or default. */
  timezone?: string;
  mutedThemes: string[];
  mutedSymbols: string[];
  /** Events below this relevance are dropped. */
  minRelevanceScore: number;
  paperTradeAlerts: boolean;
  orderApprovalAlerts: boolean;
  watchlistMovementAlerts: boolean;
  portfolioMovementAlerts: boolean;
  macroAlerts: boolean;
  themeAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  instantAlerts: true,
  dailyDigest: true,
  weeklyDigest: true,
  pushEnabled: false,
  telegramEnabled: false,
  whatsappEnabled: false,
  slackEnabled: false,
  voice: 'analyst',
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  timezone: 'Australia/Sydney',
  mutedThemes: [],
  mutedSymbols: [],
  minRelevanceScore: 40,
  paperTradeAlerts: true,
  orderApprovalAlerts: true,
  watchlistMovementAlerts: true,
  portfolioMovementAlerts: true,
  macroAlerts: false,
  themeAlerts: true,
};

export type RouteDecision =
  | { deliver: true; channels: ChannelType[]; deferredToDigest: boolean }
  | { deliver: false; reason: string };

export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'suppressed' | 'demo_logged';

export interface DeliveryRecord {
  id: string;
  eventId: string;
  userId: string;
  channel: ChannelType | 'digest' | 'router';
  destination: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
  attempt: number;
  createdAt: string;
}

/** High-risk inbound commands require an exact pending-approval match - never free-form. */
export type InboundCommand =
  | 'status'
  | 'portfolio'
  | 'watchlist'
  | 'today'
  | 'mute'
  | 'unmute'
  | 'paper'
  | 'approve'
  | 'reject'
  | 'killswitch'
  | 'help'
  | 'unknown';
