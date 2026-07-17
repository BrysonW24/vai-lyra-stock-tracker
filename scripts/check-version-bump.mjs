#!/usr/bin/env node
/**
 * Pre-push guard: you cannot ship code without a version bump.
 *
 * If the commits being pushed change shippable code (src / supabase / workers / public) but the app
 * version (RELEASES[0].version in src/lib/version.ts) is unchanged vs origin/main, this BLOCKS the push
 * and tells you how to fix it. It also fails if package.json and version.ts have drifted apart, and if
 * the version MOVED but not UPWARD vs origin/main (two sessions share the version counter - see below).
 *
 * NOT shippable, and therefore not gated: test files (`__tests__/`, `tests/`, `*.test.ts`, `*.spec.ts`).
 * They never reach a user, so they cannot justify a user-facing changelog entry.
 *
 * The version compared is the one in the COMMITS BEING PUSHED (git show HEAD:...), not the working
 * tree - otherwise an unrelated uncommitted bump satisfies this hook while CI, which only sees the
 * commit, fails. The hook and CI must always agree.
 *
 * The fix: prepend a new entry to RELEASES in src/lib/version.ts, then run `npm run release`.
 * Escape hatch (rare - docs-only fixups, emergencies): VD_SKIP_VERSION=1 git push
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

if (process.env.VD_SKIP_VERSION === '1') {
  console.log('[version-guard] skipped (VD_SKIP_VERSION=1)');
  process.exit(0);
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const trySh = (cmd) => {
  try {
    return sh(cmd);
  } catch {
    return null;
  }
};

const fail = (lines) => {
  console.error('\n\x1b[31m[version-guard] push blocked\x1b[0m');
  for (const l of lines) console.error('  ' + l);
  console.error('');
  process.exit(1);
};

// First version: '...' that appears after `export const RELEASES` = RELEASES[0].version.
const versionFrom = (src) => src.match(/export const RELEASES[\s\S]*?\bversion:\s*'([^']+)'/)?.[1] ?? null;

// Numeric semver compare: negative if a < b, 0 if equal, positive if a > b.
const semverCmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

const localSrc = fs.readFileSync('src/lib/version.ts', 'utf8');
const localVersion = versionFrom(localSrc);
const pkgVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;

if (!localVersion) fail(['Could not read RELEASES[0].version from src/lib/version.ts.']);

// 1. version.ts and package.json must agree.
if (pkgVersion !== localVersion) {
  fail([
    `package.json version (${pkgVersion}) != version.ts (${localVersion}).`,
    'Run: npm run release   (syncs package.json + CHANGELOG to version.ts)',
  ]);
}

// 2. If shippable code changed vs origin/main, the version must have moved.
const remoteSrc = trySh('git show origin/main:src/lib/version.ts');
const changed = trySh('git diff --name-only origin/main...HEAD');
if (remoteSrc && changed !== null) {
  const remoteVersion = versionFrom(remoteSrc);
  // Judge the version in the COMMITS BEING PUSHED, not the working tree. Reading version.ts off disk
  // let an unrelated uncommitted bump (e.g. a concurrent release in progress) satisfy the hook while
  // CI - which only ever sees the commit - correctly failed. A gate that disagrees with CI is a gate
  // that lies, so fall back to the disk copy only when HEAD has no version.ts.
  const headSrc = trySh('git show HEAD:src/lib/version.ts');
  const pushedVersion = (headSrc && versionFrom(headSrc)) || localVersion;

  const shippable = changed
    .split('\n')
    .filter(Boolean)
    // content/ compiles into src/lib/generated at build time, sql/ is live setup material,
    // contracts/ is the notification wire contract, and the root config files change runtime
    // behavior - all of these previously shipped gate-free through the src-only regex.
    .filter(
      (f) =>
        /^(src|supabase|workers|public|content|sql|contracts)\//.test(f) ||
        /^(next\.config\.js|Dockerfile|vercel\.json)$/.test(f),
    )
    // Tests are NOT shippable: they never reach a user, so they cannot warrant a user-facing
    // changelog entry. Forcing a version bump for a test-only fix produces either a meaningless
    // release note or a VD_SKIP_VERSION bypass - both worse than simply not gating them.
    .filter((f) => !/(^|\/)(__tests__|tests)\//.test(f) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(f));

  if (shippable.length > 0 && remoteVersion && pushedVersion === remoteVersion) {
    fail([
      `You are pushing ${shippable.length} shippable change(s) but the version is still v${pushedVersion}.`,
      'Bump it: add a new entry at the top of RELEASES in src/lib/version.ts, then run `npm run release`.',
      'Changed: ' + shippable.slice(0, 6).join(', ') + (shippable.length > 6 ? ', ...' : ''),
      'Emergency bypass: VD_SKIP_VERSION=1 git push',
    ]);
  }

  // 3. A moved version must move UP. Two agent sessions sharing one tree share the version
  // counter with no lock: on 2026-07-17 a session prepended 0.43.1 while origin/main already
  // carried 0.44.0, so APP_VERSION (derived from RELEASES[0]) went BACKWARDS on a green push -
  // the landing badge, /whats-new, and the deploy-smoke floor all regressed. Presence checking
  // cannot see that; only comparing against origin/main's head can. Renumber ABOVE the remote
  // head (fetch first if this fires unexpectedly - the other session may have shipped).
  if (remoteVersion && pushedVersion !== remoteVersion && semverCmp(pushedVersion, remoteVersion) <= 0) {
    fail([
      `Version would move backwards: pushing v${pushedVersion} but origin/main already carries v${remoteVersion}.`,
      'A concurrent session has likely shipped ahead of you. Renumber your RELEASES entry ABOVE',
      `v${remoteVersion} in src/lib/version.ts, then run \`npm run release\` again.`,
      'Deliberate rollback (rare): VD_SKIP_VERSION=1 git push',
    ]);
  }
}

console.log(`[version-guard] ok - v${localVersion}`);
process.exit(0);
