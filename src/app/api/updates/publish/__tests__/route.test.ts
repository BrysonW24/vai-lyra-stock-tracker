/**
 * POST /api/updates/publish - the app's four checks on a read the writer sends, and what each one
 * does when it fails. The one that matters most is pinned hardest: prose that fails the guard is
 * DROPPED and the figures still publish. The read is never edited into something the model did not
 * write, and a slip never reaches a reader.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import vector from '../../../../../../contracts/updates/signature-vector.json';
import { SIGNATURE_HEADER, signatureHeader } from '@/lib/updates/publish-auth';
import type { PublishedRead } from '@/lib/updates/store';

const store = vi.hoisted(() => ({
  available: true,
  facts: new Map<string, { session: string; hash: string }>(),
  reads: new Map<string, PublishedRead>(),
  rehearsals: new Map<string, PublishedRead>(),
}));

vi.mock('@/lib/updates/store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/updates/store')>('@/lib/updates/store');
  return {
    ...actual,
    updatesAvailable: () => store.available,
    loadFacts: async (session: string) => {
      if (!store.available) throw new actual.StoreUnavailableError();
      return store.facts.get(session) ?? null;
    },
    loadRead: async (session: string) => store.reads.get(session) ?? null,
    saveRead: async (read: PublishedRead) => {
      store.reads.set(read.session, read);
    },
    saveRehearsal: async (read: PublishedRead) => {
      store.rehearsals.set(read.session, read);
    },
  };
});

import { POST } from '../route';

const SESSION = '2026-11-05';
const HASH = 'a'.repeat(64);
const SHEET = [
  'Session 2026-11-05. Names scanned: 61.',
  'Setups: 7 (strong 2, watchlist 5), down from 9 at the prior close.',
  'NVDA closed at 186.40, score 71.5, watchlist setup. Volume 1.8x its average.',
  'AMD closed at 142.10, score 58.0, no signal.',
].join('\n');
const FIGURES = [{ title: 'Session', lines: ['7 setups, down from 9', 'NVDA 186.40 (71.5)'] }];

function body(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    kind: 'market_read',
    session: SESSION,
    factsHash: HASH,
    sheet: SHEET,
    figures: FIGURES,
    prose: null,
    proseNote: null,
    writer: null,
    ...overrides,
  });
}

function post(raw: string, options: { header?: string | null; at?: number } = {}): Promise<Response> {
  const at = options.at ?? Math.floor(Date.now() / 1000);
  const header = options.header === undefined ? signatureHeader(vector.secret, at, raw) : options.header;
  const headers = new Headers({ 'content-type': 'application/json' });
  if (header !== null) headers.set(SIGNATURE_HEADER, header);
  return POST(new NextRequest('http://localhost/api/updates/publish', { method: 'POST', body: raw, headers }));
}

async function answer(response: Response) {
  return { status: response.status, ...((await response.json()) as Record<string, unknown>) };
}

describe('POST /api/updates/publish', () => {
  beforeEach(() => {
    vi.stubEnv('UPDATES_PUBLISH_SECRET', vector.secret);
    store.available = true;
    store.facts.clear();
    store.reads.clear();
    store.rehearsals.clear();
    store.facts.set(SESSION, { session: SESSION, hash: HASH });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('stores a signed read written from the facts the app served, with its writer', async () => {
    const prose = 'Seven names are in a setup, two of them strong, down from nine at the prior close. NVDA closed at 186.40 on 1.8x its usual volume and stays a watchlist setup.';
    const result = await answer(await post(body({ prose, writer: { provider: 'local', model: 'gemma-4-e4b-qat' } })));
    expect(result).toMatchObject({ status: 200, ok: true, session: SESSION, prose: true, rehearsal: false });
    const stored = store.reads.get(SESSION)!;
    expect(stored.prose).toBe(prose);
    expect(stored.proseNote).toBeNull();
    expect(stored.writer).toEqual({ provider: 'local', model: 'gemma-4-e4b-qat' });
    expect(stored.figures).toEqual(FIGURES);
    expect(stored.factsHash).toBe(HASH);
    expect(stored.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts exactly what the worker signs (the shared vector), and only while it is live', async () => {
    const vectorSession = vector.body.match(/"session":"(\d{4}-\d{2}-\d{2})"/)![1];
    store.facts.set(vectorSession, { session: vectorSession, hash: vector.body.match(/"factsHash":"([0-9a-f]{64})"/)![1] });
    // Today the vector's header is long stale: the clock check runs on the real header.
    expect(await answer(await post(vector.body, { header: vector.header }))).toMatchObject({ status: 401, ok: false, reason: 'signature_stale' });
    // At the moment it was signed, the route takes it as the worker's.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date((vector.timestamp + 30) * 1000));
      const result = await answer(await post(vector.body, { header: vector.header }));
      expect(result).toMatchObject({ status: 200, ok: true, session: vectorSession, prose: false });
      expect(store.reads.get(vectorSession)).toMatchObject({ factsHash: 'a'.repeat(64), prose: null, proseNote: 'x', writer: null });
    } finally {
      vi.useRealTimers();
    }
  });

  describe('check 1 - the request is the writer’s', () => {
    it('refuses a request without a signature, a malformed one, one signed with another secret, and a stale one', async () => {
      expect(await answer(await post(body(), { header: null }))).toMatchObject({ status: 401, reason: 'signature_missing' });
      expect(await answer(await post(body(), { header: 'v1=deadbeef' }))).toMatchObject({ status: 401, reason: 'signature_malformed' });
      const now = Math.floor(Date.now() / 1000);
      const other = signatureHeader('another-secret-that-is-long-enough-to-count-00', now, body());
      expect(await answer(await post(body(), { header: other }))).toMatchObject({ status: 401, reason: 'signature_mismatch' });
      expect(await answer(await post(body(), { at: now - 3600 }))).toMatchObject({ status: 401, reason: 'signature_stale' });
      expect(store.reads.size).toBe(0);
    });

    it('refuses a body changed after it was signed', async () => {
      const signed = body();
      const header = signatureHeader(vector.secret, Math.floor(Date.now() / 1000), signed);
      const tampered = signed.replace('"prose":null', '"prose":"Buy everything."');
      expect(await answer(await post(tampered, { header }))).toMatchObject({ status: 401, reason: 'signature_mismatch' });
    });

    it('says plainly when publishing is not switched on', async () => {
      vi.stubEnv('UPDATES_PUBLISH_SECRET', '');
      expect(await answer(await post(body()))).toMatchObject({ status: 503, reason: 'not_configured' });
      vi.stubEnv('UPDATES_PUBLISH_SECRET', vector.secret);
      store.available = false;
      expect(await answer(await post(body()))).toMatchObject({ status: 503, reason: 'not_configured' });
    });
  });

  describe('check 2 - it was written from the facts the app served', () => {
    it('refuses a hash the app does not hold for that session', async () => {
      expect(await answer(await post(body({ factsHash: 'b'.repeat(64) })))).toMatchObject({ status: 409, reason: 'facts_mismatch' });
      expect(await answer(await post(body({ session: '2026-11-04' })))).toMatchObject({ status: 409, reason: 'facts_mismatch' });
      expect(store.reads.size).toBe(0);
    });
  });

  describe('check 3 - the prose passes the app’s own guard', () => {
    const dropped = async (prose: string) => {
      const result = await answer(await post(body({ prose, writer: { provider: 'groq', model: 'x' } })));
      expect(result).toMatchObject({ status: 200, ok: true, prose: false });
      const stored = store.reads.get(SESSION)!;
      expect(stored.prose).toBeNull();
      expect(stored.proseNote).toBe("The written read did not pass Lyra's checks, so only the figures are shown.");
      expect(stored.writer).toBeNull();
      expect(stored.figures).toEqual(FIGURES);
      return stored;
    };

    it('drops prose carrying a figure that is not in the fact sheet - the figures still publish', async () => {
      await dropped('Seven names are in a setup. NVDA closed at 191.20 and is the strongest of them.');
    });

    it('drops prose that advises', async () => {
      await dropped('Seven names are in a setup. Buy NVDA before it runs.');
    });

    it('drops prose that forecasts', async () => {
      await dropped('Seven names are in a setup. NVDA will rally next week as the recovery continues.');
    });

    it('never edits prose into something the model did not write', async () => {
      // One good sentence and one invented figure: the guard could strip the bad sentence, but a
      // read is published whole or not at all.
      const stored = await dropped('Seven names are in a setup, down from nine. AMD closed at 139.95.');
      expect(stored.prose).toBeNull();
    });

    it('publishes figures only when the writer sent no prose, carrying its note', async () => {
      const note = 'No model could write the read for this session, so only the figures are shown.';
      const result = await answer(await post(body({ prose: null, proseNote: note })));
      expect(result).toMatchObject({ status: 200, ok: true, prose: false });
      expect(store.reads.get(SESSION)).toMatchObject({ prose: null, proseNote: note, writer: null });
    });

    it('treats blank prose as no prose', async () => {
      await post(body({ prose: '   ' }));
      expect(store.reads.get(SESSION)!.prose).toBeNull();
      expect(store.reads.get(SESSION)!.proseNote).toMatch(/only the figures are shown/);
    });
  });

  describe('check 4 - one read per session', () => {
    it('leaves a published session alone unless told to replace it', async () => {
      await post(body({ prose: 'Seven names are in a setup, down from nine.' }));
      const first = store.reads.get(SESSION)!;
      const again = await answer(await post(body({ prose: 'Seven names are in a setup.' })));
      expect(again).toMatchObject({ status: 200, ok: true, already: true });
      expect(store.reads.get(SESSION)).toBe(first);
      const replaced = await answer(await post(body({ prose: 'Seven names are in a setup.', replace: true })));
      expect(replaced).toMatchObject({ status: 200, ok: true, prose: true });
      expect(store.reads.get(SESSION)!.prose).toBe('Seven names are in a setup.');
    });

    it('checks a rehearsal exactly the same way and stores it where no reader looks', async () => {
      const result = await answer(await post(body({ prose: 'NVDA closed at 191.20.', rehearsal: true })));
      expect(result).toMatchObject({ status: 200, ok: true, prose: false, rehearsal: true });
      expect(store.reads.size).toBe(0);
      expect(store.rehearsals.get(SESSION)).toMatchObject({ prose: null, session: SESSION });
      // A rehearsal does not count as the session's read.
      await post(body({ prose: 'Seven names are in a setup.' }));
      expect(store.reads.get(SESSION)!.prose).toBe('Seven names are in a setup.');
    });
  });

  describe('the body', () => {
    it('refuses a body that is not a market read', async () => {
      for (const bad of [
        '{not json',
        body({ kind: 'briefing' }),
        body({ session: '5 Nov 2026' }),
        body({ factsHash: 'short' }),
        body({ figures: [] }),
        body({ sheet: '' }),
        body({ prose: 'x'.repeat(4_001) }),
        body({ writer: { provider: 'groq' } }),
      ]) {
        expect(await answer(await post(bad))).toMatchObject({ status: 400, reason: 'bad_request' });
      }
      expect(store.reads.size).toBe(0);
    });

    it('refuses a body too large to be a read', async () => {
      const result = await answer(await post(body({ sheet: 'x'.repeat(29_000), prose: 'y'.repeat(3_900), figures: Array.from({ length: 12 }, () => ({ title: 't', lines: Array.from({ length: 24 }, () => 'z'.repeat(399)) })) })));
      expect(result).toMatchObject({ status: 413, reason: 'payload_too_large' });
    });
  });
});
