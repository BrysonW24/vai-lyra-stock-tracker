#!/usr/bin/env node
/**
 * `npm run announce` - post the current release (RELEASES[0] in src/lib/version.ts) to every
 * configured chat channel. Run it AFTER `npm run release` + commit + push, so you never announce
 * a version that didn't actually ship.
 *
 * Channels (each is optional - the script sends to whatever is configured and skips the rest):
 *   Slack     SLACK_UPDATES_WEBHOOK_URL   (falls back to SLACK_FEEDBACK_WEBHOOK_URL)
 *   Telegram  TELEGRAM_BOT_TOKEN + TELEGRAM_UPDATES_CHAT_ID (falls back to TELEGRAM_CHAT_ID)
 *   WhatsApp  WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_UPDATES_TO
 *             (Meta gate: business-initiated sends need an approved template; a plain text
 *              message only delivers inside a 24h customer-service window. Expect failures
 *              until a template is approved - the script reports Meta's answer honestly.)
 *
 * Flags: --dry-run (print the message + target channels, send nothing).
 * Dependency-free; loads .env.local/.env the same way scripts/doctor.mjs does.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DRY = process.argv.includes('--dry-run');
const REPO = 'https://github.com/BrysonW24/vai-lyra-stock-tracker';

function loadEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}
const env = { ...loadEnvFile(resolve('.env')), ...loadEnvFile(resolve('.env.local')), ...process.env };
const has = (k) => Boolean(env[k] && String(env[k]).trim());

// --- Parse RELEASES[0] (same approach as scripts/release.mjs) -----------------
const src = readFileSync('src/lib/version.ts', 'utf8');
const after = src.slice(src.indexOf('export const RELEASES'));
const unq = (s) => (s ?? '').replace(/\\'/g, "'");
const version = after.match(/\bversion:\s*'([^']+)'/)?.[1];
const date = after.match(/\bdate:\s*'([^']+)'/)?.[1];
const title = unq(after.match(/\btitle:\s*'((?:[^'\\]|\\.)*)'/)?.[1]);
const hlBlock = after.match(/highlights:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
const highlights = [...hlBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => unq(m[1]));

if (!version || !date) {
  console.error('announce: could not parse RELEASES[0] from src/lib/version.ts');
  process.exit(1);
}

const plain = [
  `Lyra v${version} shipped - ${title} (${date})`,
  '',
  ...highlights.map((h) => `- ${h}`),
  '',
  `Changelog: ${REPO}/blob/main/CHANGELOG.md`,
].join('\n');

const slackMrkdwn = [
  `:rocket: *Lyra v${version} shipped* - ${title} (${date})`,
  '',
  ...highlights.map((h) => `• ${h}`),
  '',
  `<${REPO}/blob/main/CHANGELOG.md|Full changelog>`,
].join('\n');

// --- Channels ------------------------------------------------------------------
const results = [];
const record = (channel, ok, detail = '') => {
  results.push({ channel, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${channel}${detail ? ` - ${detail}` : ''}`);
};

async function sendSlack() {
  const url = env.SLACK_UPDATES_WEBHOOK_URL || env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!url) return;
  if (DRY) return record('slack', true, 'dry-run (would send)');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slackMrkdwn }),
    });
    record('slack', res.ok, res.ok ? 'sent' : `HTTP ${res.status}: ${await res.text()}`);
  } catch (e) {
    record('slack', false, String(e));
  }
}

async function sendTelegram() {
  const chatId = env.TELEGRAM_UPDATES_CHAT_ID || env.TELEGRAM_CHAT_ID;
  if (!has('TELEGRAM_BOT_TOKEN') || !chatId) return;
  if (DRY) return record('telegram', true, 'dry-run (would send)');
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: plain, disable_web_page_preview: true }),
    });
    const data = await res.json().catch(() => ({}));
    record('telegram', res.ok && data.ok, res.ok && data.ok ? 'sent' : data.description || `HTTP ${res.status}`);
  } catch (e) {
    record('telegram', false, String(e));
  }
}

async function sendWhatsApp() {
  if (!has('WHATSAPP_ACCESS_TOKEN') || !has('WHATSAPP_PHONE_NUMBER_ID') || !has('WHATSAPP_UPDATES_TO')) return;
  if (DRY) return record('whatsapp', true, 'dry-run (would send)');
  try {
    const apiVersion = env.WHATSAPP_API_VERSION || 'v21.0';
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: env.WHATSAPP_UPDATES_TO,
          type: 'text',
          text: { preview_url: false, body: plain },
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    record(
      'whatsapp',
      res.ok,
      res.ok
        ? 'sent (delivers only inside a 24h session window - use an approved template for reliable business-initiated sends)'
        : data.error?.message || `HTTP ${res.status}`
    );
  } catch (e) {
    record('whatsapp', false, String(e));
  }
}

console.log(`announce: Lyra v${version} - "${title}" (${highlights.length} highlights)${DRY ? ' [dry-run]' : ''}\n`);
if (DRY) console.log(`${plain}\n`);

await Promise.all([sendSlack(), sendTelegram(), sendWhatsApp()]);

if (!results.length) {
  console.log('announce: no channel configured - set SLACK_UPDATES_WEBHOOK_URL (or the feedback webhook), TELEGRAM_BOT_TOKEN + chat id, or the WHATSAPP_* trio. Nothing sent.');
} else {
  const sent = results.filter((r) => r.ok).length;
  console.log(`\nannounce: ${sent}/${results.length} channel(s) ${DRY ? 'ready' : 'delivered'}.`);
  if (sent === 0) process.exit(1);
}
