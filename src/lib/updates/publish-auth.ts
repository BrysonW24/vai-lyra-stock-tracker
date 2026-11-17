/**
 * Proof that a request to publish an update came from Lyra's own writer.
 *
 * The writer runs on a GitHub runner and holds one secret (UPDATES_PUBLISH_SECRET). It signs each
 * request with it rather than sending it: the header carries a timestamp and an HMAC-SHA256 of
 * `<timestamp>.<body>`, so a captured request cannot be replayed later or have its body changed.
 *
 *     x-lyra-signature: t=<unix seconds>,v1=<hex hmac>
 *
 * The same scheme is implemented in workers/stock_scanner/app_client.py; a test vector shared by
 * both sides (contracts/updates/signature-vector.json) keeps them in step.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-lyra-signature';
/** How far a request's timestamp may be from now, either way. */
export const TOLERANCE_SECONDS = 300;

export function publishSecret(): string | null {
  const secret = process.env.UPDATES_PUBLISH_SECRET?.trim();
  // A short secret is a guessable one; refuse to treat it as configured.
  return secret && secret.length >= 32 ? secret : null;
}

export function signBody(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function signatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signBody(secret, timestamp, body)}`;
}

export type SignatureVerdict = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'mismatch' };

export function verifySignature(secret: string, header: string | null | undefined, body: string, nowMs: number = Date.now()): SignatureVerdict {
  if (!header) return { ok: false, reason: 'missing' };
  const match = /^t=(\d{9,12}),v1=([0-9a-f]{64})$/.exec(header.trim());
  if (!match) return { ok: false, reason: 'malformed' };
  const timestamp = Number(match[1]);
  if (Math.abs(nowMs / 1000 - timestamp) > TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  const expected = Buffer.from(signBody(secret, timestamp, body), 'hex');
  const supplied = Buffer.from(match[2]!, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? { ok: true } : { ok: false, reason: 'mismatch' };
}
