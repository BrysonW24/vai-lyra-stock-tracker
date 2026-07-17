/**
 * Usage - the deterministic model behind "your Lyra activity": how long you spend, how many
 * sessions, how many AI questions you ask, and which surfaces you actually use (the heatmap).
 *
 * Local-first and private BY DESIGN: the record lives in the user's own browser (localStorage), so
 * this is a personal mirror, not tracking - nothing leaves the device, no server, no consent gate.
 * These functions are pure: they take the current record + an explicit `now` and return a new record
 * (easy to test, no clocks inside). The client store wires them to localStorage and real timestamps.
 */

export const USAGE_VERSION = 1;

export interface SurfaceUsage {
  /** Number of visits to this surface. */
  visits: number;
  /** Cumulative dwell time on this surface, ms. */
  ms: number;
  /** Human label for display (last one wins). */
  label?: string;
}

export interface UsageRecord {
  version: number;
  /** ISO timestamp of the first activity ever recorded. */
  firstSeen: string;
  /** ISO timestamp of the most recent activity. */
  lastActive: string;
  /** Count of distinct app sessions. */
  sessions: number;
  /** Cumulative time-on-app across all surfaces, ms. */
  totalMs: number;
  /** Count of AI questions/requests made. */
  aiRequests: number;
  /** Per-surface visit + dwell, keyed by route href. */
  bySurface: Record<string, SurfaceUsage>;
  /** Distinct active days (yyyy-mm-dd), for the streak/active-days stat. */
  activeDays: string[];
}

const DAY = (iso: string) => iso.slice(0, 10);
// A single dwell longer than this is almost certainly a left-open tab, not real use - cap it so one
// forgotten tab cannot claim "18 hours on Portfolio" and wreck the totals.
const MAX_DWELL_MS = 30 * 60 * 1000; // 30 minutes

export function emptyUsage(nowISO: string): UsageRecord {
  return {
    version: USAGE_VERSION,
    firstSeen: nowISO,
    lastActive: nowISO,
    sessions: 0,
    totalMs: 0,
    aiRequests: 0,
    bySurface: {},
    activeDays: [],
  };
}

/** Migrate/normalise any stored value into a valid record (defensive against shape drift). */
export function normaliseUsage(value: unknown, nowISO: string): UsageRecord {
  const base = emptyUsage(nowISO);
  if (!value || typeof value !== 'object') return base;
  const v = value as Partial<UsageRecord>;
  return {
    version: USAGE_VERSION,
    firstSeen: typeof v.firstSeen === 'string' ? v.firstSeen : nowISO,
    lastActive: typeof v.lastActive === 'string' ? v.lastActive : nowISO,
    sessions: Number.isFinite(v.sessions) ? Number(v.sessions) : 0,
    totalMs: Number.isFinite(v.totalMs) ? Number(v.totalMs) : 0,
    aiRequests: Number.isFinite(v.aiRequests) ? Number(v.aiRequests) : 0,
    bySurface: v.bySurface && typeof v.bySurface === 'object' ? (v.bySurface as Record<string, SurfaceUsage>) : {},
    activeDays: Array.isArray(v.activeDays) ? v.activeDays.filter((d): d is string => typeof d === 'string') : [],
  };
}

function touch(rec: UsageRecord, nowISO: string): UsageRecord {
  const day = DAY(nowISO);
  const activeDays = rec.activeDays.includes(day) ? rec.activeDays : [...rec.activeDays, day];
  return { ...rec, lastActive: nowISO, activeDays };
}

/** Start of a new app session (deduped by the caller to once per real session). */
export function recordSession(rec: UsageRecord, nowISO: string): UsageRecord {
  return { ...touch(rec, nowISO), sessions: rec.sessions + 1 };
}

/** A visit to a surface, with the dwell time accrued on the PREVIOUS surface. Dwell is capped. */
export function recordVisit(rec: UsageRecord, surface: string, dwellMs: number, nowISO: string, label?: string): UsageRecord {
  const clampedDwell = Math.max(0, Math.min(MAX_DWELL_MS, Number.isFinite(dwellMs) ? dwellMs : 0));
  const prev = rec.bySurface[surface] ?? { visits: 0, ms: 0 };
  const bySurface = {
    ...rec.bySurface,
    [surface]: { visits: prev.visits + 1, ms: prev.ms + clampedDwell, label: label ?? prev.label },
  };
  return { ...touch(rec, nowISO), totalMs: rec.totalMs + clampedDwell, bySurface };
}

/** Accrue dwell onto the current surface without counting a new visit (e.g. on tab close). */
export function accrueDwell(rec: UsageRecord, surface: string, dwellMs: number, nowISO: string): UsageRecord {
  const clampedDwell = Math.max(0, Math.min(MAX_DWELL_MS, Number.isFinite(dwellMs) ? dwellMs : 0));
  if (clampedDwell <= 0) return rec;
  const prev = rec.bySurface[surface] ?? { visits: 0, ms: 0 };
  const bySurface = { ...rec.bySurface, [surface]: { ...prev, ms: prev.ms + clampedDwell } };
  return { ...touch(rec, nowISO), totalMs: rec.totalMs + clampedDwell, bySurface };
}

/** One AI question/request. */
export function recordAiRequest(rec: UsageRecord, nowISO: string): UsageRecord {
  return { ...touch(rec, nowISO), aiRequests: rec.aiRequests + 1 };
}

export interface SurfaceSummary {
  surface: string;
  label: string;
  visits: number;
  ms: number;
  /** Share of total visits, 0-100. */
  sharePct: number;
  /** Heatmap intensity 0-1, relative to the most-visited surface. */
  intensity: number;
}

export interface UsageSummary {
  totalMs: number;
  totalMinutes: number;
  totalHours: number;
  sessions: number;
  aiRequests: number;
  activeDays: number;
  firstSeen: string;
  /** Average session length in minutes (totalMs / sessions). */
  avgSessionMinutes: number;
  surfacesUsed: number;
  mostUsed: SurfaceSummary | null;
  /** All surfaces, most-visited first - the heatmap source. */
  surfaces: SurfaceSummary[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Roll a record up into display-ready totals + a ranked, intensity-scored surface list (heatmap). */
export function summarizeUsage(rec: UsageRecord): UsageSummary {
  const entries = Object.entries(rec.bySurface);
  const totalVisits = entries.reduce((sum, [, s]) => sum + s.visits, 0);
  const maxVisits = entries.reduce((max, [, s]) => Math.max(max, s.visits), 0);

  const surfaces: SurfaceSummary[] = entries
    .map(([surface, s]) => ({
      surface,
      label: s.label ?? surface,
      visits: s.visits,
      ms: s.ms,
      sharePct: totalVisits > 0 ? round1((s.visits / totalVisits) * 100) : 0,
      intensity: maxVisits > 0 ? round1(s.visits / maxVisits) : 0,
    }))
    .sort((a, b) => b.visits - a.visits || b.ms - a.ms);

  return {
    totalMs: rec.totalMs,
    totalMinutes: Math.round(rec.totalMs / 60000),
    totalHours: round1(rec.totalMs / 3_600_000),
    sessions: rec.sessions,
    aiRequests: rec.aiRequests,
    activeDays: rec.activeDays.length,
    firstSeen: rec.firstSeen,
    avgSessionMinutes: rec.sessions > 0 ? round1(rec.totalMs / rec.sessions / 60000) : 0,
    surfacesUsed: entries.length,
    mostUsed: surfaces[0] ?? null,
    surfaces,
  };
}
