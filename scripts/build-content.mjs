#!/usr/bin/env node
/**
 * Content pipeline - compiles the agent-editable JSONL in content/ into importable
 * JSON in src/lib/generated/, so the app (incl. client components, which cannot read
 * the filesystem at runtime) can import it directly.
 *
 * One JSONL file per content domain, one record per line. To update a fact (e.g. an
 * IPO reference price) an agent or human edits ONE line in content/<domain>.jsonl and
 * re-runs this (it also runs automatically via predev / prebuild).
 *
 *   npm run content:build
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const outDir = join(root, 'src', 'lib', 'generated');

if (!existsSync(contentDir)) {
  console.log('content: no content/ directory, nothing to build');
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });

const files = readdirSync(contentDir).filter((f) => f.endsWith('.jsonl')).sort();
let total = 0;

for (const file of files) {
  const domain = file.replace(/\.jsonl$/, '');
  const raw = readFileSync(join(contentDir, file), 'utf8');
  const records = [];
  raw.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return; // blank lines + // comments allowed
    try {
      records.push(JSON.parse(trimmed));
    } catch (err) {
      console.error(`content: ${file}:${i + 1} invalid JSON -> ${err.message}`);
      process.exit(1);
    }
  });
  writeFileSync(join(outDir, `${domain}.json`), `${JSON.stringify(records, null, 2)}\n`);
  console.log(`content: ${domain} -> ${records.length} records`);
  total += records.length;
}

// Manifest so an agent can discover every content domain in a single read.
writeFileSync(
  join(outDir, 'manifest.json'),
  `${JSON.stringify(files.map((f) => f.replace(/\.jsonl$/, '')), null, 2)}\n`,
);
console.log(`content: ${files.length} domain(s), ${total} record(s) compiled`);

// The Setup Companion is authored once in docs/onboarding/ and SERVED from public/. Regenerate
// the served copy here so the two can never drift - no manual `cp`, no stale in-app companion.
const companionSrc = join(root, 'docs', 'onboarding', 'setup-companion.html');
const companionOut = join(root, 'public', 'setup-companion.html');
if (existsSync(companionSrc)) {
  const html = readFileSync(companionSrc, 'utf8');
  if (!existsSync(companionOut) || readFileSync(companionOut, 'utf8') !== html) {
    writeFileSync(companionOut, html);
    console.log('companion: public/setup-companion.html synced from docs/onboarding/');
  } else {
    console.log('companion: public copy already in sync');
  }
}

// The knowledge pipeline rides the same hook (predev / prebuild / pretype-check), so the
// retrievable-docs layer can never go stale relative to the docs on disk.
await import('./build-knowledge.mjs');

// The nervous-system map (public/harness-map.html + src/lib/generated/harness-map.json) is
// generated from SKILL-CHAIN.md + HARNESS.md on the same hook, so the rails view can never
// drift from the rails themselves.
await import('./build-harness-map.mjs');

// The "features per build" table in README.md is generated from the SAME source of truth as
// the version badge and CHANGELOG (src/lib/version.ts RELEASES), between BUILD-HISTORY markers.
// A hand-pasted list would rot on the next release; this cannot - it refreshes on every
// predev / prebuild / pretype-check alongside the changelog it summarises.
{
  const verSrc = readFileSync(join(root, 'src', 'lib', 'version.ts'), 'utf8');
  const rels = [...verSrc.matchAll(/version:\s*'([^']+)',\s*\n\s*date:\s*'([^']+)',\s*\n\s*title:\s*'((?:[^'\\]|\\.)*)'/g)]
    .map(([, v, d, t]) => ({ v, d, t: t.replace(/\\'/g, "'") }));
  const rows = [
    'BUILD    DATE        FEATURE THEME',
    '-------  ----------  ' + '-'.repeat(70),
    ...rels.map((r) => `${r.v.padEnd(7)}  ${r.d}  ${r.t}`),
    '',
    `(${rels.length} builds - full per-build highlights in CHANGELOG.md and in-app /whats-new)`,
  ];
  const block = [
    '<!-- BUILD-HISTORY:START (generated from src/lib/version.ts by scripts/build-content.mjs - do not edit by hand) -->',
    '```text',
    ...rows,
    '```',
    '<!-- BUILD-HISTORY:END -->',
  ].join('\n');
  const readmePath = join(root, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const re = /<!-- BUILD-HISTORY:START[\s\S]*?<!-- BUILD-HISTORY:END -->/;
  if (!re.test(readme)) {
    console.log('build-history: BUILD-HISTORY markers not found in README.md - skipped');
  } else {
    const next = readme.replace(re, block);
    if (next !== readme) {
      writeFileSync(readmePath, next);
      console.log(`build-history: README.md updated (${rels.length} builds)`);
    } else {
      console.log('build-history: README.md already in sync');
    }
  }
}
