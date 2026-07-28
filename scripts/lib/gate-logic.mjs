/**
 * Pure detection logic shared by the release-engineering gates (check-version-bump, check-migrations)
 * and their self-tests. Extracted (audit V15) so the gates' load-bearing rules can be pinned red/green
 * in CI - a gate that silently regresses to always-pass (a SQL-parsing regex that stops matching, a
 * semver compare that stops ordering) is exactly the "who watches the watchers" failure these guard.
 *
 * No I/O, no process.exit - the CLI wrappers own reading the repo and exiting.
 */

// ---- version-bump gate ------------------------------------------------------------------------

/** RELEASES[0].version from a version.ts source string, or null if unreadable. */
export function versionFrom(src) {
  return src.match(/export const RELEASES[\s\S]*?\bversion:\s*'([^']+)'/)?.[1] ?? null;
}

/** Numeric semver compare: negative if a < b, 0 if equal, positive if a > b. */
export function semverCmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** True if a changed path is user-shippable (and therefore must carry a version bump). */
export function isShippablePath(f) {
  const isProduct =
    /^(src|supabase|workers|public|content|sql|contracts)\//.test(f) ||
    /^(next\.config\.js|Dockerfile|vercel\.json)$/.test(f);
  if (!isProduct) return false;
  // Tests never reach a user, so they never justify a user-facing changelog entry.
  const isTest = /(^|\/)(__tests__|tests)\//.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
  return !isTest;
}

/** The shippable subset of a changed-file list. */
export function shippableChanges(files) {
  return files.filter(Boolean).filter(isShippablePath);
}

// ---- migration-integrity gate -----------------------------------------------------------------

/** Leading numeric version prefix of a migration filename, or null. */
export function versionPrefix(filename) {
  return filename.match(/^(\d+)/)?.[1] ?? null;
}

/** Group migration filenames by version prefix - any group with >1 file is a duplicate-prefix collision. */
export function duplicateVersionPrefixes(filenames) {
  const byVersion = new Map();
  for (const f of filenames) {
    const v = versionPrefix(f);
    if (!v) continue;
    byVersion.set(v, [...(byVersion.get(v) ?? []), f]);
  }
  return [...byVersion.entries()].filter(([, files]) => files.length > 1);
}

/** Substring inside the parens opening at index `open`, or null if unbalanced. */
export function balancedParens(s, open) {
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

/**
 * Parse a concatenated migration SQL string into { tables, notNull } - the schema check's core
 * parser (audit V15, now shared + self-tested so a regex regression that stops seeing NOT NULL is
 * caught in CI). tables: Map<table, Set<column>>; notNull: Map<table, Set<column-declared-NOT-NULL>>.
 *
 * Models the parts of DDL that decide nullability: a column's inline `not null` (or primary key), an
 * `add column ... not null`, and `alter column ... set/drop not null` applied in order. Only the FIRST
 * `create table` for a table contributes NOT NULL, because `create table if not exists` makes a later
 * duplicate a silent no-op (so a KNOWN table-shape collision does not produce a false NOT-NULL drift).
 * Pass SQL already concatenated in migration order; comments are stripped internally.
 */
export function parseMigrationSchema(rawSql) {
  const sql = rawSql.replace(/--[^\n]*/g, '');
  const tables = new Map();
  const notNull = new Map();
  const types = new Map(); // table -> Map<col, normalized base type> (only well-known types)
  const created = new Set();
  const addNotNull = (table, col) => {
    if (!notNull.has(table)) notNull.set(table, new Set());
    notNull.get(table).add(col);
  };
  const setType = (table, col, rawType) => {
    const norm = normalizePgType(rawType);
    if (!norm) return; // unknown / user-defined / array: skip so we never false-positive on it
    if (!types.has(table)) types.set(table, new Map());
    if (!types.get(table).has(col)) types.get(table).set(col, norm); // first create wins
  };
  const ensureTable = (table) => {
    if (!tables.has(table)) tables.set(table, new Set());
    return tables.get(table);
  };

  // Walk create-table and alter statements in source order so first-create-wins and set/drop-not-null
  // resolve correctly. A single ordered scan keeps the interleaving faithful to how Postgres applies them.
  const stmt = /create table(?:\s+if not exists)?\s+(?:public\.)?(\w+)\s*\(|alter table\s+(?:public\.)?(\w+)\s+add column(?:\s+if not exists)?\s+([a-z_][a-z0-9_]*)([^;,]*)|alter table\s+(?:public\.)?(\w+)\s+alter column\s+([a-z_][a-z0-9_]*)\s+(set|drop)\s+not\s+null/gi;
  let m;
  while ((m = stmt.exec(sql))) {
    if (m[1]) {
      const table = m[1].toLowerCase();
      const body = balancedParens(sql, stmt.lastIndex - 1);
      if (body === null) continue;
      const cols = ensureTable(table);
      const firstCreate = !created.has(table);
      created.add(table);
      for (const line of body.split('\n')) {
        const t = line.trim();
        if (!t || /^(unique|primary|foreign|constraint|check|references|exclude)\b/i.test(t)) continue;
        const cm = t.match(/^([a-z_][a-z0-9_]*)\s+(.+)$/i);
        if (!cm) continue;
        const col = cm[1].toLowerCase();
        cols.add(col);
        if (firstCreate && (/\bnot\s+null\b/i.test(t) || /\bprimary\s+key\b/i.test(t))) addNotNull(table, col);
        if (firstCreate) setType(table, col, cm[2]);
      }
    } else if (m[2]) {
      const table = m[2].toLowerCase();
      const col = m[3].toLowerCase();
      ensureTable(table).add(col);
      if (/\bnot\s+null\b/i.test(m[4] ?? '')) addNotNull(table, col);
      setType(table, col, m[4] ?? '');
    } else if (m[5]) {
      const table = m[5].toLowerCase();
      const col = m[6].toLowerCase();
      if (m[7].toLowerCase() === 'set') addNotNull(table, col);
      else notNull.get(table)?.delete(col);
    }
  }
  return { tables, notNull, types };
}

/**
 * Normalise a migration column-type expression to the information_schema.data_type spelling it maps
 * to, or null when the type is unknown / user-defined / an array / a serial pseudo-type - those are
 * SKIPPED rather than compared, so the type-drift check never false-positives on an enum or a serial
 * (audit V15). Conservative by design: it only asserts the well-known base types it can compare safely.
 */
export function normalizePgType(rawType) {
  const s = String(rawType).trim().toLowerCase();
  if (!s || s.includes('[]')) return null; // empty or array -> skip
  if (/^timestamptz\b/.test(s) || /^timestamp\s+with\s+time\s+zone\b/.test(s)) return 'timestamp with time zone';
  if (/^timestamp(\s+without\s+time\s+zone)?\b/.test(s)) return 'timestamp without time zone';
  if (/^double\s+precision\b/.test(s) || /^float8\b/.test(s)) return 'double precision';
  if (/^float4\b/.test(s)) return 'real';
  if (/^character\s+varying(\s*\(\s*\d+\s*\))?\b/.test(s) || /^varchar(\s*\(\s*\d+\s*\))?\b/.test(s)) return 'character varying';
  if (/^int8\b/.test(s)) return 'bigint';
  if (/^int4\b/.test(s)) return 'integer';
  if (/^int2\b/.test(s)) return 'smallint';
  const first = s.match(/^([a-z_]+)/)?.[1];
  const MAP = {
    uuid: 'uuid', text: 'text', boolean: 'boolean', bool: 'boolean',
    bigint: 'bigint', integer: 'integer', int: 'integer', smallint: 'smallint',
    numeric: 'numeric', decimal: 'numeric', real: 'real',
    date: 'date', jsonb: 'jsonb', json: 'json', bytea: 'bytea',
  };
  return MAP[first] ?? null; // serial/bigserial/enums/user-defined -> null (skip)
}

/** [tableName, [columns]] for every CREATE TABLE in a SQL string. The gate's core parser. */
export function createTableColumns(sql) {
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
