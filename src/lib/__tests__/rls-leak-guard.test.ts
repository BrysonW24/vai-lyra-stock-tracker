import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * RLS regression guard - the cross-user READ leak that migration 030 introduced (a permissive
 * `for select to anon, authenticated using (true)` blanketed onto user-keyed paper_trades /
 * trade_day_snapshots, which Postgres ORs with the owner-only policy -> everyone can read
 * everyone's rows) must stay fixed. This scans the migration SQL from source so a future
 * migration that re-opens a user-keyed table to global reads turns the build red.
 *
 * See supabase/migrations/032_fix_cross_user_read_leak.sql for the fix + full root-cause writeup.
 */
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
const read = (f: string) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8');

// Tables that carry per-user data and must NEVER be globally SELECT-able by anon/authenticated.
const USER_KEYED = [
  'paper_trades', 'trade_day_snapshots', 'paper_positions', 'paper_accounts', 'paper_orders',
  'paper_trade_journal', 'trade_journal_entries', 'watchlist_items', 'user_trade_logs',
  'operator_profiles', 'user_settings', 'order_intents', 'order_approvals', 'execution_audit_logs',
];

describe('RLS · no cross-user read leak on user-keyed tables', () => {
  it('found the migration surface', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('the 032 corrective fix exists and is column-guarded (keys off real user_id, not an assumption)', () => {
    const fix = files.find((f) => f.startsWith('032_'));
    expect(fix, 'migration 032 corrective fix is missing').toBeTruthy();
    const sql = read(fix as string);
    // Keys off whether the deployed table actually has a user_id column (collision-safe).
    expect(sql).toMatch(/column_name\s*=\s*'user_id'/);
    // Drops 030's permissive read policy (policy name built as `t || '_read'`)...
    expect(sql).toMatch(/drop policy if exists/i);
    expect(sql).toMatch(/'_read'/);
    // ...and restores an owner-only SELECT.
    expect(sql).toMatch(/for select using \(auth\.uid\(\) = user_id\)/i);
  });

  it('no migration grants a literal using(true) SELECT on a user-keyed table', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const sql = read(f);
      for (const t of USER_KEYED) {
        // Literal per-table permissive read: `create policy X on public.<t> for select ... using (true)`.
        const re = new RegExp(
          `create policy\\s+\\S+\\s+on\\s+public\\.${t}\\b[\\s\\S]*?for select[\\s\\S]*?using\\s*\\(\\s*true\\s*\\)`,
          'i',
        );
        if (re.test(sql)) offenders.push(`${f} -> ${t}`);
      }
    }
    expect(offenders, `literal cross-user read leak(s): ${offenders.join(', ')}`).toEqual([]);
  });

  it('the 030 blanket-read hazard is neutralised by a later corrective migration', () => {
    // 030 lists paper_trades/trade_day_snapshots inside a using(true) loop; the fix must come after it.
    const has030 = files.some((f) => f.startsWith('030_'));
    const has032Fix = files.some((f) => f.startsWith('032_fix_cross_user_read_leak'));
    if (has030) {
      expect(has032Fix, '030 opened a global read; 032 corrective fix must exist').toBe(true);
    }
    // Confirm 030 really did blanket paper_trades (documents the hazard this guard defends).
    const m030 = files.find((f) => f.startsWith('030_'));
    if (m030) expect(read(m030)).toMatch(/using\s*\(\s*true\s*\)/i);
  });
});
