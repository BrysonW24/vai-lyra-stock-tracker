/**
 * Unified notification system - types. Channel-independent: Telegram/WhatsApp (and
 * later email/push) are delivery adapters behind the router. Every notification has a
 * deterministic trigger reason, evidence links, preference + quiet-hours checks, a
 * dedupe key, and an idempotency key. AI never originates notifications - it may only
 * phrase a payload the deterministic router has already approved.
 */

export type ChannelType = 'telegram' | 'whatsapp';

export type NotificationType =
  | 'signal_alert'
  | 'theme_breakout'
  | 'small_cap_discovery'
  | 'capital_event'
  | 'investor_move'
  | 'portfolio_news'
  | 'portfolio_risk'
  | 'paper_trade_opened'
  | 'paper_trade_closed'
  | 'paper_trade_stop_hit'
  | 'order_intent_created'
  | 'order_approval_required'
  | 'order_rejected'
  | 'kill_switch_enabled'
  | 'daily_digest'
  | 'weekly_report';

export interface NotificationEvent {
  /** Stable id for this event instance. */
  id: string;
  type: NotificationType;
  userId: string;
  /** Deterministic trigger reason - never AI-originated. */
  triggerReason: string;
  title: string;
  body: string;
  /** Links back to evidence (source documents, signals, entities). */
  evidenceRefs: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
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
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  quietHoursEnabled: boolean;
  /** "22:00" 24h local. */
  quietStart: string;
  quietEnd: string;
  mutedThemes: string[];
  mutedSymbols: string[];
  /** Events below this relevance are dropped. */
  minRelevanceScore: number;
  paperTradeAlerts: boolean;
  orderApprovalAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  instantAlerts: true,
  dailyDigest: true,
  weeklyDigest: true,
  telegramEnabled: false,
  whatsappEnabled: false,
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  mutedThemes: [],
  mutedSymbols: [],
  minRelevanceScore: 40,
  paperTradeAlerts: true,
  orderApprovalAlerts: true,
};

export type RouteDecision =
  | { deliver: true; channels: ChannelType[]; deferredToDigest: boolean }
  | { deliver: false; reason: string };

export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'suppressed' | 'demo_logged';

export interface DeliveryRecord {
  id: string;
  eventId: string;
  userId: string;
  channel: ChannelType;
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
