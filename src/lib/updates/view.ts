/**
 * What the Updates page shows for a published read - the wording decisions, kept out of the
 * component so they can be tested.
 */
import type { PublishedRead } from '@/lib/updates/store';

const DAY = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "Thursday 5 November 2026" for a session's New York day. */
export function sessionLabel(session: string): string {
  const date = new Date(`${session}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? session : DAY.format(date).replace(',', '');
}

/**
 * Who wrote the prose, in words a reader can weigh: the model's own name, and whether it ran on a
 * free hosted tier or on Lyra's own machine. Never a brand claim the app cannot stand behind.
 */
export function writerLabel(read: PublishedRead): string | null {
  if (!read.prose || !read.writer) return null;
  const name = read.writer.model.replace(/^@cf\/[^/]+\//, '').replace(/^[^/]+\//, '');
  const where = read.writer.provider === 'local' ? "an open-source model running on Lyra's own machine" : 'an open-source model on a free hosted tier';
  return `Written by ${name}, ${where}. Every figure in it was checked against the engine's own before it was published.`;
}

/** The read's paragraphs, in order. */
export function paragraphs(prose: string | null): string[] {
  return (prose ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
