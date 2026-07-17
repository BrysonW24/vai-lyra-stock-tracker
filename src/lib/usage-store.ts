'use client';

/**
 * Client store for usage - the thin localStorage wrapper around the pure model in `usage.ts`. All
 * data stays on the device (private by design). Every access is guarded so SSR and private-mode
 * browsers degrade to a no-op instead of throwing.
 */
import {
  emptyUsage,
  normaliseUsage,
  recordSession,
  recordVisit,
  accrueDwell,
  recordAiRequest,
  type UsageRecord,
} from '@/lib/usage';
import { normalizeSurface, surfaceLabelFor } from '@/lib/surfaces';

const KEY = 'lyra.usage.v1';
const SESSION_FLAG = 'lyra.usage.session';

const nowISO = () => new Date().toISOString();

export function getUsage(): UsageRecord {
  if (typeof window === 'undefined') return emptyUsage(nowISO());
  try {
    const raw = window.localStorage.getItem(KEY);
    return normaliseUsage(raw ? JSON.parse(raw) : null, nowISO());
  } catch {
    return emptyUsage(nowISO());
  }
}

function save(rec: UsageRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage full / private mode - usage is best-effort, never blocks the app */
  }
}

/** Count one session per browser session (deduped via sessionStorage). */
export function ensureSession(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(SESSION_FLAG)) return;
    window.sessionStorage.setItem(SESSION_FLAG, '1');
    save(recordSession(getUsage(), nowISO()));
  } catch {
    /* no-op */
  }
}

/** Record a visit to a surface, crediting `dwellMs` spent on the previous surface. */
export function recordSurfaceVisit(pathname: string, dwellMs: number): void {
  const surface = normalizeSurface(pathname);
  save(recordVisit(getUsage(), surface, dwellMs, nowISO(), surfaceLabelFor(surface)));
}

/** Credit dwell to the current surface without a new visit (page hide / unload). */
export function accrueSurfaceDwell(pathname: string, dwellMs: number): void {
  const surface = normalizeSurface(pathname);
  save(accrueDwell(getUsage(), surface, dwellMs, nowISO()));
}

/** Count one AI question/request. Called from every client AI request site. */
export function bumpAiUsage(): void {
  save(recordAiRequest(getUsage(), nowISO()));
}

/** Wipe the local usage record (the user's own data, their choice to clear). */
export function clearUsage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
