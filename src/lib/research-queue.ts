/**
 * Research queue / saved dossiers - the "save this idea, come back, brief me on what
 * changed since" habit loop the doc calls a major retention lever. Pure product: persisted
 * to localStorage per device, no external API. Saving snapshots the score + price at save
 * time so the queue can show what has moved since.
 */
export type SavedKind = 'ticker' | 'signal' | 'catalyst' | 'theme';

export interface SavedItem {
  symbol: string;
  kind: SavedKind;
  label?: string;
  note?: string;
  /** Snapshot at save time, for the "what changed since" diff. */
  savedScore?: number;
  savedPrice?: number;
  savedAt: string;
}

const KEY = 'lyra.researchQueue.v1';
/** Same-tab cross-component sync: components listen for this to re-read the queue. */
export const QUEUE_EVENT = 'lyra:research-queue';

export function loadQueue(): SavedItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items: SavedItem[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {
    /* ignore */
  }
}

export function isSaved(symbol: string): boolean {
  return loadQueue().some((i) => i.symbol === symbol);
}

/** Add if absent, remove if present. Returns the new saved state. */
export function toggleSave(item: SavedItem): boolean {
  const queue = loadQueue();
  const idx = queue.findIndex((i) => i.symbol === item.symbol);
  if (idx >= 0) {
    queue.splice(idx, 1);
    persist(queue);
    return false;
  }
  persist([item, ...queue]);
  return true;
}

export function removeSaved(symbol: string): void {
  persist(loadQueue().filter((i) => i.symbol !== symbol));
}

export function updateNote(symbol: string, note: string): void {
  const queue = loadQueue();
  const item = queue.find((i) => i.symbol === symbol);
  if (item) {
    item.note = note;
    persist(queue);
  }
}
