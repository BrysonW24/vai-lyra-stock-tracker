#!/usr/bin/env node
/**
 * (Re)register Lyra's Telegram webhook: npm run telegram:webhook [-- --check]
 *
 * Points the app bot (TELEGRAM_BOT_TOKEN) at <base>/api/webhooks/telegram with the
 * TELEGRAM_WEBHOOK_SECRET header and the update types the webhook handles. Those types come from
 * contracts/feedback/telegram-feedback.json (allowed_updates) - the same file the webhook's feedback
 * buttons are built from - so adding a kind of update in one place cannot leave Telegram filtering
 * it out in the other. v0.137.0 added "callback_query" (the 👍 / 👎 buttons); until this runs,
 * Telegram drops every button tap.
 *
 * Reads the token and the secret from the environment, or from .env.local when present. Prints the
 * bot's username, the URL, the allowed updates and Telegram's pending count - never the token or
 * the secret. --check reads the current registration without changing it.
 *
 * Base URL: TELEGRAM_WEBHOOK_BASE_URL, else production (https://lyra.vivacityai.com.au).
 */
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const envFile = new URL('.env.local', root);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.env.TELEGRAM_WEBHOOK_BASE_URL || 'https://lyra.vivacityai.com.au').replace(/\/$/, '');
const contract = JSON.parse(readFileSync(new URL('contracts/feedback/telegram-feedback.json', root), 'utf8'));
const allowedUpdates = contract.allowed_updates;
const checkOnly = process.argv.includes('--check');

if (!token) {
  console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN is not set.');
  process.exit(2);
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`${method} failed: HTTP ${res.status} ${String(data.description || '').slice(0, 120)}`);
  return data.result;
}

try {
  const me = await call('getMe');
  if (!checkOnly) {
    if (!secret) {
      console.error('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET is not set - refusing to register a webhook anyone could post to.');
      process.exit(2);
    }
    await call('setWebhook', { url: `${base}/api/webhooks/telegram`, secret_token: secret, allowed_updates: allowedUpdates });
  }
  const info = await call('getWebhookInfo');
  if (!info.url) {
    console.error('[telegram-webhook] NO WEBHOOK is registered - run without --check to register it.');
    process.exit(1);
  }
  // No allowed_updates on the registration means Telegram's default set, which includes both kinds.
  const missing = info.allowed_updates ? allowedUpdates.filter((kind) => !info.allowed_updates.includes(kind)) : [];
  console.log(`[telegram-webhook] @${me.username} -> ${info.url || '(no webhook)'}`);
  console.log(`[telegram-webhook] allowed updates: ${(info.allowed_updates || []).join(', ') || '(all)'}; pending: ${info.pending_update_count ?? 0}`);
  if (info.last_error_message) console.log(`[telegram-webhook] last error: ${String(info.last_error_message).slice(0, 160)}`);
  if (missing.length) {
    console.error(`[telegram-webhook] MISSING: ${missing.join(', ')} - run without --check to register them.`);
    process.exit(1);
  }
} catch (err) {
  console.error(`[telegram-webhook] ${err instanceof Error ? err.message.replaceAll(token, '[token]') : 'failed'}`);
  process.exit(1);
}
