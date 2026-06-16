#!/usr/bin/env node
/**
 * Lyra setup doctor - checks your environment and tells you exactly what's
 * configured, what's missing, and which mode you're in. Dependency-free.
 *
 *   node scripts/doctor.mjs      (or:  npm run doctor)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const bad = (m) => console.log(`${RED}✗${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}•${RESET} ${m}`);

// Load .env.local then .env (without overriding real process.env).
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

const root = process.cwd();
const env = {
  ...loadEnvFile(resolve(root, '.env')),
  ...loadEnvFile(resolve(root, '.env.local')),
  ...process.env,
};
const has = (k) => Boolean(env[k] && String(env[k]).trim());

console.log(`\n${BOLD}Lyra setup doctor${RESET}\n`);

// 1. Runtime
const major = Number(process.versions.node.split('.')[0]);
if (major >= 18) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node} - Next 15 needs Node 18+`);

// 2. Frontend Supabase (read-only)
const feSupabase = has('NEXT_PUBLIC_SUPABASE_URL') && has('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (feSupabase) ok('Frontend Supabase keys present (NEXT_PUBLIC_*)');
else warn('Frontend Supabase not set - dashboard runs on demo data');

// 3. Worker Supabase (server-only)
const beSupabase = has('SUPABASE_URL') && has('SUPABASE_SERVICE_ROLE_KEY');
if (beSupabase) ok('Worker Supabase secrets present');
else warn('Worker Supabase not set - the scanner cannot persist results');

// 3a. Safety: secret must not be public
if (has('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')) {
  bad('SECURITY: service-role key is exposed via NEXT_PUBLIC_* - move it server-side! (see SECURITY.md)');
}

// 4. Telegram
if (has('TELEGRAM_BOT_TOKEN')) {
  const valid = /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN);
  if (valid) ok('Telegram bot token looks well-formed');
  else bad('TELEGRAM_BOT_TOKEN is set but does not look like a valid token');
  if (!has('TELEGRAM_CHAT_ID')) warn('TELEGRAM_CHAT_ID missing - run the pairing flow (TELEGRAM_SETUP.md)');
} else {
  warn('Telegram not configured - alerts are off (optional)');
}

// 5. Market data
ok(`Market data provider: ${env.MARKET_DATA_PROVIDER || 'yfinance (default)'}`);

// 6. Optional layers
if (has('FINNHUB_API_KEY')) ok('Finnhub key present - Horizon-2 news/fundamentals can go live');
else warn('No Finnhub key - news/fundamentals/calendar use demo data (optional)');

if (has('OPENAI_API_KEY')) ok(`Hosted OpenAI beta configured (${env.LYRA_HOSTED_OPENAI_MODEL || 'gpt-5.5'})`);
else warn('Hosted OpenAI beta not configured - keyless users cannot chat until OPENAI_API_KEY is set server-side');

if (has('GOOGLE_AI_KEY')) ok('Shared Google AI fallback configured');
else warn('No shared Google fallback (optional)');

if (has('ANTHROPIC_API_KEY') && /^true$/i.test(env.ENABLE_AI_EXPLANATIONS || '')) ok('Legacy worker AI explanations enabled (Anthropic key + ENABLE_AI_EXPLANATIONS=true)');
else warn('Legacy worker AI explanations off (optional)');

// 7. Optional live Supabase reachability
async function pingSupabase() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  if (!url) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) ok('Supabase URL reachable');
    else warn(`Supabase URL responded ${res.status}`);
  } catch {
    warn('Could not reach Supabase URL (network, or not set)');
  }
}

// Mode summary
function summary() {
  let mode = 'Demo mode (no keys) - exploring the UI on demo data';
  if (feSupabase && beSupabase) mode = 'Live mode - real scanning enabled';
  if (feSupabase && beSupabase && has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_CHAT_ID')) mode += ' + Telegram alerts';
  if (has('OPENAI_API_KEY')) mode += ' + hosted OpenAI';
  if (has('ANTHROPIC_API_KEY') && /^true$/i.test(env.ENABLE_AI_EXPLANATIONS || '')) mode += ' + legacy worker AI';
  console.log(`\n${BOLD}Mode:${RESET} ${mode}`);
  console.log(`${DIM}Run "npm run dev -- -p 3042" and open http://localhost:3042${RESET}\n`);
}

await pingSupabase();
summary();
