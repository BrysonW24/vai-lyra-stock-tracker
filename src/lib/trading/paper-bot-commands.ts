/**
 * Paper-bot CLI. A small command set the user can drive the paper bot with - in-app, and (when a
 * channel is configured) from Telegram / WhatsApp. Every command routes through the SAME engine the
 * UI buttons use, so the safety properties are identical and structural:
 *
 *   - The allowlist has no live/real-money verb. There is no code path to live execution here.
 *   - `execute` only fills an intent that has been `approve`d (the engine re-checks risk at fill).
 *   - Unknown / live-sounding input is refused, never guessed into an action.
 *
 * State is a pending intent keyed by CALLER IDENTITY (user id when signed in, else IP), so one
 * caller's pending order can never be approved/executed by another - closing the cross-user state
 * bleed the security audit flagged. Still in-memory (best-effort on serverless); durable per-user
 * sessions arrive with the Supabase persistence pass.
 */
import type { AiCreds } from '@/lib/ai/run-agent';
import { proposeBotRun, executeBotRun, runClose } from './paper-bot';
import { getPaperAccountSummaryAuthAware as getPaperAccountSummary } from './paper-account-repo';
import { listFlags } from './notifications-store';
import { activeChannels } from './notify-delivery';
import type { OrderIntent } from './types';

export interface CommandResult {
  ok: boolean;
  kind: string;
  lines: string[];
}

const MAX_PENDING = 10_000;
const pendingByIdentity = new Map<string, OrderIntent>();

function getPending(identity: string): OrderIntent | null {
  return pendingByIdentity.get(identity) ?? null;
}
function setPending(identity: string, intent: OrderIntent | null): void {
  if (intent === null) {
    pendingByIdentity.delete(identity);
    return;
  }
  if (pendingByIdentity.size > MAX_PENDING) pendingByIdentity.clear(); // crude memory guard
  pendingByIdentity.set(identity, intent);
}

const HELP: string[] = [
  'Commands:',
  '  status              account equity, P/L, open positions',
  '  positions | pos     list open paper positions',
  '  pnl                 unrealised P/L summary',
  '  propose <SYM> <QTY> AI assesses readiness + drafts a paper order',
  '  approve             approve the pending paper order',
  '  execute | fill      simulate the fill (must be approved first)',
  '  close <SYM>         close a position and realise its P/L',
  '  flags | alerts      recent bot notifications',
  '  channels            where flags are delivered (Telegram / WhatsApp)',
  '  help | ?            this list',
];

const money = (n: number) => `$${n.toLocaleString()}`;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

function statusLines(s: Awaited<ReturnType<typeof getPaperAccountSummary>>): string[] {
  return [
    `equity ${money(s.equity)}  ·  unrealised P/L ${signed(s.unrealisedPnl)} (${signed(s.unrealisedPnlPct)}%)`,
    `${s.openPositions} open position${s.openPositions === 1 ? '' : 's'}  ·  ${s.fillCount} fill${s.fillCount === 1 ? '' : 's'}`,
  ];
}

/**
 * Execute one command line for a specific caller. `identity` scopes the pending-intent state so
 * one user's proposal cannot be approved/executed by another. Reads/writes the in-memory stores
 * and the engine.
 */
export async function runPaperBotCommand(rawLine: string, creds: AiCreds, identity: string): Promise<CommandResult> {
  const line = rawLine.trim();
  if (!line) return { ok: false, kind: 'noop', lines: ['Type `help` for commands.'] };
  const [verb, ...args] = line.split(/\s+/);
  const cmd = verb.toLowerCase();

  // Refuse anything that sounds like live/real trading - explicitly, not silently.
  if (['live', 'real', 'go-live', 'golive', 'buy!', 'sell!'].includes(cmd) || /\b(live|real money)\b/i.test(line)) {
    return { ok: false, kind: 'refused', lines: ['Live trading is permanently disabled. This bot is paper-only.'] };
  }

  switch (cmd) {
    case 'help':
    case '?':
      return { ok: true, kind: 'help', lines: HELP };

    case 'status': {
      const s = await getPaperAccountSummary();
      const channels = activeChannels();
      return { ok: true, kind: 'status', lines: [...statusLines(s), `channels: ${channels.length ? channels.join(', ') : 'in-app only (set TELEGRAM_* to enable Telegram)'}`] };
    }

    case 'pos':
    case 'positions': {
      const s = await getPaperAccountSummary();
      if (!s.positions.length) return { ok: true, kind: 'positions', lines: ['No open paper positions. Try `propose NVDA 10`.'] };
      return { ok: true, kind: 'positions', lines: s.positions.map((p) => `${p.symbol}  ${p.quantity} @ ${p.avgEntryPrice} -> ${p.currentPrice}  ${signed(p.unrealisedPnl)} (${signed(p.unrealisedPnlPct)}%)`) };
    }

    case 'pnl': {
      const s = await getPaperAccountSummary();
      return { ok: true, kind: 'pnl', lines: [`unrealised P/L ${signed(s.unrealisedPnl)} (${signed(s.unrealisedPnlPct)}%) across ${s.openPositions} position${s.openPositions === 1 ? '' : 's'}  ·  equity ${money(s.equity)}`] };
    }

    case 'propose': {
      const symbol = (args[0] ?? '').toUpperCase();
      const quantity = Number(args[1]);
      if (!symbol || !Number.isFinite(quantity) || quantity <= 0) return { ok: false, kind: 'usage', lines: ['Usage: propose <SYMBOL> <QTY>   e.g. propose NVDA 10'] };
      const run = await proposeBotRun({ symbol, quantity, creds });
      if (run.status === 'error') return { ok: false, kind: 'error', lines: [`Could not assess ${symbol}: ${run.error}`] };
      if (run.status !== 'proposed') {
        const v = run.verdict as { readiness?: string; reasons?: string[] } | undefined;
        return { ok: true, kind: run.status, lines: [`${symbol}: ${run.status.replace(/_/g, ' ')}`, ...(v?.reasons ?? []).slice(0, 2).map((r) => `  - ${r}`)] };
      }
      setPending(identity, run.intent ?? null);
      const v = run.verdict as { readiness?: string; confidence?: number; reasons?: string[] } | undefined;
      return {
        ok: true,
        kind: 'proposed',
        lines: [
          `${symbol}: paper-eligible (confidence ${Math.round((v?.confidence ?? 0) * 100)}%)`,
          ...(v?.reasons ?? []).slice(0, 2).map((r) => `  - ${r}`),
          `intent: ${run.intent?.side.toUpperCase()} ${run.intent?.quantity} ${symbol} · ${money(run.intent?.notionalValue ?? 0)} · ${run.intent?.status}`,
          'Type `approve` then `execute` to simulate the fill.',
        ],
      };
    }

    case 'approve': {
      const pending = getPending(identity);
      if (!pending) return { ok: false, kind: 'nothing', lines: ['Nothing to approve. `propose <SYM> <QTY>` first.'] };
      if (pending.status !== 'pending_approval' && pending.status !== 'approved') {
        return { ok: false, kind: 'nothing', lines: [`Pending order is ${pending.status}, not approvable.`] };
      }
      const approved = { ...pending, status: 'approved' as const };
      setPending(identity, approved);
      return { ok: true, kind: 'approved', lines: [`Approved ${approved.side.toUpperCase()} ${approved.quantity} ${approved.symbol}. Type \`execute\` to fill on paper.`] };
    }

    case 'fill':
    case 'execute': {
      const toFill = getPending(identity);
      if (!toFill) return { ok: false, kind: 'nothing', lines: ['Nothing to execute. `propose` then `approve` first.'] };
      if (toFill.status !== 'approved') return { ok: false, kind: 'guard', lines: ['Order is not approved. Type `approve` first.'] };
      const run = await executeBotRun(toFill);
      if (run.status !== 'paper_executed' || !run.fill) {
        return { ok: false, kind: run.status, lines: [`Execution ${run.status.replace(/_/g, ' ')}${run.error ? `: ${run.error}` : ''}.`] };
      }
      setPending(identity, null);
      const f = run.fill;
      return { ok: true, kind: 'filled', lines: [`Paper filled ${f.side.toUpperCase()} ${f.quantity} ${f.symbol} @ ${f.fillPrice} · notional ${money(f.notional)} (fee ${f.simulatedFee}, slippage ${f.simulatedSlippage}).`] };
    }

    case 'close': {
      const symbol = (args[0] ?? '').toUpperCase();
      if (!symbol) return { ok: false, kind: 'usage', lines: ['Usage: close <SYMBOL>   e.g. close NVDA'] };
      const run = await runClose(symbol);
      if (run.status === 'no_position') return { ok: false, kind: 'no_position', lines: [`No open ${symbol} position to close.`] };
      if (run.status === 'blocked_by_risk') return { ok: false, kind: 'blocked', lines: [`Close blocked by the risk gate for ${symbol}.`] };
      if (run.status !== 'closed' || !run.fill) return { ok: false, kind: 'error', lines: [`Could not close ${symbol}${run.error ? `: ${run.error}` : ''}.`] };
      return { ok: true, kind: 'closed', lines: [`Closed ${run.fill.quantity} ${symbol} @ ${run.fill.fillPrice} · realised P/L ${run.realisedPnl !== undefined ? signed(run.realisedPnl) : 'n/a'}`] };
    }

    case 'flags':
    case 'alerts': {
      const flags = listFlags(8);
      if (!flags.length) return { ok: true, kind: 'flags', lines: ['No flags yet.'] };
      return { ok: true, kind: 'flags', lines: flags.map((fl) => `[${fl.severity}] ${fl.message}`) };
    }

    case 'channels': {
      const ch = activeChannels();
      return {
        ok: true,
        kind: 'channels',
        lines: ch.length
          ? [`Flags are delivered to: ${ch.join(', ')}.`]
          : ['In-app only. Set TELEGRAM_BOT_TOKEN + TELEGRAM_PAPER_CHAT_ID to deliver flags to Telegram. WhatsApp is the next provider.'],
      };
    }

    default:
      return { ok: false, kind: 'unknown', lines: [`Unknown command: ${verb}. Type \`help\`.`] };
  }
}
