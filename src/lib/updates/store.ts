/**
 * Where Lyra's free updates are kept: the session facts the writer was given, and the reads that
 * were published from them.
 *
 * Lyra's database is parked (the free product has no accounts), so this lives in the Redis that is
 * already attached. That makes it the one place in the app where the cache is NOT optional -
 * everywhere else `src/lib/cache.ts` degrades to memory and nobody notices. Here a memory fallback
 * would be a lie: a read "published" into one serverless instance's memory is published to nobody.
 * So with no shared store configured every function below throws StoreUnavailableError, and the
 * routes say plainly that updates are not switched on.
 *
 * Keys (all under `lyra:updates:`):
 *   facts:<session>        the rows served for a session, with their hash        kept 14 days
 *   read:<session>         the published market read for a session                kept 400 days
 *   latest-read            the session of the newest published read
 *   rehearsal:<session>    what a rehearsal run would have published              kept 2 days
 * A session is its New York day, YYYY-MM-DD.
 */
import { sharedStoreConfigured, upstashCommand } from '@/lib/cache';
import type { SessionFacts } from '@/lib/updates/facts';

export class StoreUnavailableError extends Error {
  constructor() {
    super('updates store: no shared store is configured');
    this.name = 'StoreUnavailableError';
  }
}

const PREFIX = 'lyra:updates:';
const DAY = 86_400;
const FACTS_TTL = 14 * DAY;
const READ_TTL = 400 * DAY;
const REHEARSAL_TTL = 2 * DAY;

export const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One titled block of the figures under a read - composed by code from the facts, never by a model. */
export interface FigureBlock {
  title: string;
  lines: string[];
}

export interface ReadWriter {
  /** `groq`, `cloudflare`, `openrouter` or `local` (Lyra's own machine). */
  provider: string;
  model: string;
}

export interface PublishedRead {
  kind: 'market_read';
  session: string;
  /** The hash of the facts it was written from - the facts the app itself served. */
  factsHash: string;
  publishedAt: string;
  figures: FigureBlock[];
  /** The model-written read: paragraphs separated by blank lines. Null means figures only. */
  prose: string | null;
  /** When there is no prose, why - in words a reader can be shown. */
  proseNote: string | null;
  writer: ReadWriter | null;
}

async function command(cmd: (string | number)[]): Promise<unknown | null> {
  if (!sharedStoreConfigured()) throw new StoreUnavailableError();
  return upstashCommand(cmd);
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await command(['GET', PREFIX + key]);
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await command(['SET', PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds]);
}

/** Whether updates can be stored and read on this deployment at all. */
export function updatesAvailable(): boolean {
  return sharedStoreConfigured();
}

export const loadFacts = (session: string) => getJson<SessionFacts>(`facts:${session}`);
export const saveFacts = (facts: SessionFacts) => setJson(`facts:${facts.session}`, facts, FACTS_TTL);

export const loadRead = (session: string) => getJson<PublishedRead>(`read:${session}`);

/** Publish a read: store it, and point "latest" at it unless a newer session is already there. */
export async function saveRead(read: PublishedRead): Promise<void> {
  await setJson(`read:${read.session}`, read, READ_TTL);
  const latest = await command(['GET', `${PREFIX}latest-read`]);
  if (typeof latest !== 'string' || latest < read.session) await command(['SET', `${PREFIX}latest-read`, read.session]);
}

export const saveRehearsal = (read: PublishedRead) => setJson(`rehearsal:${read.session}`, read, REHEARSAL_TTL);

/**
 * Take a short lock, so one caller does a piece of work and the rest wait for its result instead of
 * repeating it (computing a session's facts means a request to the price source for every name).
 * True when this caller holds it. It expires by itself: nothing needs to release it.
 */
export async function tryLock(name: string, ttlSeconds: number): Promise<boolean> {
  return (await command(['SET', `${PREFIX}lock:${name}`, '1', 'NX', 'EX', ttlSeconds])) === 'OK';
}

export async function loadLatestRead(): Promise<PublishedRead | null> {
  const session = await command(['GET', `${PREFIX}latest-read`]);
  return typeof session === 'string' && SESSION_RE.test(session) ? loadRead(session) : null;
}
