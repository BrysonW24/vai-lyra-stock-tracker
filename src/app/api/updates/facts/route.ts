import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/api/ai-guard';
import { rateLimitShared } from '@/lib/ratelimit';
import { computeSessionFacts, currentSession } from '@/lib/updates/facts';
import { StoreUnavailableError, loadFacts, loadRead, saveFacts, tryLock, updatesAvailable } from '@/lib/updates/store';

export const dynamic = 'force-dynamic';
/** Computing a session's facts asks the price source about every listed name. */
export const maxDuration = 60;

/**
 * The facts for the newest completed US session, in the shape the writer's `build_facts` reads
 * (src/lib/updates/facts.ts). Public market data, computed once per session and kept: the first
 * caller after a close pays for the fan-out, everyone after reads the stored rows - which is also
 * what makes the facts STABLE. A published read quotes their hash, and the app only accepts a read
 * written from the facts it served.
 *
 * `published` tells the writer whether this session already has its read.
 */
export async function GET(request: NextRequest) {
  if (!updatesAvailable()) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  const limited = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'updates_facts', capacity: 20, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } });
  }

  try {
    const session = await currentSession();
    if (!session) return NextResponse.json({ ok: false, reason: 'no_prices' }, { status: 503 });

    let facts = await loadFacts(session);
    if (!facts) {
      // One caller computes; anyone arriving meanwhile is told to come back rather than start a
      // second fan-out against the price source.
      if (!(await tryLock(`facts:${session}`, 90))) {
        return NextResponse.json({ ok: false, reason: 'computing' }, { status: 202, headers: { 'Retry-After': '20' } });
      }
      const computed = await computeSessionFacts();
      if (!computed.ok) {
        return NextResponse.json({ ok: false, reason: computed.reason, covered: computed.covered, listed: computed.listed }, { status: 503 });
      }
      // Stored under the session the names agreed on, never overwriting facts already served for
      // it: a read may be on its way that quotes their hash.
      facts = (await loadFacts(computed.facts.session)) ?? computed.facts;
      if (facts === computed.facts) await saveFacts(facts);
    }
    const published = (await loadRead(facts.session)) !== null;
    return NextResponse.json({ ok: true, published, ...facts });
  } catch (error) {
    if (error instanceof StoreUnavailableError) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}
