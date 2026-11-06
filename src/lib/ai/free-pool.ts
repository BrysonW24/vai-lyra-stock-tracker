/**
 * The free pool - Lyra's AI for everyone, on open-weight models that cost nothing to run.
 *
 * The founder asked on 2026-11-06 for chat (and every other AI answer) to be free. No free server
 * can run a model fast enough to chat, so the pool borrows the free hosted tiers of providers that
 * serve open-source models: Cloudflare Workers AI and Groq, with OpenRouter's free models as a
 * spare. Each is small - a daily allowance shared by everyone who uses Lyra - so they are a CHAIN:
 * the first that can answer does, a provider that says "not now" (429) is left alone for as long
 * as it asked, and when none can answer the caller gets a typed "exhausted" and shows the engine's
 * own figures without prose. Nothing here can bill: the keys are free-tier keys with no card.
 *
 * Three rules:
 *   * THE PROVIDERS ARE LYRA'S CHOICE, NEVER THE CALLER'S. The chain comes from the server's env
 *     (LYRA_FREE_POOL) and the keys from the server's env. A request body cannot name a pool
 *     provider, a pool model or a key.
 *   * ONE PERSON CANNOT DRAIN IT. The pool is open without sign-in (the free product has no
 *     accounts), so every caller is capped per minute and per day by identity - a user id, or an
 *     IP address - and the pool as a whole has a daily ceiling. All three counters live in Redis.
 *   * THE GUARDS DO NOT KNOW WHO ANSWERED. Whatever a pool model writes goes through the same
 *     grounding, advice and prediction checks as any other model's answer.
 *
 * What is sent to a provider: the question, the conversation, and the dashboard context that
 * grounds the answer (which includes the caller's holdings). Cloudflare states it does not train
 * on or retain it; Groq does not train on it and keeps logs for up to 30 days unless zero
 * retention is switched on for the organisation. The privacy page says so.
 */
import { complete, CircuitOpenError, ProviderHttpError, type AiCompleteResult } from '@/lib/ai/gateway';
import { classifyAiFailure, type AiFailureReason } from '@/lib/ai/failures';
import { rateLimitShared } from '@/lib/ratelimit';

export type PoolProvider = 'cloudflare' | 'groq' | 'openrouter';

export interface PoolTarget {
  provider: PoolProvider;
  model: string;
}

/** Which env var holds each provider's free-tier key. Names only - values never leave the server. */
const KEY_ENV: Record<PoolProvider, string> = {
  cloudflare: 'CLOUDFLARE_AI_TOKEN',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/**
 * The order the pool is tried in when LYRA_FREE_POOL is not set. Cloudflare first: its limit is a
 * daily allowance at 300 requests a minute, where Groq's free plan allows 8,000 tokens a minute
 * per model - about two chat answers.
 */
export const DEFAULT_POOL =
  'cloudflare:@cf/google/gemma-4-26b-a4b-it,groq:openai/gpt-oss-120b,groq:qwen/qwen3.8-27b,groq:openai/gpt-oss-20b';

/** A reasoning model thinks inside its output budget even when the thinking is hidden. */
const REASONING_HEADROOM_TOKENS = 700;
const DEFAULT_COOLDOWN_SEC = 600; // a 429 with no Retry-After: leave the target alone for ten minutes
const MAX_COOLDOWN_SEC = 3_600;
const AUTH_COOLDOWN_SEC = 3_600; // a rejected key does not fix itself within the hour

const PER_MINUTE = 6;
const PER_DAY = 40;
const GLOBAL_PER_DAY = 2_000;
const DAY_MS = 86_400_000;

function intEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** `provider:model, provider:model` in order. An entry with an unknown provider or no model is skipped. */
export function parsePool(spec: string | undefined | null): PoolTarget[] {
  const targets: PoolTarget[] = [];
  for (const entry of (spec ?? '').split(',')) {
    const trimmed = entry.trim();
    const cut = trimmed.indexOf(':');
    if (cut < 1) continue;
    const provider = trimmed.slice(0, cut).trim().toLowerCase();
    const model = trimmed.slice(cut + 1).trim();
    if (!model || !(provider in KEY_ENV)) continue;
    targets.push({ provider: provider as PoolProvider, model });
  }
  return targets;
}

function keyFor(target: PoolTarget): string {
  const key = process.env[KEY_ENV[target.provider]]?.trim() ?? '';
  // Cloudflare's address is built from the account id; a token without it cannot be used.
  if (target.provider === 'cloudflare' && !process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) return '';
  return key;
}

/** The pool as configured, limited to the targets this deployment holds a key for. */
export function poolTargets(): PoolTarget[] {
  return parsePool(process.env.LYRA_FREE_POOL?.trim() || DEFAULT_POOL).filter((target) => keyFor(target) !== '');
}

export function freePoolAvailable(): boolean {
  return poolTargets().length > 0;
}

// --- cooling: a target that said "not now" is left alone for as long as it asked ---------------

const memoryCooling = new Map<string, number>();

function coolingKey(target: PoolTarget): string {
  return `pool:cool:${target.provider}:${target.model}`;
}

async function redis(command: (string | number)[]): Promise<unknown | null | undefined> {
  // undefined = Redis is not configured or did not answer; the caller falls back to this instance's memory.
  try {
    const { upstashCommand } = await import('@/lib/cache');
    return await upstashCommand(command);
  } catch {
    return undefined;
  }
}

async function isCooling(target: PoolTarget, nowMs: number): Promise<boolean> {
  const key = coolingKey(target);
  const until = memoryCooling.get(key);
  if (until !== undefined) {
    if (until > nowMs) return true;
    memoryCooling.delete(key);
  }
  return (await redis(['EXISTS', key])) === 1;
}

async function cool(target: PoolTarget, seconds: number, nowMs: number): Promise<void> {
  const ttl = Math.max(5, Math.min(MAX_COOLDOWN_SEC, Math.ceil(seconds)));
  const key = coolingKey(target);
  memoryCooling.set(key, nowMs + ttl * 1000);
  await redis(['SET', key, '1', 'EX', ttl]);
}

/** Test hook - cooling state is process-global by design. */
export function resetFreePoolForTests(): void {
  memoryCooling.clear();
}

// --- caps: per caller and for the pool as a whole ------------------------------------------------

export type FreeCapVerdict = { ok: true } | { ok: false; reason: 'free_limit' | 'free_pool_exhausted'; retryAfterSec: number };

/**
 * Count one free answer against the caller and against the pool. The windows are fixed UTC
 * windows, so the day's counters reset at 00:00 UTC - the same moment the providers' own daily
 * allowances do.
 */
export async function chargeFreeCaps(identity: string, nowMs: number = Date.now()): Promise<FreeCapVerdict> {
  const minute = await rateLimitShared(identity, { scope: 'ai-free-minute', capacity: intEnv('LYRA_FREE_PER_MINUTE', PER_MINUTE), windowMs: 60_000 }, nowMs);
  if (!minute.allowed) return { ok: false, reason: 'free_limit', retryAfterSec: minute.retryAfterSec };
  const day = await rateLimitShared(identity, { scope: 'ai-free-day', capacity: intEnv('LYRA_FREE_PER_DAY', PER_DAY), windowMs: DAY_MS }, nowMs);
  if (!day.allowed) return { ok: false, reason: 'free_limit', retryAfterSec: day.retryAfterSec };
  const everyone = await rateLimitShared('everyone', { scope: 'ai-free-global-day', capacity: intEnv('LYRA_FREE_GLOBAL_PER_DAY', GLOBAL_PER_DAY), windowMs: DAY_MS }, nowMs);
  if (!everyone.allowed) return { ok: false, reason: 'free_pool_exhausted', retryAfterSec: everyone.retryAfterSec };
  return { ok: true };
}

// --- the call --------------------------------------------------------------------------------------

export interface PoolAttempt {
  /** `provider:model` - Lyra's own configuration, safe to log. */
  target: string;
  reason: string;
}

export type PoolOutcome =
  | { ok: true; result: AiCompleteResult; tried: PoolAttempt[] }
  | { ok: false; reason: AiFailureReason; tried: PoolAttempt[] };

export interface PoolRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
}

function isReasoningModel(target: PoolTarget): boolean {
  const id = target.model.toLowerCase();
  return id.includes('gpt-oss') || id.startsWith('qwen/') || id.includes('qwen3');
}

/**
 * Ask the pool. The first target that is not cooling and returns text answers; every other outcome
 * moves to the next. With no target left, `free_pool_exhausted` - unless the pool was never
 * configured, which is `no_key`.
 */
export async function completeFromPool(request: PoolRequest, nowMs: number = Date.now()): Promise<PoolOutcome> {
  const targets = poolTargets();
  if (targets.length === 0) return { ok: false, reason: 'no_key', tried: [] };

  const tried: PoolAttempt[] = [];
  for (const target of targets) {
    const name = `${target.provider}:${target.model}`;
    if (await isCooling(target, nowMs)) {
      tried.push({ target: name, reason: 'cooling' });
      continue;
    }
    try {
      const result = await complete({
        provider: target.provider,
        apiKey: keyFor(target),
        model: target.model,
        system: request.system,
        prompt: request.prompt,
        maxTokens: request.maxTokens + (isReasoningModel(target) ? REASONING_HEADROOM_TOKENS : 0),
        temperature: request.temperature,
        // A 429 on a shared free key is the pool's signal to move on, never something to retry into.
        retryOn429: false,
      });
      if (result.text.trim()) return { ok: true, result, tried: [...tried, { target: name, reason: 'ok' }] };
      tried.push({ target: name, reason: 'empty_response' });
    } catch (error) {
      const reason = error instanceof CircuitOpenError ? 'provider_unavailable' : classifyAiFailure(error);
      tried.push({ target: name, reason });
      if (error instanceof ProviderHttpError) {
        if (error.status === 429) await cool(target, error.retryAfterSec ?? DEFAULT_COOLDOWN_SEC, nowMs);
        else if (error.status === 401 || error.status === 403) await cool(target, AUTH_COOLDOWN_SEC, nowMs);
      }
    }
  }
  return { ok: false, reason: 'free_pool_exhausted', tried };
}
