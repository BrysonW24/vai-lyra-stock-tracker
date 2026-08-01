/**
 * Model Lab run history - the user's own runs, stored locally in the browser. Honest and private:
 * nothing is claimed to be a server-side record. A run is appended when it completes; the list is
 * capped so it never grows unbounded. SSR-guarded so it is a no-op on the server.
 */

import type { LabConfig } from '@/lib/models/lab';

export interface RunHistoryEntry {
  id: string;
  at: string; // ISO timestamp
  modelKey: string;
  modelName: string;
  outcomeLabel: string;
  universeLabel: string;
  reviewed: number;
  surfaced: number;
  version: string;
  config: LabConfig;
}

const KEY = 'lyra.modellab.runs';
const CAP = 25;

function available(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadRuns(): RunHistoryEntry[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RunHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(entry: RunHistoryEntry): RunHistoryEntry[] {
  if (!available()) return [];
  const next = [entry, ...loadRuns().filter((e) => e.id !== entry.id)].slice(0, CAP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or disabled storage - history is best-effort */
  }
  return next;
}

export function clearRuns(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function newRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `run_${new Date().toISOString()}_${Math.round(Math.random() * 1e6)}`;
}
