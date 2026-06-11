/**
 * WhatsApp Cloud API webhook signature verification - pure, unit-testable. [Part 9]
 *
 * Meta signs every webhook POST with `X-Hub-Signature-256: sha256=<hex>` where <hex>
 * is the HMAC-SHA256 of the RAW request body keyed with the app secret. Verification
 * must run against the raw bytes BEFORE any JSON parsing, and must fail closed:
 * missing header, missing secret, malformed hex, or any mismatch all return false.
 *
 * SECURITY: WHATSAPP_APP_SECRET is server-side only - never NEXT_PUBLIC_*, never
 * logged. This module never throws and never leaks secret material in any path.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

/** Exactly 64 hex chars - the length of a SHA-256 digest. Anything else is rejected early. */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Verify a Meta `X-Hub-Signature-256` header against the raw request body.
 *
 * @param rawBody   The raw request body text, exactly as received (no re-serialisation).
 * @param header    The `X-Hub-Signature-256` header value, or null when absent.
 * @param appSecret The Meta app secret (WHATSAPP_APP_SECRET). Undefined/empty fails closed.
 * @returns true only when the HMAC matches via a constant-time comparison.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  header: string | null,
  appSecret: string | undefined,
): boolean {
  // Fail closed: an unconfigured secret must never let traffic through.
  if (!appSecret) return false;
  if (!header || !header.startsWith(SIGNATURE_PREFIX)) return false;

  const providedHex = header.slice(SIGNATURE_PREFIX.length).trim();
  if (!SHA256_HEX_PATTERN.test(providedHex)) return false;

  const expectedHex = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  const provided = Buffer.from(providedHex.toLowerCase(), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
