/**
 * Sending a scheduled read to the circle. Called by POST /api/circle/broadcast, which a GitHub
 * schedule triggers with a signed request (.github/workflows/circle-reads.yml).
 *
 * When: the schedule fires for both halves of Sydney's daylight saving, and a firing that comes
 * before the read's Sydney time (about 8:45am, about 7:15pm) does nothing - so members get it at the
 * same local time all year. The next firing, half an hour later, is the retry.
 *
 * Once per member: the read is composed first (board, headlines, the shared note, everyone's prices),
 * and only then is each member's copy claimed - right before it is sent to them. A send that fails
 * gives the claim back, so the retry firing sends to exactly the members who did not get it; a member
 * who blocked the bot is paused rather than failed every day. When every copy has gone, the read is
 * marked done and later firings stop early. A timeout part-way therefore loses nobody's read, and no
 * member gets one twice. A rehearsal goes only to the owners, is marked as one, and claims nothing;
 * `force` sends to everyone again on purpose.
 *
 * Holdings are priced once for everyone (the union of every member's tickers) - each member's
 * "Your names" line is then cut from that one set of prices.
 */
import type { DeliveryRecord } from '@/lib/notifications/types';
import type { SendTelegramOptions } from '@/lib/notifications/telegram';
import type { InstrumentMove, WorldSnapshot } from '@/lib/world/compute';
import type { Headline, IpoListing } from '@/lib/world/news';
import { readIdFor } from './commands';
import { composeRead, personalise, poolNoteWriter, sydneyDate, yourNamesHtml, type ComposedRead, type NoteWriter } from './reads';
import type { CircleMember, CircleStore, ReadKind } from './store';
import { rateKeyboard } from './ui';

export interface BroadcastIo {
  store: CircleStore;
  send: (chatId: string, text: string, key: string, options?: SendTelegramOptions) => Promise<DeliveryRecord>;
  snapshot: () => Promise<WorldSnapshot>;
  headlines: () => Promise<Headline[]>;
  ipos: () => Promise<IpoListing[]>;
  holdings: (symbols: string[]) => Promise<Array<InstrumentMove | null>>;
  writer?: NoteWriter;
  /** The circle's off switch (an invite code is set) - see circleIsOn in handle.ts. */
  circleOn: boolean;
  /** A group chat that gets the read too (no one's names in it, no buttons), when set. */
  groupChatId: string | null;
  updatesUrl: string | null;
}

export interface BroadcastResult {
  readId: string;
  status: 'sent' | 'already_sent' | 'no_members' | 'board_unreadable' | 'circle_off' | 'too_early';
  rehearsal: boolean;
  recipients: number;
  delivered: number;
  failed: number;
  /** Members whose chat refused the read (they blocked the bot): now paused, not counted as failures. */
  blocked: number;
  /** Members who already had this read from an earlier firing. */
  skipped: number;
  /** Whether the shared note was written (false = figures only). */
  note: boolean;
  missing: number;
  /** Minutes past the read's Sydney send time: a failure on the retry firing (30+) is worth a page. */
  lateBy: number;
}

const ONCE_TTL = 3 * 86_400;
/** A read with fewer instruments than this is not worth sending - the board was not answering. */
const MIN_BOARD = 15;
/** The read's Sydney time, in minutes after midnight: the schedule's earlier firing in each season comes before it. */
const SEND_AT: Record<ReadKind, number> = { morning: 8 * 60 + 40, evening: 19 * 60 + 10 };

function wants(member: CircleMember, kind: ReadKind): boolean {
  return !member.paused && member.reads[kind];
}

/** Minutes after midnight in Sydney. */
export function sydneyMinutes(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function delivered(result: DeliveryRecord): boolean {
  // `suppressed` is this instance's own record that the same copy already went out.
  return result.status === 'sent' || result.status === 'demo_logged' || result.status === 'suppressed';
}

/** Telegram's 403: the person blocked the bot, or the chat is gone. Retrying twice a day helps nobody. */
function refused(result: DeliveryRecord): boolean {
  return result.status === 'failed' && /sendMessage 403\b/.test(result.errorMessage ?? '');
}

export async function sendCircleRead(kind: ReadKind, nowMs: number, io: BroadcastIo, options: { rehearsal?: boolean; force?: boolean } = {}): Promise<BroadcastResult> {
  const rehearsal = options.rehearsal === true;
  const force = options.force === true;
  const readId = readIdFor(kind, sydneyDate(nowMs));
  const lateBy = sydneyMinutes(nowMs) - SEND_AT[kind];
  const empty = { readId, rehearsal, recipients: 0, delivered: 0, failed: 0, blocked: 0, skipped: 0, note: false, missing: 0, lateBy };

  if (!io.circleOn) return { ...empty, status: 'circle_off' };
  const scheduled = !rehearsal && !force;
  if (scheduled && lateBy < 0) return { ...empty, status: 'too_early' };
  if (scheduled && (await io.store.isClaimed(`read-done:${readId}`))) return { ...empty, status: 'already_sent' };

  const everyone = await io.store.members();
  const owners = new Set(await io.store.ownerIds());
  const recipients = rehearsal ? everyone.filter((member) => owners.has(member.chatId)) : everyone.filter((member) => wants(member, kind));
  const toGroup = Boolean(io.groupChatId) && !rehearsal;
  if (!recipients.length && !toGroup) return { ...empty, status: 'no_members' };

  const snapshot = await io.snapshot();
  if (snapshot.moves.length < MIN_BOARD) return { ...empty, status: 'board_unreadable', missing: snapshot.missing.length };

  // Everything slow happens before anything is claimed.
  const [headlines, ipos] = await Promise.all([io.headlines().catch(() => [] as Headline[]), kind === 'morning' ? io.ipos().catch(() => [] as IpoListing[]) : Promise.resolve([] as IpoListing[])]);
  const read: ComposedRead = await composeRead({ kind, nowMs, snapshot, headlines, ipos, updatesUrl: io.updatesUrl }, io.writer ?? poolNoteWriter);
  if (!rehearsal) await io.store.saveLastRead(read);
  const symbols = [...new Set(recipients.flatMap((member) => member.holdings))];
  const prices = symbols.length ? await io.holdings(symbols).catch(() => symbols.map(() => null)) : [];
  const priceOf = new Map(symbols.map((symbol, index) => [symbol, prices[index] ?? null] as const));

  let sent = 0;
  let failed = 0;
  let blocked = 0;
  let skipped = 0;
  // Claim one copy right before sending it; give the claim back if the send failed.
  const sendOnce = async (claim: string, send: () => Promise<DeliveryRecord>): Promise<DeliveryRecord | null> => {
    if (scheduled && !(await io.store.claimOnce(claim, ONCE_TTL))) {
      skipped += 1;
      return null;
    }
    // A forced re-send still marks the copy as delivered for the firings after it.
    if (force) await io.store.claimOnce(claim, ONCE_TTL);
    const result = await send();
    if (delivered(result)) sent += 1;
    else if (refused(result)) blocked += 1;
    else {
      failed += 1;
      if (!rehearsal) await io.store.releaseOnce(claim);
    }
    return result;
  };

  // A rehearsal and a forced re-send each get their own idempotency key, so the sender's in-memory
  // record of an earlier copy does not suppress them.
  const keySuffix = rehearsal || force ? `:${nowMs}` : '';
  const label = rehearsal ? '🧪 <b>Rehearsal</b> - only owners see this.\n\n' : '';
  for (const member of recipients) {
    const names = yourNamesHtml(member.holdings.map((symbol) => ({ symbol, move: priceOf.get(symbol) ?? null })));
    const html = label + personalise(read, member, names);
    const result = await sendOnce(`read:${readId}:${member.chatId}`, () =>
      io.send(member.chatId, html, `circle:${rehearsal ? 'rehearsal' : 'read'}:${readId}:${member.chatId}${keySuffix}`, { parseMode: 'HTML', replyMarkup: rateKeyboard(readId) }),
    );
    if (result && refused(result) && !rehearsal) await io.store.saveMember({ ...member, paused: true });
  }
  if (toGroup && io.groupChatId) {
    const group = io.groupChatId;
    // No buttons in the group: one person's tap would rewrite them for everyone.
    await sendOnce(`read:${readId}:group`, () => io.send(group, personalise(read, null), `circle:group:${readId}${keySuffix}`, { parseMode: 'HTML' }));
  }
  if (!rehearsal && failed === 0) await io.store.claimOnce(`read-done:${readId}`, ONCE_TTL);
  return {
    readId,
    status: 'sent',
    rehearsal,
    recipients: recipients.length + (toGroup ? 1 : 0),
    delivered: sent,
    failed,
    blocked,
    skipped,
    note: read.note !== null,
    missing: snapshot.missing.length,
    lateBy,
  };
}
