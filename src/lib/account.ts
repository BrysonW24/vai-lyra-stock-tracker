/**
 * Local account & preferences for Lyra.
 *
 * IMPORTANT: this is browser-local storage for a personal/research tool - it is NOT
 * server-side authentication. The optional PIN is a light convenience lock for THIS
 * browser only; we store a SHA-256 hash (never the raw PIN) and always provide a
 * reset escape so a user can never be permanently locked out. A bring-your-own AI
 * key, if entered, also stays in this browser and overrides the hosted server key.
 */

/**
 * 'hosted' = Lyra's server-side OpenAI beta key; 'free' = a free/open provider selected by the
 * user; 'byo' = the user's own key. 'off' is legacy and migrates to the hosted default.
 */
export type AiMode = 'free' | 'byo' | 'off' | 'hosted';
/** Kept in sync with the gateway's provider union (src/lib/ai/gateway.ts). */
export type AiProvider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'xai';

export interface AccountProfile {
  displayName: string;
  /** Emoji used as the user's avatar/icon across the app (header menu, greetings). */
  avatarEmoji: string;
  email: string;
  baseCurrency: string;
  region: string;
}

/** Curated avatar emojis - a quick, personal "pick your icon" set (markets + characters). */
export const AVATAR_EMOJIS = [
  '🦎', '📈', '📊', '💹', '🪙', '💎', '🎯', '🚀', '⚡',
  '🔥', '🧠', '🐂', '🐻', '🦊', '🦉', '🦅', '🦈',
  '🐉', '🌊', '🌙', '⭐', '🏆', '♟️', '🧭', '🤖',
] as const;

export interface AiSettings {
  mode: AiMode;
  provider: AiProvider;
  apiKey: string;
  /** Bring your own model. Blank = the gateway's default model for the chosen provider. */
  model: string;
}

export interface LockSettings {
  enabled: boolean;
  pinHash: string | null;
}

export interface NotificationSettings {
  telegramEnabled: boolean;
  /** Telegram chat ID is NOT a secret - it just says where to deliver. The bot TOKEN
   * stays server-side in the worker's env and is never entered here. */
  telegramChatId: string;
  /** WhatsApp number in international format (e.g. +61400000000). Also not a secret. */
  whatsappPhone: string;
}

export const CURRENCIES = ['USD', 'AUD', 'EUR', 'GBP', 'CAD', 'NZD', 'JPY', 'SGD'] as const;
export const REGIONS = ['Australia', 'United States', 'United Kingdom', 'Europe', 'Canada', 'New Zealand', 'Asia', 'Other'] as const;

export const DEFAULT_PROFILE: AccountProfile = {
  displayName: '',
  avatarEmoji: '🦎',
  email: '',
  baseCurrency: 'AUD',
  region: 'Australia',
};

export const DEFAULT_AI: AiSettings = {
  mode: 'hosted',
  provider: 'openai',
  apiKey: '',
  model: '',
};

export const DEFAULT_LOCK: LockSettings = {
  enabled: false,
  pinHash: null,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  telegramEnabled: false,
  telegramChatId: '',
  whatsappPhone: '',
};

const KEYS = {
  profile: 'lyra.account.profile',
  ai: 'lyra.account.ai',
  lock: 'lyra.account.lock',
  notifications: 'lyra.account.notifications',
  agent: 'lyra.account.agent',
} as const;

export const UNLOCK_FLAG = 'lyra.account.unlocked';

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable - ignore */
  }
}

export const loadProfile = () => load<AccountProfile>(KEYS.profile, DEFAULT_PROFILE);
export const saveProfile = (value: AccountProfile) => save(KEYS.profile, value);

export const loadAi = (): AiSettings => {
  const ai = load<AiSettings>(KEYS.ai, DEFAULT_AI);
  // AI is always on now. Legacy "off" migrates to hosted OpenAI unless a user key was already
  // stored, in which case preserve that provider and mark it BYO.
  if (ai.mode === 'off') {
    return ai.apiKey ? { ...ai, mode: 'byo' } : DEFAULT_AI;
  }
  return ai;
};
export const saveAi = (value: AiSettings) => save(KEYS.ai, value);

export const loadLock = () => load<LockSettings>(KEYS.lock, DEFAULT_LOCK);
export const saveLock = (value: LockSettings) => save(KEYS.lock, value);

export const loadNotifications = () => load<NotificationSettings>(KEYS.notifications, DEFAULT_NOTIFICATIONS);
export const saveNotifications = (value: NotificationSettings) => save(KEYS.notifications, value);

/** AI actions opt-in: when on, Lyra may PROPOSE reversible app actions (you still confirm each one). */
export interface AgentSettings {
  actionsEnabled: boolean;
}
const DEFAULT_AGENT: AgentSettings = { actionsEnabled: false };
export const loadAgent = () => load<AgentSettings>(KEYS.agent, DEFAULT_AGENT);
export const saveAgent = (value: AgentSettings) => save(KEYS.agent, value);

/** Wipe every Lyra-owned localStorage key (account, prefs, board slots, banners…). */
export function clearAllLocalData(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('lyra.')) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.removeItem(UNLOCK_FLAG);
  } catch {
    /* ignore */
  }
}

/** SHA-256 of the PIN with a fixed app prefix. Never store or log the raw PIN. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`lyra:pin:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
