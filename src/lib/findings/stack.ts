import type { DrawerStackItem } from './types';

/**
 * Encode/parse the investigation drawer stack into the URL (?inv=) so an investigation is
 * shareable and survives reload. Entity ids can themselves contain ':' (e.g.
 * `node:earth-observation`, `theme:space-intelligence`), so each `type:id` token splits on the
 * FIRST colon only - everything after it is the id. Stack items are joined with `~` (not used in
 * any type or id).
 */
export function encodeStack(stack: DrawerStackItem[]): string {
  return stack.map((i) => `${i.type}:${i.id}`).join('~');
}

export function parseStack(raw: string | null | undefined): DrawerStackItem[] {
  if (!raw) return [];
  return raw
    .split('~')
    .map((tok) => {
      const i = tok.indexOf(':');
      if (i < 0) return null;
      const type = tok.slice(0, i) as DrawerStackItem['type'];
      const id = tok.slice(i + 1);
      return id ? { type, id } : null;
    })
    .filter((x): x is DrawerStackItem => Boolean(x));
}
