import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardProse } from '@/lib/ai/guardrails/prose';
import { SIGNATURE_HEADER, publishSecret, verifySignature } from '@/lib/updates/publish-auth';
import { SESSION_RE, StoreUnavailableError, loadFacts, loadRead, saveRead, saveRehearsal, updatesAvailable, type PublishedRead } from '@/lib/updates/store';

export const dynamic = 'force-dynamic';

/**
 * Publish a market read. Called by Lyra's writer (workers/stock_scanner/free_daily_read.py on a
 * GitHub runner), never by a browser.
 *
 * The writer is trusted to compose, not to decide what is true, so the app checks four things
 * before anything is stored:
 *   1. THE REQUEST IS THE WRITER'S. Signed with UPDATES_PUBLISH_SECRET over a timestamp and the
 *      exact body (src/lib/updates/publish-auth.ts); a stale or altered request is refused.
 *   2. IT WAS WRITTEN FROM THE FACTS THE APP SERVED. The body quotes the hash of the session's
 *      facts; a hash the app does not hold for that session is refused.
 *   3. THE PROSE PASSES THE APP'S OWN GUARD. The same guardProse that checks chat runs on the
 *      model-written read against the fact sheet it was written from: no figure outside it, no
 *      advice, no forecast. Prose that fails is DROPPED, never edited - the figures still publish,
 *      and the read says why it has no commentary.
 *   4. ONE READ PER SESSION. A second publish for a session that has its read changes nothing
 *      unless it says `replace`.
 *
 * A `rehearsal` is checked exactly the same way and stored where no reader looks.
 */
const MAX_BODY_BYTES = 64_000;

const Body = z.object({
  kind: z.literal('market_read'),
  session: z.string().regex(SESSION_RE),
  factsHash: z.string().regex(/^[0-9a-f]{64}$/),
  /** The fact sheet the model was given - the grounding its prose is checked against. */
  sheet: z.string().min(1).max(30_000),
  figures: z
    .array(z.object({ title: z.string().min(1).max(160), lines: z.array(z.string().max(400)).max(24) }))
    .min(1)
    .max(12),
  prose: z.string().max(4_000).nullable(),
  proseNote: z.string().max(240).nullable().optional(),
  writer: z.object({ provider: z.string().min(1).max(40), model: z.string().min(1).max(120) }).nullable(),
  rehearsal: z.boolean().optional(),
  replace: z.boolean().optional(),
});

const refuse = (reason: string, status: number) => NextResponse.json({ ok: false, reason }, { status });

export async function POST(request: NextRequest) {
  const secret = publishSecret();
  if (!secret || !updatesAvailable()) return refuse('not_configured', 503);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return refuse('payload_too_large', 413);
  const signature = verifySignature(secret, request.headers.get(SIGNATURE_HEADER), raw);
  if (!signature.ok) return refuse(`signature_${signature.reason}`, 401);

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(JSON.parse(raw));
  } catch {
    return refuse('bad_request', 400);
  }

  try {
    const facts = await loadFacts(parsed.session);
    if (!facts || facts.hash !== parsed.factsHash) return refuse('facts_mismatch', 409);

    const rehearsal = parsed.rehearsal === true;
    if (!rehearsal && !parsed.replace && (await loadRead(parsed.session))) {
      return NextResponse.json({ ok: true, session: parsed.session, already: true });
    }

    // The app's own check. A read the guard would have to edit is not published as prose at all.
    let prose = parsed.prose?.trim() || null;
    let proseNote = prose ? null : (parsed.proseNote?.trim() || 'No model could write the read for this session, so only the figures are shown.');
    if (prose) {
      const guarded = guardProse(prose, [parsed.sheet]);
      if (!guarded.ok || guarded.strippedFigures.length > 0 || guarded.removedPredictions.length > 0) {
        prose = null;
        proseNote = "The written read did not pass Lyra's checks, so only the figures are shown.";
      }
    }

    const read: PublishedRead = {
      kind: 'market_read',
      session: parsed.session,
      factsHash: parsed.factsHash,
      publishedAt: new Date().toISOString(),
      figures: parsed.figures,
      prose,
      proseNote,
      writer: prose ? parsed.writer : null,
    };
    if (rehearsal) await saveRehearsal(read);
    else await saveRead(read);
    return NextResponse.json({ ok: true, session: read.session, prose: prose !== null, rehearsal });
  } catch (error) {
    if (error instanceof StoreUnavailableError) return refuse('not_configured', 503);
    return refuse('error', 500);
  }
}
