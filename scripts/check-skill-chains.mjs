#!/usr/bin/env node
// check-skill-chains.mjs - deterministic gate: every code section has an owning skill chain.
//
// Parses the coverage map in SKILL-CHAIN.md (between the chain-coverage markers) and fails if:
//   1. a mapped path does not exist on disk (dead row),
//   2. a named owning chain has no .claude/commands/<chain>.md file,
//   3. a .claude/commands/*.md file is never mentioned in SKILL-CHAIN.md (orphan chain),
//   4. an enumerated code section is not claimed by any row (unowned section),
//   5. package.json lost the check:chains script.
//
// Convention (HARNESS.md): .claude/commands/*.md are the skill chains,
// scripts/check-*.mjs are the deterministic gates. Exit non-zero on drift, no judgement calls.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const failures = [];

// --- 0. The registry itself ---------------------------------------------------------
if (!exists('SKILL-CHAIN.md')) {
  console.error('check:chains FAIL - SKILL-CHAIN.md is missing');
  process.exit(1);
}
if (!exists('HARNESS.md')) failures.push('HARNESS.md is missing (the harness front door)');

const registry = read('SKILL-CHAIN.md');
const block = registry.split('<!-- chain-coverage:begin -->')[1]?.split('<!-- chain-coverage:end -->')[0];
if (!block) {
  console.error('check:chains FAIL - chain-coverage markers not found in SKILL-CHAIN.md');
  process.exit(1);
}

// --- 1. Parse the coverage table ----------------------------------------------------
const rows = [];
for (const line of block.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  // | Section | Paths | Owning chains | -> ['', section, paths, chains, '']
  if (cells.length < 5 || cells[1] === 'Section' || /^-+$/.test(cells[1].replace(/\s/g, '-'))) continue;
  const paths = [...cells[2].matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\/$/, ''));
  const chains = cells[3].split(',').map((c) => c.trim()).filter(Boolean);
  if (paths.length && chains.length) rows.push({ section: cells[1], paths, chains });
}
if (!rows.length) {
  console.error('check:chains FAIL - coverage table parsed to zero rows');
  process.exit(1);
}

// --- 2. Mapped paths must exist; named chains must exist -----------------------------
const mappedPaths = new Set();
const namedChains = new Set();
for (const row of rows) {
  for (const p of row.paths) {
    mappedPaths.add(p);
    if (!exists(p)) failures.push(`dead path in map ("${row.section}"): ${p}`);
  }
  for (const c of row.chains) {
    namedChains.add(c);
    if (!exists(`.claude/commands/${c}.md`)) failures.push(`chain named in map but missing on disk: ${c}`);
  }
}

// --- 3. No orphan chain files --------------------------------------------------------
const chainFiles = fs.readdirSync(path.join(root, '.claude/commands')).filter((f) => f.endsWith('.md'));
for (const f of chainFiles) {
  if (!registry.includes(f.replace(/\.md$/, ''))) {
    failures.push(`orphan chain file (never mentioned in SKILL-CHAIN.md): .claude/commands/${f}`);
  }
}

// --- 4. Every code section is claimed ------------------------------------------------
const covered = (section) => {
  const s = section.replace(/\/$/, '');
  for (const p of mappedPaths) {
    if (s === p || s.startsWith(`${p}/`)) return true;
  }
  return false;
};

const listChildren = (dir, { dirsOnly = false, skip = [] } = {}) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.') && e.name !== '__pycache__' && !skip.includes(e.name))
    .filter((e) => (dirsOnly ? e.isDirectory() : true))
    .map((e) => `${dir}/${e.name}`);
};

const sections = [
  ...listChildren('src/lib'),
  ...listChildren('src/app', { dirsOnly: true, skip: ['api'] }),
  ...listChildren('src/app/api', { dirsOnly: true }),
  ...listChildren('src/components'),
  ...listChildren('workers', { dirsOnly: true }),
  'scripts', 'tests', 'contracts', 'supabase', 'sql', 'docs', 'public', 'content',
  '.githooks', '.github', '.claude/commands',
].filter((s) => exists(s));

const unowned = sections.filter((s) => !covered(s));
for (const s of unowned) failures.push(`unowned section (no skill chain claims it): ${s}`);

// --- 5. The gate is wired ------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['check:chains']) failures.push('package.json lost the check:chains script');

// --- Report --------------------------------------------------------------------------
if (failures.length) {
  console.error(`check:chains FAIL - ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nFix: assign every section a chain in SKILL-CHAIN.md (coverage map), or author');
  console.error('a new chain in .claude/commands/ per the contract in SKILL-CHAIN.md.');
  process.exit(1);
}

console.log(
  `check:chains OK - ${sections.length} sections covered by ${namedChains.size} chains ` +
  `(${rows.length} map rows, ${chainFiles.length} chain files, 0 orphans)`
);
