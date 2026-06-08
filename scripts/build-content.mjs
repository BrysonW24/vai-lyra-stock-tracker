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
