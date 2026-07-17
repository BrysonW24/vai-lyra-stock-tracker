#!/usr/bin/env node
/**
 * check-ledgers.mjs - the repo's learning ledgers must stay machine-readable.
 *
 * Two JSONL ledgers accumulate agent-facing learnings versioned WITH the code:
 *   - harness-incidents.jsonl  - every incident that earned a gate (grep it BEFORE
 *     debugging a familiar failure)
 *   - .claude/content-rules.jsonl - rules learned by adversarial verifiers in content
 *     workflows (seed author + verifier prompts from it)
 *
 * A ledger that stops parsing stops teaching, silently - so this gate fails on: invalid
 * JSON lines, missing required fields, duplicate ids, or a non-ISO date. Runs in CI.
 */
import fs from 'node:fs';

const LEDGERS = [
  { path: 'harness-incidents.jsonl', required: ['id', 'date', 'gate', 'cls', 'symptom', 'rootCause', 'fix', 'lesson'] },
  { path: '.claude/content-rules.jsonl', required: ['id', 'date', 'scope', 'rule', 'learnedFrom'] },
];

const problems = [];
let total = 0;

for (const ledger of LEDGERS) {
  if (!fs.existsSync(ledger.path)) {
    problems.push(`${ledger.path}: missing`);
    continue;
  }
  const seen = new Set();
  const lines = fs.readFileSync(ledger.path, 'utf8').split('\n').filter((l) => l.trim());
  lines.forEach((line, i) => {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      problems.push(`${ledger.path}:${i + 1}: invalid JSON`);
      return;
    }
    for (const field of ledger.required) {
      if (typeof row[field] !== 'string' || !row[field].trim()) {
        problems.push(`${ledger.path}:${i + 1}: missing/empty field "${field}"`);
      }
    }
    if (row.id) {
      if (seen.has(row.id)) problems.push(`${ledger.path}:${i + 1}: duplicate id "${row.id}"`);
      seen.add(row.id);
    }
    if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      problems.push(`${ledger.path}:${i + 1}: date "${row.date}" is not YYYY-MM-DD`);
    }
    total += 1;
  });
}

if (problems.length > 0) {
  console.error(`check:ledgers FAIL - ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check:ledgers OK - ${total} entries across ${LEDGERS.length} ledgers parse clean`);
