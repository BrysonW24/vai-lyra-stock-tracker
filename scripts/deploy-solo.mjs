#!/usr/bin/env node
/**
 * Deploy Lyra Solo - the no-account, bring-your-own-key site.
 *
 * Solo is not a fork: it is this same code built with NO Supabase environment in scope, which is
 * what the Vercel Preview environment of this project provides. So "deploy Solo" is: build a
 * preview deployment of the current tree, point the Solo domain at it, and PROVE it came up in
 * Solo mode at the version just released.
 *
 * Why a script: the Vercel project is deliberately not connected to git (deploys are manual), so
 * pushing the `solo` branch deploys nothing. Until this existed there was no Solo step in the
 * release ritual at all, and Solo sat a full release behind production for a month without
 * anything noticing. Run this after every production deploy:
 *
 *   npx vercel --prod --yes && npm run deploy:solo
 *
 * The proof matters as much as the deploy. If the Preview environment ever gains Supabase
 * variables, this build would silently become an accounted site on the Solo domain - so the script
 * fails unless /api/health reports the demo/no-database mode and /api/trades answers as Solo does.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DOMAIN = process.env.SOLO_DOMAIN || 'solo.lyra.vivacityai.com.au';
const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Run the Vercel CLI, show its output, and hand back everything it printed (both streams). */
function vercel(args) {
  const result = spawnSync('npx', ['vercel', ...args], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  process.stdout.write(output.trim() ? `${output.trim()}\n` : '');
  if (result.status !== 0) {
    console.error(`[deploy-solo] FAIL - \`vercel ${args.join(' ')}\` exited ${result.status}.`);
    process.exit(1);
  }
  return output;
}

// `--url <deployment>` points the Solo domain at a preview that is already built (a retry, or a
// preview you want to promote) instead of building a new one.
const urlFlag = process.argv.indexOf('--url');
let url = urlFlag > -1 ? process.argv[urlFlag + 1] : null;

if (!url) {
  console.log(`[deploy-solo] building a preview deployment of v${expected} ...`);
  // NEXT_PUBLIC_* is inlined at build time, so the flag has to be a build variable too.
  const output = vercel([
    'deploy', '--yes',
    '--build-env', 'NEXT_PUBLIC_SOLO_UPGRADE_CTA=1',
    '--env', 'NEXT_PUBLIC_SOLO_UPGRADE_CTA=1',
  ]);
  // The CLI reports the deployment differently by mode (a bare URL, a "Preview https://..." line,
  // or JSON with no scheme), so match the hostname itself and take the last one it printed.
  const hosts = output.match(/[a-z0-9][a-z0-9-]*\.vercel\.app/g) ?? [];
  url = hosts.length ? `https://${hosts[hosts.length - 1]}` : null;
}
if (!url) {
  console.error('[deploy-solo] FAIL - could not read the deployment URL from the Vercel CLI output.');
  process.exit(1);
}
if (!url.startsWith('https://')) url = `https://${url}`;
console.log(`[deploy-solo] pointing ${DOMAIN} at ${url} ...`);
vercel(['alias', 'set', url, DOMAIN]);

// A domain that has just been re-pointed can refuse or stall for a little while (edge
// propagation plus a cold start - 20 seconds has been observed). Ask patiently before judging.
async function getJson(path) {
  let lastError = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await fetch(`https://${DOMAIN}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 6_000));
    }
  }
  console.error(`[deploy-solo] FAIL - ${DOMAIN}${path} did not answer after 10 attempts: ${String(lastError?.cause?.message ?? lastError?.message ?? lastError)}`);
  process.exit(1);
}

const health = await getJson('/api/health');
const trades = await getJson('/api/trades');

const problems = [];
if (health.version !== expected) problems.push(`version is ${health.version}, expected ${expected}`);
if (health.mode !== 'demo') problems.push(`mode is "${health.mode}" - the Preview environment has database variables in scope, so this is NOT Solo`);
if (!(trades.ok === true && trades.demo === true)) problems.push('/api/trades did not answer as Solo does ({ok:true, demo:true})');

if (problems.length) {
  console.error(`[deploy-solo] FAIL - ${DOMAIN} is live but wrong:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`[deploy-solo] ok - ${DOMAIN} serves v${health.version} in Solo mode.`);
