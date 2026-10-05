#!/usr/bin/env node
/**
 * Static-routes gate. Run AFTER `next build`; reads the build's own prerender manifest.
 *
 * Why it exists: in v0.131.0 one line in the root layout read a cookie. The root layout wraps every
 * route, and reading a cookie makes a route dynamic - so every page that had been a prerendered
 * file served from the edge (privacy, terms, support, sign-up...) quietly became a function call
 * on every request. Nothing failed. Type-check, lint, 1,189 tests and the build were all green,
 * because none of them look at HOW a route is served. This looks at exactly that, in the artefact.
 *
 * These pages must stay static: App Store review opens the privacy and support URLs without an
 * account, crawlers and link previews hit them constantly, and none of them shows anything
 * per-visitor.
 *
 * Usage:  node scripts/check-static-routes.mjs      (honours NEXT_DIST_DIR, default .next)
 * Exit:   0 = every required route is prerendered, 1 = one is not, 2 = no build to inspect.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MUST_BE_STATIC = ['/privacy', '/terms', '/support', '/auth/signup'];

const distDir = process.env.NEXT_DIST_DIR || '.next';
const manifestPath = join(process.cwd(), distDir, 'prerender-manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`[static-routes] no build to inspect at ${distDir}/prerender-manifest.json - run \`npm run build\` first.`);
  process.exit(2);
}

const prerendered = new Set(Object.keys(JSON.parse(readFileSync(manifestPath, 'utf8')).routes ?? {}));
const lost = MUST_BE_STATIC.filter((route) => !prerendered.has(route));

if (lost.length) {
  console.error(`[static-routes] FAIL - ${lost.length} public page(s) are no longer prerendered: ${lost.join(', ')}`);
  console.error('  Each is now a function call on every request instead of a file served from the edge.');
  console.error('  The usual cause: a layout above it started reading cookies(), headers() or searchParams.');
  console.error('  Move that read into the component that needs it (see src/components/AppShell.tsx).');
  process.exit(1);
}
console.log(`[static-routes] ok - ${MUST_BE_STATIC.length} public pages are prerendered (${MUST_BE_STATIC.join(', ')}).`);
