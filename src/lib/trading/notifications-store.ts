/**
 * Paper-bot notifications / flags. The bot raises a flag when something the user should know about
 * happens: a candidate is awaiting approval, a paper fill landed, or an open position moved past a
 * threshold. Flags are shown in-app (the feed + the `flags` CLI command) and, when a channel is
 * configured, delivered to Telegram / WhatsApp via deliverFlag().
 *
 * OWNER-SCOPED (security). The store was a single process-global array: on a multi-user deploy every
 * operator's proposals/fills landed in ONE feed, so any signed-in user read (and could mark-read)
 * another user's trading activity. Flags are now bucketed by owner (the user id when signed in, else
 * DEMO_OWNER), so listFlags/markAllRead/unreadCount only ever touch the caller's own flags. In-memory
 * per server process still (the demo path); per-user durability lands with the Supabase persistence
 * pass. Authenticated deploys already have the durable per-user path (dispatchNotificationEvent).
 */
import { deliverFlag } from './notify-delivery';

/** The bucket for every not-signed-in caller. A configured deploy blocks the feed for signed-out
 * visitors, and true demo mode is single-user, so one shared demo bucket leaks nothing. */
export const DEMO_OWNER = 'demo';

export type FlagKind = 'approval_pending' | 'fill' | 'position_move' | 'risk_blocked' | 'info';
export type FlagSeverity = 'action' | 'good' | 'warn' | 'info';

export interface Flag {
  id: string;
  kind: FlagKind;
  severity: FlagSeverity;
  message: string;
  symbol?: string;
  createdAt: string;
  read: boolean;
}

const MAX_FLAGS = 50;
const MAX_OWNERS = 5_000; // crude memory guard for the per-owner map on a shared process
let seq = 0;

// Per-owner flag feed. Each owner sees only their own flags.
const flagsByOwner = new Map<string, Flag[]>();
// Per-owner, per-symbol last-flagged P/L bucket so a drifting position does not spam the feed.
const lastMoveBucket = new Map<string, number>();

const SEVERITY_OF: Record<FlagKind, FlagSeverity> = {
  approval_pending: 'action',
  fill: 'good',
  position_move: 'warn',
  risk_blocked: 'warn',
  info: 'info',
};

function feedFor(owner: string): Flag[] {
  let feed = flagsByOwner.get(owner);
  if (!feed) {
    if (flagsByOwner.size > MAX_OWNERS) flagsByOwner.clear(); // bounded on a long-lived process
    feed = [];
    flagsByOwner.set(owner, feed);
  }
  return feed;
}

/** Raise a flag for one owner: store it (capped), then fan out to any configured channel. */
export function recordFlag(
  owner: string,
  input: { kind: FlagKind; message: string; symbol?: string; severity?: FlagSeverity },
): Flag {
  seq += 1;
  const flag: Flag = {
    id: `flag-${seq}`,
    kind: input.kind,
    severity: input.severity ?? SEVERITY_OF[input.kind],
    message: input.message,
    symbol: input.symbol,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const feed = feedFor(owner);
  feed.unshift(flag);
  if (feed.length > MAX_FLAGS) feed.length = MAX_FLAGS;
  // Best-effort channel delivery; never block or throw into the caller.
  void deliverFlag(flag).catch(() => {});
  return flag;
}

/**
 * Raise a position_move flag only when the position crosses a fresh ±5% bucket, so a position that
 * keeps drifting in the same band does not re-flag on every account poll. Keyed by owner+symbol.
 */
export function maybeFlagPositionMove(owner: string, symbol: string, unrealisedPnlPct: number): void {
  const key = `${owner}:${symbol}`;
  const bucket = Math.trunc(unrealisedPnlPct / 5); // ..., -1 (=-5..-10), 0 (=-5..5), 1 (=5..10)
  if (Math.abs(bucket) < 1) {
    lastMoveBucket.set(key, bucket);
    return;
  }
  if (lastMoveBucket.get(key) === bucket) return;
  lastMoveBucket.set(key, bucket);
  const dir = unrealisedPnlPct >= 0 ? 'up' : 'down';
  recordFlag(owner, { kind: 'position_move', symbol, message: `${symbol} paper position ${dir} ${unrealisedPnlPct.toFixed(1)}%` });
}

export function listFlags(owner: string, limit = 20): Flag[] {
  return (flagsByOwner.get(owner) ?? []).slice(0, limit);
}

export function unreadCount(owner: string): number {
  return (flagsByOwner.get(owner) ?? []).filter((f) => !f.read).length;
}

export function markAllRead(owner: string): void {
  for (const f of flagsByOwner.get(owner) ?? []) f.read = true;
}
