/**
 * The circle's twice-daily reads - one world read composed once, then a personal copy per member.
 *
 *   morning (about 8:45am Sydney, Tuesday to Saturday): how Wall Street closed, how Europe closed,
 *     where Asia and Australia stand before they open, the tech pulse, IPOs and the headlines.
 *   evening (about 7:15pm Sydney, Monday to Friday): how Asia and Australia closed, Europe in its
 *     first hour, where US futures are pointing, the tech pulse.
 *
 * Everything in a read is computed by code from the world board, except one short "what it means"
 * note an open model writes for everyone at once - checked by guardProse against the very facts it
 * was given, and simply left out when the pool cannot write it or the guard stops it. Personal
 * copies differ only in order (the regions a member follows come first) and in one "Your names"
 * line priced from their own holdings. No model is called per person.
 */
import { completeFromPool, freePoolAvailable } from '@/lib/ai/free-pool';
import { guardProse } from '@/lib/ai/guardrails/prose';
import { composeSystem, LYRA_GUARDRAILS, LYRA_IDENTITY } from '@/lib/ai/system-prompt';
import { escapeHtml } from '@/lib/notifications/telegram-templates';
import type { InstrumentMove, WorldSnapshot } from '@/lib/world/compute';
import type { WorldRegion } from '@/lib/world/instruments';
import { newsFactsText, type Headline, type IpoListing } from '@/lib/world/news';
import { formatChange, notableHtml, regionHtml, regionsFor, sessionLabel, techPulseHtml, worldFactsText } from '@/lib/world/text';
import { readIdFor } from './commands';
import type { CircleMember, CircleTopic, ReadKind } from './store';
import { NOT_ADVICE } from './ui';

export const TELEGRAM_SAFE_CHARS = 3_800;

const ORDER: Record<ReadKind, readonly WorldRegion[]> = {
  morning: ['us', 'europe', 'asia', 'australia', 'macro'],
  evening: ['asia', 'australia', 'europe', 'us', 'macro'],
};

const TOPIC_REGION: Partial<Record<CircleTopic, WorldRegion>> = { asia: 'asia', europe: 'europe', us: 'us', australia: 'australia', macro: 'macro', crypto: 'macro' };

/** One read in parts, so each member's copy can be put together in their own order. */
export interface ComposedRead {
  readId: string;
  kind: ReadKind;
  /** The Sydney date the read is for, YYYY-MM-DD. */
  date: string;
  heading: string;
  /** The model's note, plain text, already guarded. Null when there is none. */
  note: string | null;
  /** `provider:model` that wrote the note. */
  writer: string | null;
  pulse: string;
  regions: Array<{ region: WorldRegion; html: string }>;
  notable: string;
  ipos: string;
  news: string;
  footer: string;
  /** Names the board could not read this time - said, never hidden. */
  missing: string[];
}

export function sydneyDate(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
}

function iposHtml(ipos: IpoListing[]): string {
  if (!ipos.length) return '';
  const lines = ipos.slice(0, 5).map((ipo) => `• ${escapeHtml(sessionLabel(ipo.date))}: ${escapeHtml(ipo.name)}${ipo.symbol ? ` (${escapeHtml(ipo.symbol)})` : ''}${ipo.exchange ? ` - ${escapeHtml(ipo.exchange)}` : ''}, ${escapeHtml(ipo.status)}${ipo.price ? ` at ${escapeHtml(ipo.price)}` : ''}`);
  return `📜 <b>IPOs</b>\n${lines.join('\n')}`;
}

function newsHtml(headlines: Headline[]): string {
  if (!headlines.length) return '';
  const lines = headlines.slice(0, 3).map((item) => `• <a href="${escapeHtml(item.url)}">${escapeHtml(item.headline)}</a> - ${escapeHtml(item.source)}`);
  return `📰 <b>In the news</b>\n${lines.join('\n')}`;
}

const NOTE_TASK = {
  morning:
    'Write the opening of this morning\'s read for a few friends who follow global technology shares: two or three plain sentences. First the single most important thing in the figures below - name the market, the move and the period - then what else stood out across the US, Europe and Asia. Quote figures exactly as written. No forecasts, no advice, no lists.',
  evening:
    'Write the opening of this evening\'s read for a few friends who follow global technology shares: two or three plain sentences. First the single most important thing in how Asia and Australia closed - name the market, the move and the period - then how Europe has opened and where US futures stand. Quote figures exactly as written. No forecasts, no advice, no lists.',
} as const;

export interface NoteWriter {
  ready: () => boolean;
  write: (system: string, prompt: string) => Promise<{ text: string; model: string } | null>;
}

export const poolNoteWriter: NoteWriter = {
  ready: () => freePoolAvailable(),
  write: async (system, prompt) => {
    const outcome = await completeFromPool({ system, prompt, maxTokens: 260, temperature: 0.2 });
    return outcome.ok ? { text: outcome.result.text, model: `${outcome.result.provider}:${outcome.result.model}` } : null;
  },
};

/** The shared note, guarded. Null when there is no pool, no answer, or the guard stopped it. */
export async function writeNote(kind: ReadKind, facts: string, writer: NoteWriter): Promise<{ text: string; model: string } | null> {
  if (!writer.ready()) return null;
  const system = composeSystem([LYRA_IDENTITY, LYRA_GUARDRAILS, 'FORMAT: Plain sentences only - no markdown, no lists, no emoji.', `CONTEXT (computed by code just now):\n${facts}`]);
  const written = await writer.write(system, NOTE_TASK[kind]).catch(() => null);
  if (!written) return null;
  const guarded = guardProse(written.text.trim(), [system]);
  if (!guarded.ok || !guarded.text.trim()) return null;
  return { text: guarded.text.trim().slice(0, 700), model: written.model };
}

export interface ComposeInputs {
  kind: ReadKind;
  nowMs: number;
  snapshot: WorldSnapshot;
  headlines: Headline[];
  ipos: IpoListing[];
  /** The address of the app's Updates page, for the morning read's link to the US session read. */
  updatesUrl: string | null;
}

export async function composeRead(inputs: ComposeInputs, writer: NoteWriter = poolNoteWriter): Promise<ComposedRead> {
  const { kind, nowMs, snapshot } = inputs;
  const date = sydneyDate(nowMs);
  const facts = [worldFactsText(snapshot), newsFactsText(inputs.headlines, inputs.ipos)].filter(Boolean).join('\n\n');
  const note = await writeNote(kind, facts, writer);
  const title = kind === 'morning' ? '☀️ <b>Lyra morning read</b>' : '🌆 <b>Lyra evening read</b>';
  return {
    readId: readIdFor(kind, date),
    kind,
    date,
    heading: `${title} · ${escapeHtml(sessionLabel(date))}`,
    note: note?.text ?? null,
    writer: note?.model ?? null,
    pulse: techPulseHtml(snapshot.techPulse),
    regions: regionsFor(snapshot, ORDER[kind]).map((region) => ({ region: region.region, html: regionHtml(region) })),
    notable: notableHtml(snapshot, 4),
    ipos: kind === 'morning' ? iposHtml(inputs.ipos) : '',
    news: newsHtml(inputs.headlines),
    footer: [
      kind === 'morning' && inputs.updatesUrl ? `The US session in detail: ${escapeHtml(inputs.updatesUrl)}` : '',
      `<i>Reply with any question - only you see the answer. ${NOT_ADVICE}</i>`,
    ]
      .filter(Boolean)
      .join('\n'),
    missing: snapshot.missing,
  };
}

/** "NVDA -2.1% (5 sessions -6.0%)" for each holding that could be priced. */
export function yourNamesHtml(holdings: ReadonlyArray<{ symbol: string; move: InstrumentMove | null }>): string {
  const priced = holdings.filter((entry): entry is { symbol: string; move: InstrumentMove } => entry.move !== null);
  if (!priced.length) return '';
  const chips = priced.slice(0, 12).map(({ symbol, move }) => `${escapeHtml(symbol)} ${formatChange(move.change1d)} (5 sessions ${formatChange(move.change5d)})`);
  const unread = holdings.length - priced.length;
  return `💼 <b>Your names</b>\n${chips.join(' · ')}${unread ? `\n<i>${unread} could not be priced this time.</i>` : ''}`;
}

/** Fit to Telegram: drop the least essential parts first, never cut mid-tag. */
function fit(parts: Array<{ html: string; drop: number }>): string {
  const keep = parts.filter((part) => part.html);
  const joined = () => keep.map((part) => part.html).join('\n\n');
  while (joined().length > TELEGRAM_SAFE_CHARS) {
    const droppable = keep.filter((part) => part.drop > 0).sort((a, b) => b.drop - a.drop)[0];
    if (!droppable) break;
    keep.splice(keep.indexOf(droppable), 1);
  }
  return joined();
}

/**
 * One member's copy: the regions they follow first, their own names, then the rest. `member` null is
 * the copy for a group chat - nobody's names in it.
 */
export function personalise(read: ComposedRead, member: Pick<CircleMember, 'topics'> | null, names: string = ''): string {
  const followed = new Set((member?.topics ?? []).map((topic) => TOPIC_REGION[topic]).filter(Boolean));
  const regions = [...read.regions].sort((a, b) => Number(followed.has(b.region)) - Number(followed.has(a.region)));
  const wantsIpos = !member || member.topics.length === 0 || member.topics.includes('ipos');
  return fit([
    { html: read.heading, drop: 0 },
    { html: read.note ? escapeHtml(read.note) : '', drop: 0 },
    { html: read.pulse, drop: 0 },
    ...regions.map((region) => ({ html: region.html, drop: region.region === 'macro' ? 4 : 0 })),
    { html: names, drop: 0 },
    { html: read.notable, drop: 3 },
    { html: wantsIpos ? read.ipos : '', drop: 5 },
    { html: read.news, drop: 6 },
    { html: read.missing.length ? `<i>Not read this time: ${escapeHtml(read.missing.join(', '))}.</i>` : '', drop: 2 },
    { html: read.footer, drop: 0 },
  ]);
}
