#!/usr/bin/env node
/**
 * Post-deploy smoke gate - closes the loop between "CI green" and "users see it working".
 *
 * CI proves the build; nothing used to prove the DEPLOYMENT. Six live-only bugs shipped
 * while thousands of fixtures stayed green - this script is the answer: after a push to
 * main, poll the live site until it serves the version this commit carries, then probe
 * the public surfaces for real content and the middleware for liveness.
 *
 * Checks:
 *   1. /api/health returns ok:true and version >= the version in this checkout's
 *      package.json (>= because a later push may have superseded this one - a NEWER live
 *      version is success, a STALE one after the timeout is the failure this exists for).
 *   2. /welcome renders 200 with real branded content (not an error shell).
 *   3. /privacy renders 200.
 *   4. A gated app page redirects (301/302/307/308) instead of crashing - middleware alive.
 *
 * Usage: APP_BASE_URL=https://... node scripts/check-deploy-health.mjs
 *   --timeout <seconds>   how long to wait for the deploy to land (default 600)
 *   --interval <seconds>  poll interval (default 15)
 * Exit 0 = deployment verified. Exit 1 = deployment failed verification.
 */

import { readFileSync } from 'node:fs';

const BASE = (process.env.APP_BASE_URL || 'https://vai-lyra-stock-tracker.vercel.app').replace(/\/$/, '');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}
const TIMEOUT_S = arg('timeout', 600);
const INTERVAL_S = arg('interval', 15);

const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

function cmpSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

async function get(path, { redirect = 'follow' } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect,
    headers: { 'User-Agent': 'LyraDeploySmoke/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  return res;
}

async function waitForVersion() {
  const deadline = Date.now() + TIMEOUT_S * 1000;
  let lastSeen = 'unreachable';
  while (Date.now() < deadline) {
    try {
      const res = await get('/api/health');
      if (res.ok) {
        const body = await res.json();
        lastSeen = body.version ?? 'missing';
        if (body.ok === true && typeof body.version === 'string' && cmpSemver(body.version, expected) >= 0) {
          return body;
        }
      }
    } catch {
      lastSeen = 'unreachable';
    }
    process.stdout.write(`  waiting for v${expected} (live: ${lastSeen})...\n`);
    await new Promise((r) => setTimeout(r, INTERVAL_S * 1000));
  }
  throw new Error(`deploy never served v${expected} within ${TIMEOUT_S}s (last seen: ${lastSeen})`);
}

const failures = [];
const pass = (msg) => process.stdout.write(`  ok - ${msg}\n`);
const fail = (msg) => {
  failures.push(msg);
  process.stdout.write(`  FAIL - ${msg}\n`);
};

process.stdout.write(`deploy-smoke: verifying ${BASE} serves v${expected}\n`);

try {
  const health = await waitForVersion();
  pass(`/api/health ok:true, version ${health.version} (expected >= ${expected}), mode ${health.mode ?? '?'}`);
} catch (err) {
  fail(String(err.message ?? err));
}

if (failures.length === 0) {
  // Only probe pages once the right build is live - probing a stale build proves nothing.
  try {
    const res = await get('/welcome');
    const html = await res.text();
    if (!res.ok) fail(`/welcome returned ${res.status}`);
    else if (!html.includes('Lyra')) fail('/welcome served 200 but without branded content');
    else pass(`/welcome 200 with content (${Math.round(html.length / 1024)}KB)`);
  } catch (err) {
    fail(`/welcome unreachable: ${err.message}`);
  }

  try {
    const res = await get('/privacy');
    if (!res.ok) fail(`/privacy returned ${res.status}`);
    else pass('/privacy 200');
  } catch (err) {
    fail(`/privacy unreachable: ${err.message}`);
  }

  try {
    const res = await get('/small-caps', { redirect: 'manual' });
    if ([301, 302, 307, 308].includes(res.status)) pass(`gated page redirects (${res.status}) - middleware alive`);
    else if (res.status === 200) pass('gated page served 200 (session present or public policy) - not a crash');
    else fail(`gated page returned ${res.status} - middleware may be crashing`);
  } catch (err) {
    fail(`gated-page probe unreachable: ${err.message}`);
  }
}

if (failures.length > 0) {
  process.stdout.write(`\ndeploy-smoke FAIL - ${failures.length} problem(s) on ${BASE}\n`);
  process.exit(1);
}
process.stdout.write(`\ndeploy-smoke OK - ${BASE} is serving v${expected}+ and its surfaces respond\n`);
