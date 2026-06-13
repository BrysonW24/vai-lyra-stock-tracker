/**
 * Saved chat prompts - questions the user pins so they can re-run them anytime (e.g. to keep
 * tracking the same thing). Browser-local, newest first, deduped, capped. Same storage pattern
 * as the rest of Lyra's local state.
 */

const KEY = 'lyra.savedPrompts.v1';
const MAX = 24;

export function loadSavedPrompts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function persist(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable - ignore */
  }
}

/** Toggle a prompt's saved state and return the new list (newest first). */
export function toggleSavedPrompt(prompt: string): string[] {
  const q = prompt.trim();
  if (!q) return loadSavedPrompts();
  const current = loadSavedPrompts();
  const next = current.includes(q) ? current.filter((p) => p !== q) : [q, ...current];
  persist(next);
  return next;
}
