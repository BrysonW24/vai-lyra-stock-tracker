#!/usr/bin/env node
/**
 * Schema-drift gate: does the LIVE database actually match the migrations in this repo?
 *
 * This is the guard that was missing. check-migrations.mjs only reads files - it can prove the
 * migrations are internally coherent, but it can never know whether they were APPLIED. On
 * 2026-07-17 an audit found SEVEN migrations that had never reached production, and every one of
 * them failed silently:
 *
 *   037 operator_profiles.goal_target_amount  -> getUserConstraints 400'd on the missing column and
 *                                                returned null, so the AI copilot ran with ZERO
 *                                                personalisation for every user in prod
 *   038 community_ideas / community_idea_votes -> the Ideas board could never save an idea or a vote
 *   031 activation_events                      -> activation tracking wrote nowhere
 *   033 user_settings.twin_capture_enabled     -> twin consent switch absent
 *   + the company_events / fundamental_snapshots shape drift that broke the calendar and killed
 *     every fundamentals snapshot
 *
 * Nothing anywhere told anyone. The app degraded quietly, the workers logged warnings into the void,
 * and CI was green throughout - because CI never looks at the database.
 *
 * It was NOT a broken migration chain: 034/035/036 were applied while 031/033/037/038 were not.
 * Migrations here are applied BY HAND via the Supabase SQL editor, so "someone forgot" is the normal
 * failure mode, not the exception. That is precisely why this has to be mechanical.
 *
 * What it does: parses every migration for the tables/columns it should create, then asks the live
 * database (information_schema) whether they exist, and reports exactly what is missing.
 *
 * Connection: reads SUPABASE_POOLER_URL / SUPABASE_DB_URL / DATABASE_URL from the environment, or
 * from .env.local (gitignored). The URL holds the DB password, so it is never printed. Uses psql -
 * no driver dependency, available locally and on the ubuntu runners.
 *
 * Usage:
 *   node scripts/check-schema-drift.mjs                # skips loudly if no DB URL (local dev)
 *   node scripts/check-schema-drift.mjs --require-db   # FAILS if no DB URL (use in scheduled CI)
 *   node scripts/check-schema-drift.mjs --json
 *
 * Exit: 0 = live schema matches (or skipped without --require-db), 1 = drift found / no DB URL when required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseMigrationSchema } from './lib/gate-logic.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');
const requireDb = process.argv.includes('--require-db');
const MIGRATIONS = path.join(root, 'supabase/migrations');

// Objects we deliberately do not assert on: legacy columns kept only for backwards compatibility,
// and anything created conditionally inside a DO block that this parser cannot evaluate.
const IGNORE_TABLES = new Set(['schema_migrations']);

// ---------------------------------------------------------------------------------------------
// 1. Resolve the connection URL without ever printing it.
function resolveDbUrl() {
  for (const k of ['SUPABASE_POOLER_URL', 'SUPABASE_DB_URL', 'DATABASE_URL']) {
    const v = process.env[k];
    if (v && /postgres(ql)?:\/\//.test(v)) return v.replace(/^.*?(postgres(ql)?:\/\/)/, '$1').trim();
  }
  const envFile = path.join(root, '.env.local');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      if (/^(SUPABASE_POOLER_URL|SUPABASE_DB_URL|DATABASE_URL)=/.test(line) && /postgres(ql)?:\/\//.test(line)) {
        return line.replace(/^.*?(postgres(ql)?:\/\/)/, '$1').replace(/["']$/, '').trim();
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// 2. What SHOULD exist, per the migrations.
function expectedObjects() {
  // Read every migration in order and hand the concatenated SQL to the shared, self-tested parser
  // (scripts/lib/gate-logic.mjs parseMigrationSchema) - so the NOT-NULL / first-create-wins logic has
  // a committed red/green self-test instead of living untested inline (audit V15).
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const concatenated = files.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')).join('\n');
  const { tables, notNull, types } = parseMigrationSchema(concatenated);
  for (const t of IGNORE_TABLES) {
    tables.delete(t);
    notNull.delete(t);
    types.delete(t);
  }
  return { tables, notNull, types };
}

// ---------------------------------------------------------------------------------------------
// 2b. RLS INVARIANT - the leak class this gate used to miss entirely.
//
// check-schema-drift once only compared table/column existence, so a policy regression (the exact
// paper_trades cross-user READ leak: a `using (true)` SELECT policy ORing away owner-only RLS on a
// user-keyed table) passed GREEN. This encodes the invariant instead of trusting a migration ran:
//   Every table with a `user_id` column MUST have RLS enabled AND MUST NOT carry a permissive
//   `using (true)` SELECT/ALL policy granted to anon / authenticated / public.
// It is portable: drop this file into any Supabase app and it guards the same class.
// Tables where a user_id column exists but public read is INTENTIONAL by design (shared boards,
// not private data). Each entry is a deliberate exception with a reason - never add one to silence
// the gate without understanding that anyone can read every row. This is the audit trail for
// "why does this user-keyed table allow using(true)".
const INTENTIONAL_PUBLIC_READ = new Map([
  ['community_ideas', 'public community board - every user sees all ideas; user_id is the author, writes are still owner/maintainer-gated'],
]);

function liveRlsViolations(dbUrl) {
  const sql = `
    with user_tables as (
      -- Audit V15: the leak invariant used to guard only tables with a literal user_id column, so a
      -- user-keyed table whose owner column is named owner_id / profile_id / created_by was invisible
      -- to the cross-user-read check. Broaden the owner-column detection to catch those too.
      select distinct table_name
      from information_schema.columns
      where table_schema = 'public'
        and column_name in ('user_id', 'owner_id', 'profile_id', 'created_by')
    )
    select ut.table_name,
           coalesce(bool_or(cls.relrowsecurity), false) as rls_enabled,
           count(p.policyname) filter (
             where p.cmd in ('SELECT', 'ALL')
               and coalesce(p.qual, 'true') = 'true'
               and (p.roles::text like '%anon%' or p.roles::text like '%authenticated%' or p.roles::text = '{public}')
           ) as permissive_reads
    from user_tables ut
    join pg_class cls on cls.relname = ut.table_name and cls.relnamespace = 'public'::regnamespace
    left join pg_policies p on p.schemaname = 'public' and p.tablename = ut.table_name
    group by ut.table_name
    order by ut.table_name;`;
  const out = execFileSync(
    'psql',
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-qAt', '-F', '|', '-c', sql],
    { encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '20' }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const violations = [];
  for (const row of out.split('\n')) {
    const line = row.trim();
    if (!line) continue;
    const [table, rlsEnabled, permissiveReads] = line.split('|');
    if (rlsEnabled !== 't') violations.push(`${table}: RLS is DISABLED on a user-keyed table`);
    if (Number(permissiveReads) > 0 && !INTENTIONAL_PUBLIC_READ.has(table)) {
      violations.push(`${table}: has a permissive using(true) read policy - a cross-user READ leak (see paper_trades / migration 032)`);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------------------------
// 3. What DOES exist, per the live database.
function liveObjects(dbUrl) {
  const out = execFileSync(
    'psql',
    [
      dbUrl,
      '-v', 'ON_ERROR_STOP=1',
      '-qAt',
      '-c',
      "select table_name || '.' || column_name from information_schema.columns where table_schema='public';",
    ],
    { encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '20' }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const tables = new Map();
  for (const row of out.split('\n')) {
    const line = row.trim();
    if (!line) continue;
    const [table, column] = line.split('.');
    if (!table || !column) continue;
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table).add(column);
  }
  return tables;
}

// The set of live columns that are NULLABLE (is_nullable = 'YES'), keyed "table.column" - audit V15.
// A column a migration declares NOT NULL but the live DB left nullable is exactly the 0.46.0 class
// (an hourly-snapshot insert that never supplied a NOT NULL column) that this gate previously missed.
function liveNullableColumns(dbUrl) {
  const out = execFileSync(
    'psql',
    [
      dbUrl,
      '-v', 'ON_ERROR_STOP=1',
      '-qAt',
      '-c',
      "select table_name || '.' || column_name from information_schema.columns where table_schema='public' and is_nullable='YES';",
    ],
    { encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '20' }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const nullable = new Set();
  for (const row of out.split('\n')) {
    const line = row.trim();
    if (line) nullable.add(line);
  }
  return nullable;
}

// Live column base types keyed "table.column" -> data_type (audit V15). Compared only against the
// well-known types parseMigrationSchema is confident about, so an enum/serial/user-defined column is
// never a false type-drift.
function liveColumnTypes(dbUrl) {
  const out = execFileSync(
    'psql',
    [
      dbUrl,
      '-v', 'ON_ERROR_STOP=1',
      '-qAt', '-F', '|',
      '-c',
      "select table_name || '.' || column_name, data_type from information_schema.columns where table_schema='public';",
    ],
    { encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '20' }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const map = new Map();
  for (const row of out.split('\n')) {
    const line = row.trim();
    if (!line) continue;
    const [key, type] = line.split('|');
    if (key && type) map.set(key, type.trim().toLowerCase());
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
const dbUrl = resolveDbUrl();
if (!dbUrl) {
  const msg =
    'no database URL found (set SUPABASE_POOLER_URL / SUPABASE_DB_URL / DATABASE_URL, or put it in .env.local)';
  if (requireDb) {
    console.error(`\x1b[31m[schema-drift] FAIL - ${msg}\x1b[0m`);
    console.error('  --require-db was passed, so a missing URL is a failure: this check must never be silently skipped where it is meant to run.');
    process.exit(1);
  }
  console.log(`[schema-drift] SKIPPED - ${msg}. (Pass --require-db where this must run.)`);
  process.exit(0);
}

let live;
try {
  live = liveObjects(dbUrl);
} catch (err) {
  const detail = String(err.stderr || err.message || err).replace(/postgres(ql)?:\/\/\S+/g, 'postgresql://***');
  console.error(`\x1b[31m[schema-drift] FAIL - could not read the live schema.\x1b[0m\n  ${detail.trim().split('\n')[0]}`);
  process.exit(1);
}

const { tables: expected, notNull: expectedNotNull, types: expectedTypes } = expectedObjects();
const missingTables = [];
const missingColumns = [];

for (const [table, columns] of expected) {
  if (!live.has(table)) {
    missingTables.push(table);
    continue;
  }
  const liveCols = live.get(table);
  for (const col of columns) {
    if (!liveCols.has(col)) missingColumns.push(`${table}.${col}`);
  }
}

// NOT NULL drift (audit V15): a column the migrations declare NOT NULL that the live DB left nullable.
let nullableDrift = [];
try {
  const liveNullable = liveNullableColumns(dbUrl);
  for (const [table, cols] of expectedNotNull) {
    if (!live.has(table)) continue; // already reported as a missing table
    const liveCols = live.get(table);
    for (const col of cols) {
      if (liveCols.has(col) && liveNullable.has(`${table}.${col}`)) nullableDrift.push(`${table}.${col}`);
    }
  }
} catch (err) {
  const detail = String(err.stderr || err.message || err).replace(/postgres(ql)?:\/\/\S+/g, 'postgresql://***');
  console.error(`\x1b[31m[schema-drift] FAIL - could not read column nullability.\x1b[0m\n  ${detail.trim().split('\n')[0]}`);
  process.exit(1);
}

// TYPE drift (audit V15): a column whose live base type differs from the type the migration declares.
// Only the well-known types parseMigrationSchema is confident about are compared (enums/serial/
// user-defined were skipped at parse time), so this cannot false-positive on an exotic column.
let typeDrift = [];
try {
  const liveTypes = liveColumnTypes(dbUrl);
  for (const [table, cols] of expectedTypes) {
    if (!live.has(table)) continue;
    const liveCols = live.get(table);
    for (const [col, expectedType] of cols) {
      if (!liveCols.has(col)) continue; // already reported as a missing column
      const actual = liveTypes.get(`${table}.${col}`);
      if (actual && actual !== expectedType) typeDrift.push(`${table}.${col} (migration ${expectedType}, live ${actual})`);
    }
  }
} catch (err) {
  const detail = String(err.stderr || err.message || err).replace(/postgres(ql)?:\/\/\S+/g, 'postgresql://***');
  console.error(`\x1b[31m[schema-drift] FAIL - could not read column types.\x1b[0m\n  ${detail.trim().split('\n')[0]}`);
  process.exit(1);
}

let rlsViolations = [];
try {
  rlsViolations = liveRlsViolations(dbUrl);
} catch (err) {
  const detail = String(err.stderr || err.message || err).replace(/postgres(ql)?:\/\/\S+/g, 'postgresql://***');
  console.error(`\x1b[31m[schema-drift] FAIL - could not audit RLS policies.\x1b[0m\n  ${detail.trim().split('\n')[0]}`);
  process.exit(1);
}

const ok =
  missingTables.length === 0 &&
  missingColumns.length === 0 &&
  nullableDrift.length === 0 &&
  typeDrift.length === 0 &&
  rlsViolations.length === 0;

if (jsonMode) {
  console.log(JSON.stringify({ ok, missingTables, missingColumns, nullableDrift, typeDrift, rlsViolations, tablesChecked: expected.size }, null, 2));
} else if (ok) {
  console.log(`[schema-drift] ok - live database matches the migrations (${expected.size} tables checked, RLS invariant holds).`);
} else {
  console.error(`\n\x1b[31m[schema-drift] the live database does NOT match the migrations in this repo\x1b[0m`);
  if (missingTables.length) {
    console.error(`\n  MISSING TABLES (${missingTables.length}) - the migration that creates these has never been applied:`);
    for (const t of missingTables.sort()) console.error(`    - ${t}`);
  }
  if (missingColumns.length) {
    console.error(`\n  MISSING COLUMNS (${missingColumns.length}) - present in a migration, absent in the database:`);
    for (const c of missingColumns.sort()) console.error(`    - ${c}`);
  }
  if (nullableDrift.length) {
    console.error(`\n  NULLABILITY DRIFT (${nullableDrift.length}) - a migration declares NOT NULL but the live column is nullable (the 0.46.0 class):`);
    for (const c of nullableDrift.sort()) console.error(`    - ${c}`);
  }
  if (typeDrift.length) {
    console.error(`\n  TYPE DRIFT (${typeDrift.length}) - a live column's type differs from the migration that declares it:`);
    for (const c of typeDrift.sort()) console.error(`    - ${c}`);
  }
  if (rlsViolations.length) {
    console.error(`\n  RLS VIOLATIONS (${rlsViolations.length}) - a user-keyed table is exposed. This is the cross-user leak class:`);
    for (const v of rlsViolations.sort()) console.error(`    - ${v}`);
  }
  console.error(
    '\nEvery one of these fails SILENTLY at runtime: the query 400s or leaks, the code swallows it, and the feature quietly does the wrong thing.',
  );
  console.error('Apply the outstanding migrations (Supabase SQL editor, or psql against the pooler URL), then re-run.');
}
process.exit(ok ? 0 : 1);
