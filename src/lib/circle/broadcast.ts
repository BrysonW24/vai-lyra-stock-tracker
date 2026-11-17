/**
 * Sending a scheduled read to the circle. Called by POST /api/circle/broadcast, which a GitHub
 * schedule triggers twice a day with a signed request (.github/workflows/circle-reads.yml).
 *
 * Once per read: the read id (its kind and Sydney date) is claimed in the shared store before
 * anything is sent, so the schedule's second firing, a manual re-run or a retried request sends
 * nothing twice. A rehearsal goes only to the owners, is marked as one, and claims nothing.
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
  /** A group chat that gets the read too (no one's names in it), when set. */
  groupChatId: string | null;
  updatesUrl: string | null;
}

export interface BroadcastResult {
  readId: string;
  status: 'sent' | 'already_sent' | 'no_members' | 'board_unreadable';
  rehearsal: boolean;
  recipients: number;
  delivered: number;
  failed: number;
  /** Whether the shared note was written (false = figures only). */
  note: boolean;
  missing: number;
}

const ONCE_TTL = 3 * 86_400;
/** A read with fewer instruments than this is not worth sending - the board was not answering. */
const MIN_BOARD = 15;

function wants(member: CircleMember, kind: ReadKind): boolean {
  return !member.paused && member.reads[kind];
}

export async function sendCircleRead(kind: ReadKind, nowMs: number, io: BroadcastIo, options: { rehearsal?: boolean; force?: boolean } = {}): Promise<BroadcastResult> {
  const rehearsal = options.rehearsal === true;
  const readId = readIdFor(kind, sydneyDate(nowMs));
  const empty = { readId, rehearsal, recipients: 0, delivered: 0, failed: 0, note: false, missing: 0 };

  const everyone = await io.store.members();
  const owners = new Set(await io.store.ownerIds());
  const recipients = rehearsal ? everyone.filter((member) => owners.has(member.chatId)) : everyone.filter((member) => wants(member, kind));
  if (!recipients.length && !(io.groupChatId && !rehearsal)) return { ...empty, status: 'no_members' };

  const snapshot = await io.snapshot();
  if (snapshot.moves.length < MIN_BOARD) return { ...empty, status: 'board_unreadable', missing: snapshot.missing.length };

  // Claimed only now - a read that could not be composed leaves the slot free for the next firing.
  if (!rehearsal && !options.force && !(await io.store.claimOnce(`read:${readId}`, ONCE_TTL))) return { ...empty, status: 'already_sent' };

  const [headlines, ipos] = await Promise.all([io.headlines().catch(() => [] as Headline[]), kind === 'morning' ? io.ipos().catch(() => [] as IpoListing[]) : Promise.resolve([] as IpoListing[])]);
  const read: ComposedRead = await composeRead({ kind, nowMs, snapshot, headlines, ipos, updatesUrl: io.updatesUrl }, io.writer ?? poolNoteWriter);
  if (!rehearsal) await io.store.saveLastRead(read);

  const symbols = [...new Set(recipients.flatMap((member) => member.holdings))];
  const prices = symbols.length ? await io.holdings(symbols).catch(() => symbols.map(() => null)) : [];
  const priceOf = new Map(symbols.map((symbol, index) => [symbol, prices[index] ?? null] as const));

  let delivered = 0;
  let failed = 0;
  const label = rehearsal ? '🧪 <b>Rehearsal</b> - only owners see this.\n\n' : '';
  for (const member of recipients) {
    const names = yourNamesHtml(member.holdings.map((symbol) => ({ symbol, move: priceOf.get(symbol) ?? null })));
    const html = label + personalise(read, member, names);
    const result = await io.send(member.chatId, html, `circle:${rehearsal ? 'rehearsal' : 'read'}:${readId}:${member.chatId}:${rehearsal ? nowMs : 0}`, {
      parseMode: 'HTML',
      replyMarkup: rateKeyboard(readId),
    });
    if (result.status === 'sent' || result.status === 'demo_logged') delivered += 1;
    else failed += 1;
  }
  if (io.groupChatId && !rehearsal) {
    const result = await io.send(io.groupChatId, personalise(read, null), `circle:group:${readId}`, { parseMode: 'HTML', replyMarkup: rateKeyboard(readId) });
    if (result.status === 'sent' || result.status === 'demo_logged') delivered += 1;
    else failed += 1;
  }
  return { readId, status: 'sent', rehearsal, recipients: recipients.length + (io.groupChatId && !rehearsal ? 1 : 0), delivered, failed, note: read.note !== null, missing: snapshot.missing.length };
}
