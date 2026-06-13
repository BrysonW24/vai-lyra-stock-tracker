/**
 * "Register interest" flags for future-build items (first one: the trading bot / paper trading).
 * Browser-local so the UI remembers the tick; the durable signal is a fire-and-forget POST to the
 * feedback intake when the user opts in, so opt-ins land on the board and become the beta cohort.
 */

const KEY = 'lyra.interest.v1';

export interface Interest {
  /** User wants the agentic paper-trading bot when it ships. */
  tradingBot: boolean;
}

const DEFAULT: Interest = { tradingBot: false };

export function loadInterest(): Interest {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Interest>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function saveInterest(value: Interest): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable - ignore */
  }
}

/**
 * Record an opt-in server-side via the feedback intake (files to the board when configured), so
 * we have a real list of interested users. Fire-and-forget: the local flag is the source of UI
 * truth and never depends on this succeeding.
 */
export async function registerInterest(label: string, email?: string): Promise<void> {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'idea', message: `[Interest] ${label}`, email: email ?? '' }),
    });
  } catch {
    /* ignore - the local flag still records intent */
  }
}
