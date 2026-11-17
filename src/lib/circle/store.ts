/**
 * The circle's memory - who is in it, what each person follows, the last few turns of each private
 * conversation, and the feedback people sent. It lives in the Redis that is already attached, so it
 * needs no database (Lyra's is parked).
 *
 * Like the updates store this is a place where the shared store is NOT optional: a member "joined"
 * into one serverless instance's memory would be forgotten by the next request. With no shared store
 * every call throws CircleStoreUnavailable, and the bot says the circle is not switched on here.
 *
 * Keys (all under `lyra:circle:`):
 *   member:<chatId>      one member: name, topics, holdings, read settings         kept until they leave
 *   members              the set of member chat ids (who the reads go to)
 *   owners               the set of owner chat ids (who sees feedback and the member list)
 *   turns:<chatId>       the last TURNS_KEPT turns of their conversation, newest first   kept 7 days
 *   feedback             the last FEEDBACK_KEPT feedback notes, newest first
 *   rating:<read>:<chat> a reader's thumbs on one read                                kept 90 days
 *   last-read            the last scheduled read, in parts, for /read                   kept 3 days
 *   once:<key>           a "this already happened" marker (a read sent, an update answered)
 * A chat id is Telegram's own number for the private chat with that person.
 */
import { sharedStoreConfigured, upstashCommand } from '@/lib/cache';

export class CircleStoreUnavailable extends Error {
  constructor() {
    super('circle store: no shared store is configured');
    this.name = 'CircleStoreUnavailable';
  }
}

/** One Redis command, as the Upstash REST endpoint takes it. Injected so tests can run a fake. */
export type RedisCommand = (command: (string | number)[]) => Promise<unknown>;

export const upstashRedis: RedisCommand = async (command) => {
  if (!sharedStoreConfigured()) throw new CircleStoreUnavailable();
  return upstashCommand(command);
};

export function circleStoreConfigured(): boolean {
  return sharedStoreConfigured();
}

export const CIRCLE_TOPICS = [
  { id: 'asia', label: 'Asia', emoji: '🌏' },
  { id: 'europe', label: 'Europe', emoji: '🌍' },
  { id: 'us', label: 'US', emoji: '🌎' },
  { id: 'australia', label: 'Australia', emoji: '🇦🇺' },
  { id: 'tech', label: 'Tech and AI', emoji: '🤖' },
  { id: 'chips', label: 'Chips', emoji: '💾' },
  { id: 'small_caps', label: 'Small caps', emoji: '🔬' },
  { id: 'ipos', label: 'IPOs', emoji: '📜' },
  { id: 'macro', label: 'Rates, FX, oil', emoji: '🧭' },
  { id: 'crypto', label: 'Crypto', emoji: '🪙' },
] as const;

export type CircleTopic = (typeof CIRCLE_TOPICS)[number]['id'];
const TOPIC_IDS: ReadonlySet<string> = new Set(CIRCLE_TOPICS.map((topic) => topic.id));

export function isCircleTopic(value: string): value is CircleTopic {
  return TOPIC_IDS.has(value);
}

export type ReadKind = 'morning' | 'evening';

export interface CircleMember {
  chatId: string;
  /** Telegram first name as they set it, bounded - for a greeting and the owner's member list. */
  name: string;
  role: 'member' | 'owner';
  joinedAt: string;
  topics: CircleTopic[];
  /** Tickers as they typed them (Yahoo style: NVDA, CBA.AX, 005930.KS), at most MAX_HOLDINGS. */
  holdings: string[];
  /** Which scheduled reads they get. Both on when they join. */
  reads: Record<ReadKind, boolean>;
  /** Paused = no scheduled reads; chat still works. */
  paused: boolean;
}

export interface Turn {
  role: 'user' | 'lyra';
  text: string;
  at: string;
}

export interface FeedbackNote {
  chatId: string;
  name: string;
  text: string;
  /** Where it came from: an explicit /feedback, a note the chat picked out, a thumbs-down reason, a reply to a read. */
  via: 'command' | 'conversation' | 'rating' | 'reply';
  /** The read it was about, when it was about one. */
  readId: string | null;
  at: string;
}

export const MAX_HOLDINGS = 20;
export const TURNS_KEPT = 12;
const TURN_CHARS = 800;
const TURNS_TTL = 7 * 86_400;
const FEEDBACK_KEPT = 500;
const FEEDBACK_CHARS = 1_000;
const RATING_TTL = 90 * 86_400;
const LAST_READ_TTL = 3 * 86_400;
const PREFIX = 'lyra:circle:';

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function asStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : [];
}

/** A member's record as stored, cleaned of anything a hand edit or an old shape could have left. */
function normaliseMember(raw: CircleMember | null): CircleMember | null {
  if (!raw || typeof raw.chatId !== 'string') return null;
  return {
    chatId: raw.chatId,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 64) : '',
    role: raw.role === 'owner' ? 'owner' : 'member',
    joinedAt: typeof raw.joinedAt === 'string' ? raw.joinedAt : new Date(0).toISOString(),
    topics: asStrings(raw.topics).filter(isCircleTopic),
    holdings: asStrings(raw.holdings).slice(0, MAX_HOLDINGS),
    reads: { morning: raw.reads?.morning !== false, evening: raw.reads?.evening !== false },
    paused: raw.paused === true,
  };
}

export class CircleStore {
  constructor(private readonly redis: RedisCommand = upstashRedis) {}

  // --- members ---------------------------------------------------------------------------------

  async getMember(chatId: string): Promise<CircleMember | null> {
    return normaliseMember(parseJson<CircleMember>(await this.redis(['GET', `${PREFIX}member:${chatId}`])));
  }

  async saveMember(member: CircleMember): Promise<void> {
    await this.redis(['SET', `${PREFIX}member:${member.chatId}`, JSON.stringify(normaliseMember(member))]);
    await this.redis(['SADD', `${PREFIX}members`, member.chatId]);
    if (member.role === 'owner') await this.redis(['SADD', `${PREFIX}owners`, member.chatId]);
    else await this.redis(['SREM', `${PREFIX}owners`, member.chatId]);
  }

  async memberCount(): Promise<number> {
    const count = await this.redis(['SCARD', `${PREFIX}members`]);
    return typeof count === 'number' ? count : Number(count) || 0;
  }

  async memberIds(): Promise<string[]> {
    return asStrings(await this.redis(['SMEMBERS', `${PREFIX}members`])).sort();
  }

  async ownerIds(): Promise<string[]> {
    return asStrings(await this.redis(['SMEMBERS', `${PREFIX}owners`])).sort();
  }

  async members(): Promise<CircleMember[]> {
    const ids = await this.memberIds();
    const found = await Promise.all(ids.map((id) => this.getMember(id)));
    return found.filter((member): member is CircleMember => member !== null);
  }

  /** Leaving forgets them entirely: the record, the conversation and the set entries. Feedback they sent stays with the owner. */
  async removeMember(chatId: string): Promise<void> {
    await this.redis(['DEL', `${PREFIX}member:${chatId}`, `${PREFIX}turns:${chatId}`]);
    await this.redis(['SREM', `${PREFIX}members`, chatId]);
    await this.redis(['SREM', `${PREFIX}owners`, chatId]);
  }

  // --- conversation ---------------------------------------------------------------------------

  /** The conversation so far, oldest first. */
  async turns(chatId: string): Promise<Turn[]> {
    const raw = asStrings(await this.redis(['LRANGE', `${PREFIX}turns:${chatId}`, 0, TURNS_KEPT - 1]));
    return raw
      .map((entry) => parseJson<Turn>(entry))
      .filter((turn): turn is Turn => Boolean(turn && (turn.role === 'user' || turn.role === 'lyra') && typeof turn.text === 'string'))
      .reverse();
  }

  async appendTurns(chatId: string, turns: Turn[]): Promise<void> {
    const key = `${PREFIX}turns:${chatId}`;
    for (const turn of turns) await this.redis(['LPUSH', key, JSON.stringify({ ...turn, text: turn.text.slice(0, TURN_CHARS) })]);
    await this.redis(['LTRIM', key, 0, TURNS_KEPT - 1]);
    await this.redis(['EXPIRE', key, TURNS_TTL]);
  }

  async forgetTurns(chatId: string): Promise<void> {
    await this.redis(['DEL', `${PREFIX}turns:${chatId}`]);
  }

  // --- feedback and ratings -------------------------------------------------------------------

  async addFeedback(note: FeedbackNote): Promise<void> {
    const key = `${PREFIX}feedback`;
    await this.redis(['LPUSH', key, JSON.stringify({ ...note, text: note.text.slice(0, FEEDBACK_CHARS) })]);
    await this.redis(['LTRIM', key, 0, FEEDBACK_KEPT - 1]);
  }

  async recentFeedback(limit = 10): Promise<FeedbackNote[]> {
    const raw = asStrings(await this.redis(['LRANGE', `${PREFIX}feedback`, 0, Math.max(0, limit - 1)]));
    return raw.map((entry) => parseJson<FeedbackNote>(entry)).filter((note): note is FeedbackNote => Boolean(note && typeof note.text === 'string'));
  }

  async rate(readId: string, chatId: string, rating: 'u' | 'd'): Promise<void> {
    await this.redis(['SET', `${PREFIX}rating:${readId}:${chatId}`, rating, 'EX', RATING_TTL]);
  }

  // --- the last read sent, so /read can show it again ----------------------------------------------

  async saveLastRead<T>(read: T): Promise<void> {
    await this.redis(['SET', `${PREFIX}last-read`, JSON.stringify(read), 'EX', LAST_READ_TTL]);
  }

  async lastRead<T>(): Promise<T | null> {
    return parseJson<T>(await this.redis(['GET', `${PREFIX}last-read`]));
  }

  // --- once markers -----------------------------------------------------------------------------

  /** True the first time `key` is claimed within `ttlSeconds`; false after that. */
  async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis(['SET', `${PREFIX}once:${key}`, '1', 'NX', 'EX', ttlSeconds]);
    return result === 'OK';
  }

  async releaseOnce(key: string): Promise<void> {
    await this.redis(['DEL', `${PREFIX}once:${key}`]);
  }
}
