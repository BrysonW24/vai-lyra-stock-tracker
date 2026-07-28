import { describe, it, expect } from 'vitest';
import {
  versionFrom,
  semverCmp,
  isShippablePath,
  shippableChanges,
  versionPrefix,
  duplicateVersionPrefixes,
  createTableColumns,
} from '../gate-logic.mjs';

/**
 * 2026-07-27 audit V15: the quality gates enforce the codebase, but nothing pinned the gates
 * themselves - a gate that silently regressed to always-pass (a SQL-parsing regex that stops
 * matching, a semver compare that stops ordering) would not be caught by anything. These are the
 * "who watches the watchers" self-tests: each asserts the shared detection logic goes RED on the
 * exact failure class the gate exists to catch, and GREEN on the clean case.
 */

describe('check-version-bump: version detection', () => {
  it('extracts RELEASES[0].version, null on garbage', () => {
    expect(versionFrom("export const RELEASES = [\n  { version: '0.87.0', date: 'x' },")).toBe('0.87.0');
    expect(versionFrom('no releases here')).toBeNull();
  });

  it('RED on a downgrade: semverCmp flags a version that moves backwards', () => {
    // The 2026-07-17 incident: 0.43.1 prepended while origin/main carried 0.44.0.
    expect(semverCmp('0.43.1', '0.44.0')).toBeLessThan(0); // backwards -> gate blocks
    expect(semverCmp('0.88.0', '0.87.0')).toBeGreaterThan(0); // forwards -> allowed
    expect(semverCmp('0.87.0', '0.87.0')).toBe(0); // unchanged
  });
});

describe('check-version-bump: shippable-change detection', () => {
  it('RED: a product-code change is shippable and must carry a version bump', () => {
    expect(isShippablePath('src/lib/data.ts')).toBe(true);
    expect(isShippablePath('supabase/migrations/055_x.sql')).toBe(true);
    expect(isShippablePath('workers/stock_scanner/main.py')).toBe(true);
    expect(isShippablePath('next.config.js')).toBe(true);
  });

  it('GREEN: tests and docs are NOT shippable (they never reach a user)', () => {
    expect(isShippablePath('src/lib/__tests__/data.test.ts')).toBe(false);
    expect(isShippablePath('tests/paper-bot.test.ts')).toBe(false);
    expect(isShippablePath('src/lib/data.spec.ts')).toBe(false);
    expect(isShippablePath('README.md')).toBe(false);
    expect(isShippablePath('docs/x.md')).toBe(false);
  });

  it('shippableChanges keeps only the product files from a mixed change set', () => {
    const changed = ['src/lib/data.ts', 'src/lib/__tests__/data.test.ts', 'README.md', 'sql/seed.sql'];
    expect(shippableChanges(changed)).toEqual(['src/lib/data.ts', 'sql/seed.sql']);
  });
});

describe('check-migrations: duplicate-version-prefix detection', () => {
  it('RED on two files sharing a version prefix (the 036 x2 incident)', () => {
    const dups = duplicateVersionPrefixes(['036_chat_turns.sql', '036_events_ipos.sql', '037_x.sql']);
    expect(dups).toHaveLength(1);
    expect(dups[0][0]).toBe('036');
  });

  it('GREEN on a clean, uniquely-numbered set', () => {
    expect(duplicateVersionPrefixes(['001_a.sql', '002_b.sql', '003_c.sql'])).toHaveLength(0);
  });

  it('versionPrefix reads the leading number, null when absent', () => {
    expect(versionPrefix('054_learning_ledgers.sql')).toBe('054');
    expect(versionPrefix('no_number.sql')).toBeNull();
  });
});

describe('check-migrations: table-shape-collision detection (the SQL parser)', () => {
  it('parses a CREATE TABLE into its column names (RED if the regex ever stops matching)', () => {
    const [[table, cols]] = createTableColumns(
      'create table if not exists public.foo (\n id uuid primary key,\n user_id uuid,\n amount numeric\n);',
    );
    expect(table).toBe('foo');
    expect(cols).toEqual(['id', 'user_id', 'amount']);
  });

  it('surfaces disagreeing column sets for the same table (the company_events collision class)', () => {
    const a = new Set(createTableColumns('create table company_events (symbol text, event_time timestamptz);')[0][1]);
    const b = new Set(createTableColumns('create table company_events (event_id uuid, event_date date, ticker text);')[0][1]);
    const onlyA = [...a].filter((c) => !b.has(c));
    const onlyB = [...b].filter((c) => !a.has(c));
    // A real collision: the two definitions do NOT agree on columns -> the gate must fail on it.
    expect(onlyA.length + onlyB.length).toBeGreaterThan(0);
  });

  it('does NOT flag an identical re-declaration (harmless idempotent create)', () => {
    const a = new Set(createTableColumns('create table foo (id uuid, name text);')[0][1]);
    const b = new Set(createTableColumns('create table if not exists foo (id uuid, name text);')[0][1]);
    const onlyA = [...a].filter((c) => !b.has(c));
    const onlyB = [...b].filter((c) => !a.has(c));
    expect(onlyA.length + onlyB.length).toBe(0);
  });
});
