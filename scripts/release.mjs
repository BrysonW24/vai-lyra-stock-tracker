#!/usr/bin/env node
/**
 * `npm run release` - cut a release from src/lib/version.ts (the single source of truth).
 *
 * You bump the version by adding a new entry at the TOP of RELEASES in src/lib/version.ts. This script
 * then propagates that newest entry everywhere else, idempotently:
 *   - package.json "version"  -> RELEASES[0].version
 *   - CHANGELOG.md            -> inserts a `## [version] - date` section (title + highlights) under
 *                                [Unreleased], and fixes the compare links.
 * Re-running is safe: if CHANGELOG already has the section, it is left alone.
 */
import fs from 'node:fs';

const REPO = 'https://github.com/BrysonW24/vai-lyra-stock-tracker';

const src = fs.readFileSync('src/lib/version.ts', 'utf8');
const after = src.slice(src.indexOf('export const RELEASES'));
const unq = (s) => (s ?? '').replace(/\\'/g, "'");

const version = after.match(/\bversion:\s*'([^']+)'/)?.[1];
const date = after.match(/\bdate:\s*'([^']+)'/)?.[1];
const title = unq(after.match(/\btitle:\s*'((?:[^'\\]|\\.)*)'/)?.[1]);
const hlBlock = after.match(/highlights:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
const highlights = [...hlBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => unq(m[1]));
// The previous release (RELEASES[1].version) - the compare base for the changelog link.
const prevVersion = [...after.matchAll(/\bversion:\s*'([^']+)'/g)][1]?.[1];

if (!version || !date) {
  console.error('release: could not parse RELEASES[0] {version,date} from src/lib/version.ts');
  process.exit(1);
}

// 1. package.json
const pkgRaw = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(pkgRaw);
if (pkg.version !== version) {
  fs.writeFileSync('package.json', pkgRaw.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
  console.log(`release: package.json ${pkg.version} -> ${version}`);
} else {
  console.log(`release: package.json already ${version}`);
}

// 2. CHANGELOG.md
let cl = fs.readFileSync('CHANGELOG.md', 'utf8');
if (cl.includes(`## [${version}]`)) {
  console.log(`release: CHANGELOG already has [${version}]`);
} else {
  const section =
    `## [${version}] - ${date}\n\n` +
    (title ? `${title}.\n\n` : '') +
    '### Changed\n\n' +
    highlights.map((h) => `- ${h}`).join('\n') +
    '\n\n';
  cl = cl.replace(/## \[Unreleased\]\n\n/, `## [Unreleased]\n\n${section}`);

  // Compare links at the bottom (idempotent-ish: only add the version line if missing).
  cl = cl.replace(
    /\[Unreleased\]:\s*\S+/,
    `[Unreleased]: ${REPO}/compare/v${version}...HEAD`,
  );
  if (prevVersion && !cl.includes(`\n[${version}]:`)) {
    cl = cl.replace(
      /(\[Unreleased\]:.*\n)/,
      `$1[${version}]: ${REPO}/compare/v${prevVersion}...v${version}\n`,
    );
  }
  fs.writeFileSync('CHANGELOG.md', cl);
  console.log(`release: CHANGELOG += [${version}] - ${date} (${highlights.length} highlights)`);
}

console.log(`\nrelease: v${version} ready. Review the diff, then commit + push.`);
