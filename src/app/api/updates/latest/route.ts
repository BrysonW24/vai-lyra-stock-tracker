import { NextResponse } from 'next/server';
import { StoreUnavailableError, loadLatestRead, updatesAvailable } from '@/lib/updates/store';

export const dynamic = 'force-dynamic';

/** The newest published market read, as the Updates page shows it. Public: it is the same for everyone. */
export async function GET() {
  if (!updatesAvailable()) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  try {
    const read = await loadLatestRead();
    return NextResponse.json({ ok: true, read }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (error) {
    if (error instanceof StoreUnavailableError) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}
