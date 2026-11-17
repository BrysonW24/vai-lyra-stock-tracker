#!/usr/bin/env node
/**
 * Trigger one of the circle's scheduled reads - what .github/workflows/circle-reads.yml runs.
 *
 *   node scripts/circle-read.mjs morning               send the morning read (once per Sydney day)
 *   node scripts/circle-read.mjs evening --rehearsal   send it to the owners only, marked as a rehearsal
 *   node scripts/circle-read.mjs morning --force       send again even if today's was sent
 *
 * The request is signed with UPDATES_PUBLISH_SECRET exactly as the free market read's writer signs
 * its publish (src/lib/updates/publish-auth.ts): `x-lyra-signature: t=<unix seconds>,v1=<hmac>` over
 * `<timestamp>.<body>`. LYRA_CIRCLE_URL is the deployment that holds the Telegram bot (default: the
 * production app). Prints the counts the app returns; never a member, a ticker or a secret.
 * Exits 1 when the app refuses, errors, or some sends failed - so the schedule's failure pager fires.
 * A circle that is not switched on yet (no secret here, or the app answers `not_configured`) is a
 * visible ::warning:: on the run and exit 0: four pages a day for a feature nobody turned on would
 * teach the founder to ignore the pager.
 */
import { createHmac } from 'node:crypto';

const kind = process.argv[2];
const flags = new Set(process.argv.slice(3));
if (kind !== 'morning' && kind !== 'evening') {
  console.error('usage: node scripts/circle-read.mjs <morning|evening> [--rehearsal] [--force]');
  process.exit(2);
}
const secret = process.env.UPDATES_PUBLISH_SECRET?.trim() ?? '';
if (secret.length < 32) {
  console.log('::warning::circle-read: UPDATES_PUBLISH_SECRET is not set (32+ characters) - the circle is not switched on, nothing sent.');
  process.exit(0);
}
const base = (process.env.LYRA_CIRCLE_URL?.trim() || 'https://lyra.vivacityai.com.au').replace(/\/$/, '');
const body = JSON.stringify({ kind, rehearsal: flags.has('--rehearsal') || undefined, force: flags.has('--force') || undefined });
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

const res = await fetch(`${base}/api/circle/broadcast`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-lyra-signature': `t=${timestamp},v1=${signature}` },
  body,
  signal: AbortSignal.timeout(90_000),
}).catch((error) => ({ ok: false, status: 0, json: async () => ({ reason: error instanceof Error ? error.name : 'network' }) }));

const result = await res.json().catch(() => ({}));
const { readId, status, rehearsal, recipients, delivered, failed, note, missing, reason } = result ?? {};
console.log(JSON.stringify({ http: res.status, readId, status, rehearsal, recipients, delivered, failed, note, missing, reason }));
if (res.status === 503 && (reason === 'not_configured' || reason === 'no_bot')) {
  console.log(`::warning::circle-read: the app says the circle is not switched on (${reason}) - nothing sent.`);
  process.exit(0);
}
if (status === 'board_unreadable') console.log('::warning::circle-read: the world board could not be read - no read sent; the next firing tries again.');
if (!res.ok || (typeof failed === 'number' && failed > 0)) process.exit(1);
