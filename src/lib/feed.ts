/**
 * Live Wire - one rolling stream that captures every signal change plus market/policy
 * headlines, newest first. A fast "what's changing right now" surface. Composes data we
 * already have (signal changes + intelligence + calendar events); a small illustrative
 * macro/policy wire (Trump / Fed / AI labs) is flagged sample until live newsflow lands.
 */

import type { SignalChange } from '@/types/scanner';
import type { IntelligenceItem } from '@/lib/intelligence';
import { type CalendarEvent, eventTypeLabel } from '@/lib/calendar';

export type FeedKind = 'signal' | 'news' | 'event';
export type FeedTone = 'pos' | 'neg' | 'warn' | 'neutral';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  time: string; // ISO
  ticker?: string;
  text: string;
  tone: FeedTone;
  source: string;
  sample?: boolean;
}

// Illustrative macro/policy wire so the surface reads like the live BuzzFeed it will be.
// Flagged sample; replaced by live Finnhub/AI newsflow next. Kept generic on purpose -
// no fabricated specific quotes.
const SAMPLE_WIRE: FeedItem[] = [
  { id: 'w1', kind: 'news', time: '2026-06-07T13:10:00Z', text: 'White House floats tighter AI-chip export controls', tone: 'warn', source: 'Policy', sample: true },
  { id: 'w2', kind: 'news', time: '2026-06-07T11:40:00Z', ticker: 'MSFT', text: 'Microsoft lifts AI datacentre capex guidance', tone: 'pos', source: 'Wire', sample: true },
  { id: 'w3', kind: 'news', time: '2026-06-07T09:25:00Z', text: 'OpenAI ships a new flagship model tier', tone: 'pos', source: 'Wire', sample: true },
  { id: 'w4', kind: 'news', time: '2026-06-06T18:00:00Z', text: 'Anthropic expands its enterprise push with fresh funding', tone: 'pos', source: 'Wire', sample: true },
  { id: 'w5', kind: 'news', time: '2026-06-06T15:30:00Z', text: 'Fed officials signal patience on rate cuts', tone: 'neutral', source: 'Macro', sample: true },
];

function signalTone(status: SignalChange['status']): FeedTone {
  return status === 'improving' ? 'pos' : status === 'weakening' ? 'neg' : 'neutral';
}
function newsTone(sentiment: string): FeedTone {
  return sentiment === 'positive' ? 'pos' : sentiment === 'negative' ? 'neg' : 'neutral';
}

export function buildLiveWire(
  signalChanges: SignalChange[],
  intelligence: IntelligenceItem[],
  events: CalendarEvent[],
  /**
   * True when the intelligence feed is the bundled illustrative sample (no live worker
   * rows on this deployment). Flags every intelligence item `sample` so the wire never
   * shows demo headlines as real market news - the /wire half of the 2026-07-27 audit fix.
   */
  intelligenceIsSample = true,
  /**
   * True when the calendar events are the re-anchored sample seeds. Flags every event
   * item `sample` - the footer promises sample items are tagged, and calendar rows were
   * the one stream that broke that contract (2026-08-11 audit).
   */
  calendarIsSample = true,
  /** True when the signal changes come from the bundled demo dataset, not the live engine. */
  signalChangesAreSample = false,
): FeedItem[] {
  const items: FeedItem[] = [];

  signalChanges.forEach((c, i) => {
    items.push({
      id: `sig-${c.symbol}-${i}`,
      kind: 'signal',
      time: c.at,
      ticker: c.symbol,
      text: `${c.label}${c.change ? ` (${c.change > 0 ? '+' : ''}${c.change})` : ''}`,
      tone: signalTone(c.status),
      source: 'Signal engine',
      sample: signalChangesAreSample || undefined,
    });
  });

  intelligence.forEach((n, i) => {
    items.push({
      id: `news-${i}`,
      kind: 'news',
      time: n.publishedAt,
      ticker: n.tickers[0],
      text: n.headline,
      tone: newsTone(n.sentiment),
      source: n.sourceName,
      sample: intelligenceIsSample,
    });
  });

  items.push(...SAMPLE_WIRE);

  // The wire is what has ALREADY happened, newest first - so drop UPCOMING calendar
  // events (those belong in the Calendar, not the "what just changed" stream). nowRef =
  // the latest real activity already in the stream.
  const nowRef = items.reduce((max, it) => Math.max(max, new Date(it.time).getTime()), 0);
  events.forEach((e, i) => {
    const time = new Date(`${e.date}T00:00:00Z`).getTime();
    if (time > nowRef + 86_400_000) return; // skip future events (one-day grace)
    items.push({
      id: `evt-${e.id ?? i}`,
      kind: 'event',
      time: `${e.date}T00:00:00Z`,
      ticker: e.ticker ?? undefined,
      text: e.title,
      tone: e.importance === 'high' ? 'warn' : 'neutral',
      source: eventTypeLabel(e.type),
      sample: calendarIsSample,
    });
  });

  return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}
