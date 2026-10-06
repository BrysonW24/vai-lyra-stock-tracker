#!/usr/bin/env node
/**
 * App-columns gate: every column the app NAMES in a hot-path read must exist in the schema.
 *
 * Deterministic against a real database - point it at one built from the migrations (CI's
 * migrations-from-zero job does) or at production (read-only: one information_schema query).
 *
 * Why it exists: v0.132.0 named five columns on stock_signals that had never existed. Type-check,
 * lint, 1,222 unit tests and the production build were all green, because nothing in that chain
 * knows what columns a table has. PostgREST knew, answered 400, and the dashboard served demo data
 * to every user. This is the check that would have said so before the push.
 *
 * Usage:  node scripts/check-app-columns.mjs          (reads DATABASE_URL or SUPABASE_POOLER_URL)
 * Exit:   0 = every named column exists, 1 = one does not, 2 = no database URL.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('[app-columns] no DATABASE_URL / SUPABASE_POOLER_URL set - nothing to check against.');
  process.exit(2);
}

// Every column manifest in the repo: the dashboard's and the hourly summary worker's. A reader that
// names columns anywhere else should add its manifest here rather than trust a type.
const MANIFESTS = ['../src/lib/dashboard-columns.json', '../workers/stock_scanner/summary_columns.json'];
const named = {};
for (const manifest of MANIFESTS) {
  for (const [table, columns] of Object.entries(JSON.parse(readFileSync(new URL(manifest, import.meta.url), 'utf8')))) {
    named[table] = [...new Set([...(named[table] || []), ...columns])];
  }
}
let live;
try {
  live = JSON.parse(
    execFileSync(
      'psql',
      [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
        `select coalesce(json_object_agg(table_name, cols), '{}'::json) from (
           select table_name, json_agg(column_name) as cols from information_schema.columns
           where table_schema = 'public' group by table_name) t;`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim(),
  );
} catch (err) {
  const detail = String(err.stderr || err.message || err).replace(/postgres(ql)?:\/\/\S+/g, 'postgresql://***');
  console.error(`[app-columns] FAIL - could not read the schema: ${detail.trim().split('\n')[0]}`);
  process.exit(1);
}

const problems = [];
let checked = 0;
for (const [table, columns] of Object.entries(named)) {
  if (!live[table]) {
    problems.push(`${table}: table does not exist`);
    continue;
  }
  for (const column of columns) {
    checked += 1;
    if (!live[table].includes(column)) problems.push(`${table}.${column}: named by the app, not a column`);
  }
}

if (problems.length) {
  console.error(`[app-columns] FAIL - the app names ${problems.length} thing(s) the schema does not have:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('  PostgREST answers 400 for the whole read when one named column is missing - the app then shows demo data.');
  console.error('  Fix the manifest that names it (src/lib/dashboard-columns.json or workers/stock_scanner/summary_columns.json), or add the migration that creates the column.');
  process.exit(1);
}
console.log(`[app-columns] ok - all ${checked} named columns exist across ${Object.keys(named).length} tables (${MANIFESTS.length} manifests).`);
