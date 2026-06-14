/**
 * Paper-bot notifications / flags. The bot raises a flag when something the user should know about
 * happens: a candidate is awaiting approval, a paper fill landed, or an open position moved past a
 * threshold. Flags are shown in-app (the feed + the `flags` CLI command) and, when a channel is
 * configured, delivered to Telegram / WhatsApp via deliverFlag(). In-memory per server process today
 * (the demo path); per-user durability lands with the Supabase persistence pass.
 */
import { deliverFlag } from './notify-delivery';

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

const FLAGS: Flag[] = [];
const MAX_FLAGS = 50;
let seq = 0;

// Per-symbol last-flagged P/L bucket so a drifting position does not spam the feed every poll.
const lastMoveBucket = new Map<string, number>();

const SEVERITY_OF: Record<FlagKind, FlagSeverity> = {
  approval_pending: 'action',
  fill: 'good',
  position_move: 'warn',
  risk_blocked: 'warn',
  info: 'info',
};

/** Raise a flag: store it (capped), then fan out to any configured channel. Returns the flag. */
export function recordFlag(input: { kind: FlagKind; message: string; symbol?: string; severity?: FlagSeverity }): Flag {
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
  FLAGS.unshift(flag);
  if (FLAGS.length > MAX_FLAGS) FLAGS.length = MAX_FLAGS;
  // Best-effort channel delivery; never block or throw into the caller.
  void deliverFlag(flag).catch(() => {});
  return flag;
}

/**
 * Raise a position_move flag only when the position crosses a fresh ±5% bucket, so a position that
 * keeps drifting in the same band does not re-flag on every account poll.
 */
export function maybeFlagPositionMove(symbol: string, unrealisedPnlPct: number): void {
  const bucket = Math.trunc(unrealisedPnlPct / 5); // ..., -1 (=-5..-10), 0 (=-5..5), 1 (=5..10)
  if (Math.abs(bucket) < 1) {
    lastMoveBucket.set(symbol, bucket);
    return;
  }
  if (lastMoveBucket.get(symbol) === bucket) return;
  lastMoveBucket.set(symbol, bucket);
  const dir = unrealisedPnlPct >= 0 ? 'up' : 'down';
  recordFlag({ kind: 'position_move', symbol, message: `${symbol} paper position ${dir} ${unrealisedPnlPct.toFixed(1)}%` });
}

export function listFlags(limit = 20): Flag[] {
  return FLAGS.slice(0, limit);
}

export function unreadCount(): number {
  return FLAGS.filter((f) => !f.read).length;
}

export function markAllRead(): void {
  for (const f of FLAGS) f.read = true;
}
