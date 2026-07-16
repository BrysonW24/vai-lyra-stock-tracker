#!/usr/bin/env node
/**
 * Onboarding parity gate: keeps the THREE onboarding surfaces in lockstep with the codebase.
 *
 *   human  -> docs/walkthroughs/ + QUICKSTART.md + ONBOARDING.md (the asset ledger)
 *   html   -> docs/onboarding/setup-companion.html (+ its served copy public/setup-companion.html)
 *   agent  -> AGENT-ONBOARDING.md
 *
 * These drift silently the moment the stack, costs, routes, walkthroughs, or logos change. This
 * script catches the STRUCTURAL drift deterministically (no model, runs in CI); the semantic
 * updates are done by the `/onboarding-parity` skill chain, which runs this at the end to prove it.
 *
 * Usage:  node scripts/check-onboarding-parity.mjs [--json]
 * Exit:   0 = in parity, 1 = drift (details printed), 2 = a checked file is missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');
const rel = (p) => path.relative(root, p);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const problems = [];
const drift = (surface, message) => problems.push({ surface, message });

const COMPANION = 'docs/onboarding/setup-companion.html';
const PUBLIC_COMPANION = 'public/setup-companion.html';
const LEDGER = 'ONBOARDING.md';
const AGENT_DOC = 'AGENT-ONBOARDING.md';

// A checked file being absent is a hard error, not drift - fail distinctly so a rename is obvious.
for (const f of [COMPANION, PUBLIC_COMPANION, LEDGER, AGENT_DOC]) {
  if (!exists(f)) {
    if (!jsonMode) console.error(`onboarding-parity: MISSING ${f} - a surface was moved or deleted.`);
    process.exit(2);
  }
}

// --- A. The companion and its served copy must be byte-identical -----------------------------
// (build-content regenerates the public copy, so this should only ever fire on a stale commit.)
if (read(COMPANION) !== read(PUBLIC_COMPANION)) {
  drift('html', `${PUBLIC_COMPANION} is out of sync with ${COMPANION} - run \`npm run content:build\` (it regenerates the served copy) and commit.`);
}

// --- B. Every logo the landing sections reference must exist on disk --------------------------
const landingSrc = ['src/components/landing/StackSection.tsx', 'src/components/landing/UltimateGoals.tsx']
  .filter(exists)
  .map(read)
  .join('\n');
const logoRefs = [...new Set([...landingSrc.matchAll(/\/logos\/([a-z0-9-]+\.(?:svg|png))/g)].map((m) => m[1]))];
for (const logo of logoRefs) {
  if (!exists(`public/logos/${logo}`)) {
    drift('html', `landing references /logos/${logo} but public/logos/${logo} does not exist - export it or fix the path.`);
  }
}

// --- C. The stack "story" must match between the companion and the landing StackSection -------
// If someone adds/removes a technology in one surface, the other must follow, or the two pages
// tell buyers different things about what is in the build.
const companion = read(COMPANION);
const companionTiles = new Set(
  [...companion.matchAll(/<div class="tech"><div class="tech-head">.*?<h3>([^<]+)<\/h3>/g)].map((m) => m[1].trim()),
);
if (exists('src/components/landing/StackSection.tsx')) {
  const stackSrc = read('src/components/landing/StackSection.tsx');
  const landingTiles = new Set([...stackSrc.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1].trim()));
  diffSets('html', 'stack tile', companionTiles, landingTiles, COMPANION, 'src/components/landing/StackSection.tsx');
}

// --- D. The six "ultimate goal" cards must match between the companion and the landing --------
const companionGoals = new Set(
  [...companion.matchAll(/<h3><span class="gnum">\d<\/span>\s*([^<]+)<\/h3>/g)].map((m) => m[1].trim()),
);
if (exists('src/components/landing/UltimateGoals.tsx')) {
  const goalsSrc = read('src/components/landing/UltimateGoals.tsx');
  const landingGoals = new Set([...goalsSrc.matchAll(/title:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'").trim()));
  diffSets('html', 'goal card', companionGoals, landingGoals, COMPANION, 'src/components/landing/UltimateGoals.tsx');
}

// --- E. Every repo-relative path the agent/human ledgers point at must resolve ----------------
for (const doc of [LEDGER, AGENT_DOC]) {
  for (const target of markdownLinkTargets(read(doc))) {
    if (!exists(target)) drift(doc === AGENT_DOC ? 'agent' : 'human', `${doc} links to ${target}, which does not exist on disk.`);
  }
}

// --- F. The walkthrough count must be coherent across the docs that cite it -------------------
const walkthroughFiles = fs
  .readdirSync(path.join(root, 'docs/walkthroughs'))
  .filter((f) => /^\d\d-.*\.md$/.test(f)).length;
for (const doc of [LEDGER, 'CLAUDE.md']) {
  if (!exists(doc)) continue;
  const m = read(doc).match(/(\d+)\s+walkthroughs/i);
  if (m && Number(m[1]) !== walkthroughFiles) {
    drift('human', `${doc} says "${m[1]} walkthroughs" but docs/walkthroughs/ has ${walkthroughFiles} numbered files.`);
  }
}

// --- G. The onboarding docs must be in the knowledge corpus so the in-app AI can cite them ----
if (exists('scripts/build-knowledge.mjs')) {
  const sources = read('scripts/build-knowledge.mjs');
  for (const doc of [LEDGER, AGENT_DOC]) {
    if (!sources.includes(`'${doc}'`)) {
      drift('agent', `${doc} is not in SOURCES in scripts/build-knowledge.mjs - the in-app AI cannot answer onboarding questions from it.`);
    }
  }
}

// --------------------------------------------------------------------------------------------
function diffSets(surface, label, a, b, aName, bName) {
  for (const x of a) if (!b.has(x)) drift(surface, `${label} "${x}" is in ${rel(path.join(root, aName))} but missing from ${bName}.`);
  for (const x of b) if (!a.has(x)) drift(surface, `${label} "${x}" is in ${bName} but missing from ${rel(path.join(root, aName))}.`);
}

/** Repo-relative link targets from markdown - skips URLs, anchors, and mailto. */
function markdownLinkTargets(md) {
  const out = new Set();
  for (const m of md.matchAll(/\]\(([^)]+)\)/g)) {
    let t = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(t)) continue;
    t = t.split('#')[0].split(' ')[0]; // drop anchor + link title
    if (!t || t.startsWith('<')) continue;
    out.add(t.replace(/\/$/, ''));
  }
  return [...out];
}

// --- Report ----------------------------------------------------------------------------------
if (jsonMode) {
  console.log(JSON.stringify({ ok: problems.length === 0, walkthroughs: walkthroughFiles, problems }, null, 2));
} else if (problems.length === 0) {
  console.log(`[onboarding-parity] ok - human + html + agent surfaces are in sync (${walkthroughFiles} walkthroughs, ${companionTiles.size} stack tiles).`);
} else {
  console.error(`\n\x1b[31m[onboarding-parity] ${problems.length} drift issue(s)\x1b[0m`);
  for (const p of problems) console.error(`  [${p.surface}] ${p.message}`);
  console.error('\nFix: run the /onboarding-parity skill chain, or update the surface named above, then re-run `npm run check:onboarding`.');
}
process.exit(problems.length === 0 ? 0 : 1);
