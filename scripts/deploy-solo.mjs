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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DOMAIN = process.env.SOLO_DOMAIN || 'solo.lyra.vivacityai.com.au';
const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

function vercel(args) {
  return execFileSync('npx', ['vercel', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

console.log(`[deploy-solo] building a preview deployment of v${expected} ...`);
// NEXT_PUBLIC_* is inlined at build time, so the flag has to be a build variable too.
const output = vercel([
  'deploy', '--yes',
  '--build-env', 'NEXT_PUBLIC_SOLO_UPGRADE_CTA=1',
  '--env', 'NEXT_PUBLIC_SOLO_UPGRADE_CTA=1',
]);
const url = output.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('https://')).pop();
if (!url) {
  console.error('[deploy-solo] FAIL - could not read the deployment URL from the Vercel CLI output.');
  process.exit(1);
}
console.log(`[deploy-solo] built ${url} - pointing ${DOMAIN} at it ...`);
vercel(['alias', 'set', url, DOMAIN]);

const health = await (await fetch(`https://${DOMAIN}/api/health`, { cache: 'no-store' })).json();
const trades = await (await fetch(`https://${DOMAIN}/api/trades`, { cache: 'no-store' })).json().catch(() => ({}));

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
