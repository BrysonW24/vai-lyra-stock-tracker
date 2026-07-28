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
