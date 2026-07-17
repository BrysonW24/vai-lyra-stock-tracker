#!/usr/bin/env node
/**
 * Migration integrity gate. Deterministic, no DB connection, runs in CI.
 *
 * Two silent-failure classes cost us real production data nightly, and both are mechanically
 * detectable from the migration files alone. This gate makes them impossible to reintroduce:
 *
 *   A. DUPLICATE VERSION PREFIX. Supabase keys applied migrations by the leading number. Two files
 *      sharing one version (we shipped 036_chat_turns.sql AND 036_events_ipos_tables.sql) means one
 *      can be skipped or the chain refused - which is how 037_goal_target_amount silently never
 *      reached prod, nulling the AI's whole user profile.
 *
 *   B. TABLE DEFINED TWICE WITH DIFFERENT SHAPES. `create table if not exists` silently NO-OPs when
 *      the table already exists, so a second, incompatible definition looks applied but never is.
 *      public.company_events was defined by 014 (symbol/event_time/impact_level) and again by 036
 *      (event_id/event_date/ticker/title/importance). 014 won; the worker and the live calendar both
 *      spoke the 036 shape and failed against prod every single night, silently.
 *
 * A table may legitimately be re-declared only if the column sets AGREE (a harmless idempotent
 * re-declaration). Any disagreement is a collision and fails the gate - reconcile it with an ALTER
 * migration instead of a second create.
 *
 * Usage:  node scripts/check-migrations.mjs [--json]
 * Exit:   0 = clean, 1 = integrity violation, 2 = migrations directory missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');
const DIR = 'supabase/migrations';
const dirPath = path.join(root, DIR);

if (!fs.existsSync(dirPath)) {
  if (!jsonMode) console.error(`migrations: MISSING ${DIR}`);
  process.exit(2);
}

/**
 * Historical table-shape collisions that have been CONSCIOUSLY resolved.
 *
 * Migrations are an append-only log - an old duplicate `create table` cannot be deleted without
 * breaking replay on a fresh database. So each known collision is declared here with its canonical
 * shape and how it was resolved. A collision that is NOT listed fails the gate: reconcile it with an
 * `alter table ... add column if not exists` migration and add it here.
 */
const KNOWN_COLLISIONS = {
  company_events: {
    canonical: '040_events_ipos_tables.sql',
    resolvedBy: '041_reconcile_company_events.sql',
    note: '014 created it first (symbol/event_time/impact_level), so 040 (event_id/event_date/ticker/title/importance) silently no-op\'d. Both real consumers - the events worker and src/lib/calendar-live.ts - speak the 040 shape, so 041 adds those columns by ALTER and relaxes 014\'s NOT NULL on symbol.',
  },
  notification_channels: {
    canonical: '009_alerts_notifications.sql',
    resolvedBy: null,
    note: '009 is canonical and is what the app reads (is_active). 020\'s duplicate create never applied, and its extra display_name/revoked_at columns are referenced by NO code - benign, so no reconcile migration is warranted. If anything ever needs those columns, add them by ALTER.',
  },
};

const problems = [];
const fail = (inv, message) => problems.push({ inv, message });

const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.sql')).sort();

// --- A. Every version prefix must be unique. ----------------------------------------------------
const byVersion = new Map();
for (const file of files) {
  const m = file.match(/^(\d+)/);
  if (!m) {
    fail('A', `${file} has no numeric version prefix - Supabase orders and records migrations by it.`);
    continue;
  }
  const v = m[1];
  if (!byVersion.has(v)) byVersion.set(v, []);
  byVersion.get(v).push(file);
}
for (const [version, group] of byVersion) {
  if (group.length > 1) {
    fail('A', `version ${version} is used by ${group.length} files (${group.join(', ')}). Supabase records ONE row per version, so at least one of these can silently never apply. Renumber all but one to the next free version.`);
  }
}

// --- B. No table may be created twice with disagreeing column sets. -----------------------------
const tableDefs = new Map(); // table -> [{ file, columns:Set }]
for (const file of files) {
  const sql = fs.readFileSync(path.join(dirPath, file), 'utf8');
  for (const [table, columns] of createTableColumns(sql)) {
    if (!tableDefs.has(table)) tableDefs.set(table, []);
    tableDefs.get(table).push({ file, columns: new Set(columns) });
  }
}
for (const [table, defs] of tableDefs) {
  if (defs.length < 2) continue;
  const [first, ...rest] = defs;
  for (const other of rest) {
    const onlyFirst = [...first.columns].filter((c) => !other.columns.has(c));
    const onlyOther = [...other.columns].filter((c) => !first.columns.has(c));
    if (!onlyFirst.length && !onlyOther.length) continue; // identical re-declaration: harmless

    const known = KNOWN_COLLISIONS[table];
    if (known) {
      // Consciously resolved. If it names a reconciling migration, that file must still exist.
      if (known.resolvedBy && !files.includes(known.resolvedBy)) {
        fail('B', `table "${table}" collision is declared as resolved by ${known.resolvedBy}, but that migration no longer exists. Restore it or update KNOWN_COLLISIONS in this script.`);
      }
      continue;
    }

    fail(
      'B',
      `table "${table}" is created in BOTH ${first.file} and ${other.file} with different columns - ` +
        `\`create table if not exists\` makes the second a silent NO-OP, so whichever runs second never takes effect. ` +
        (onlyOther.length ? `Only in ${other.file}: ${onlyOther.join(', ')}. ` : '') +
        (onlyFirst.length ? `Only in ${first.file}: ${onlyFirst.join(', ')}. ` : '') +
        `Pick ONE canonical shape, reconcile the other with an \`alter table ... add column if not exists\` migration, ` +
        `and declare it in KNOWN_COLLISIONS in this script.`,
    );
  }
}

// --- Report ------------------------------------------------------------------------------------
if (jsonMode) {
  console.log(JSON.stringify({ ok: problems.length === 0, files: files.length, tables: tableDefs.size, problems }, null, 2));
} else if (problems.length === 0) {
  console.log(`[migrations] ok - ${files.length} migrations, unique versions, ${tableDefs.size} tables with no shape collisions.`);
} else {
  console.error(`\n\x1b[31m[migrations] ${problems.length} integrity violation(s)\x1b[0m`);
  for (const p of problems) console.error(`  [${p.inv}] ${p.message}`);
  console.error('\nThese fail SILENTLY in production (a skipped migration or a no-op create). Fix the file named above, then re-run `npm run check:migrations`.');
}
process.exit(problems.length === 0 ? 0 : 1);

// ================================================================================================

/** Parse `create table [if not exists] [public.]<name> ( ... )` -> [name, [columns]]. */
function createTableColumns(sql) {
  const out = [];
  const re = /create table(?:\s+if not exists)?\s+(?:public\.)?(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    const body = balancedParens(sql, re.lastIndex - 1);
    if (body === null) continue;
    const cols = [];
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('--')) continue;
      if (/^(unique|primary|foreign|constraint|check|references|exclude)\b/i.test(t)) continue;
      const cm = t.match(/^([a-z_][a-z0-9_]*)\s+/i);
      if (cm) cols.push(cm[1].toLowerCase());
    }
    out.push([m[1].toLowerCase(), cols]);
  }
  return out;
}

/** Substring inside the parens opening at index `open`. */
function balancedParens(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return s.slice(open + 1, i);
    }
  }
  return null;
}
