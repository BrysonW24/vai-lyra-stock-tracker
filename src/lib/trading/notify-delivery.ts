/**
 * Channel delivery for paper-bot flags. The same flag the user sees in-app can be pushed to a chat
 * channel so the bot is reachable where they already are. Delivery is CONFIG-GATED: with no channel
 * env set (the sim/demo default) every adapter is a no-op, so nothing leaks and nothing breaks.
 *
 *   Telegram  - implemented (Bot API sendMessage). Set TELEGRAM_BOT_TOKEN + TELEGRAM_PAPER_CHAT_ID.
 *   WhatsApp  - interface defined; provider (Meta Cloud API / Twilio) wiring is the next slice.
 *
 * Security: tokens are read from server-only env (never NEXT_PUBLIC_*). This module must only be
 * imported by server code (it is, via notifications-store -> API routes).
 */
import type { Flag } from './notifications-store';

interface DeliveryChannel {
  name: string;
  enabled(): boolean;
  send(text: string, flag: Flag): Promise<void>;
}

const ICON: Record<Flag['severity'], string> = { action: '🟡', good: '🟢', warn: '🟠', info: '⚪' };

function formatFlag(flag: Flag): string {
  const sym = flag.symbol ? ` [${flag.symbol}]` : '';
  return `${ICON[flag.severity]} Lyra Paper Bot${sym}\n${flag.message}`;
}

/** Telegram Bot API. Inert unless TELEGRAM_BOT_TOKEN and TELEGRAM_PAPER_CHAT_ID are both set. */
const telegram: DeliveryChannel = {
  name: 'telegram',
  enabled: () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_PAPER_CHAT_ID),
  async send(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_PAPER_CHAT_ID;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  },
};

/** WhatsApp placeholder - interface only. Provider wiring (Meta Cloud API / Twilio) is the next slice. */
const whatsapp: DeliveryChannel = {
  name: 'whatsapp',
  enabled: () => false, // not wired yet; documented in docs/trading/paper-bot-notifications.md
  async send() {
    /* no-op until WHATSAPP_* provider config + adapter land */
  },
};

const CHANNELS: DeliveryChannel[] = [telegram, whatsapp];

/** Fan a flag out to every enabled channel. Best-effort; failures are swallowed by the caller. */
export async function deliverFlag(flag: Flag): Promise<void> {
  const text = formatFlag(flag);
  await Promise.all(CHANNELS.filter((c) => c.enabled()).map((c) => c.send(text, flag).catch(() => {})));
}

/** Which channels are live right now - surfaced in the UI so the user knows where flags go. */
export function activeChannels(): string[] {
  return CHANNELS.filter((c) => c.enabled()).map((c) => c.name);
}
