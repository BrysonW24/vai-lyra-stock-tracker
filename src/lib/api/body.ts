import { type NextRequest } from 'next/server';

/**
 * Body handling for routes that are open to the whole internet (the community board).
 * Two-layer size gate: callers should reject by Content-Length BEFORE buffering when the
 * header is present (cheap, catches honest clients), then use readJsonCapped - which
 * re-checks the actual text after reading - because chunked requests carry no
 * Content-Length at all and would otherwise bypass the header gate entirely.
 */
export async function readJsonCapped<T>(
  request: NextRequest,
  maxBytes: number,
): Promise<{ body?: T; tooLarge?: boolean; invalid?: boolean }> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { invalid: true };
  }
  if (raw.length > maxBytes) return { tooLarge: true };
  try {
    return { body: JSON.parse(raw) as T };
  } catch {
    return { invalid: true };
  }
}
