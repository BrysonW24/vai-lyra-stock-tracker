#!/usr/bin/env node
/**
 * Data-economics gate: is the database still on course to stay FREE forever?
 *
 * DATA-ECONOMICS.md holds the doctrine: the Supabase free tier is 500 MB, growth is ~33 MB/mo,
 * and each table has a BENEFIT HORIZON - the age past which no code path reads the row. Rows
 * older than their horizon are sunk weight: storage cost continues, benefit is already
 * extracted. This gate turns that doctrine from prose into a nightly measurement:
 *
 *   1. Whole-DB size vs the free-tier runway tripwires (warn 250 MB, FAIL 300 MB - the same
 *      "act now" line DATA-ECONOMICS.md declares; 300 MB still leaves ~6 months of runway).
 *   2. Per-table size vs its declared budget (FAIL on breach - a table that blows its budget
 *      is either a runaway writer or a stale manifest, both worth a red run).
 *   3. Sunk rows: how many rows sit past each table's benefit horizon, and how many MB
 *      pruning them would reclaim. REPORTING ONLY - this gate never deletes anything.
 *      Actual pruning is a founder-ratified, separately-shipped job per table.
 *   4. 7-day write rate per table -> days until the table hits its budget at current pace.
 *
 * Every monitored table also names the VALUE it feeds (engine correctness, personalization,
 * portfolio, product surfaces) so weight is always read next to worth - the point is not
 * "small database good", it is "every megabyte earns its keep".
 *
 * Horizons marked PROVISIONAL below come from the 2026-07-18 read-path audit (every reader of
 * each table traced to its lookback window, adversarially verified). Changing a horizon here
 * changes only the REPORT - re-ratify in DATA-ECONOMICS.md before any pruning job adopts it.
 *
 * Connection: SUPABASE_POOLER_URL / SUPABASE_DB_URL / DATABASE_URL from env or .env.local,
 * same as check-schema-drift.mjs. The URL holds the DB password - never printed.
 *
 * Usage:
 *   node scripts/check-data-economics.mjs                # skips loudly if no DB URL (local dev)
 *   node scripts/check-data-economics.mjs --require-db   # FAILS if no DB URL (nightly CI)
 *   node scripts/check-data-economics.mjs --json
 *
 * Exit: 0 = within budgets (or skipped without --require-db), 1 = tripwire/budget breach,
 * manifest drift (unknown table/column), or no DB URL when required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');
const requireDb = process.argv.includes('--require-db');

// ---------------------------------------------------------------------------------------------
// The manifest. Budgets are steady-state ceilings in MB (total relation size, indexes included).
// horizonDays: age past which no reader benefits (null = keep indefinitely, no sunk accounting).
// prunedBy: what enforces the horizon today ('worker' = already enforced, 'none' = report only).
const DB_FREE_LIMIT_MB = 500; // Supabase free tier - exceeding restricts the project (no overage)
const DB_WARN_MB = 250;
const DB_FAIL_MB = 300; // DATA-ECONOMICS.md "act now" tripwire

// Horizons below are AUDITED (2026-07-18): every reader of every table traced to its lookback
// window, then adversarially verified. The binding reader is named per table - tighten a horizon
// past its binding reader and that feature silently corrupts or degrades, it does not error.
const MONITORED = [
  // Binding reader: yearly portfolio review baseline (first_close_at_or_after Jan 1 + 5 grace
  // days ~ 371d; review_job.py). gte+asc+limit-1 returns a LATER surviving bar if pruned tighter
  // - a wrong performance %, not an error. Indicators/charts never read this table (scanner
  // fetches yfinance directly; frontend synthesizes candles).
  { table: 'stock_candles', ageColumn: 'candle_time', horizonDays: 380, budgetMb: 200, prunedBy: 'none', feeds: 'yearly/quarterly review baselines + outcome labeling (90d) + latest close' },
  // Binding reader: 30-day price-move threshold dedupe cooldown (recently_alerted) - prune
  // younger and already-sent portfolio/watchlist alerts re-fire.
  { table: 'stock_alerts', ageColumn: 'created_at', horizonDays: 31, budgetMb: 30, prunedBy: 'none', feeds: 'alert feed + digest (7d) + 30d threshold-dedupe memory' },
  // Binding reader: outcome_job LOOKBACK_DAYS=90. Caveat for any future pruning job: never
  // delete a symbol's newest row (get_previous_signal needs it for lifecycle continuity).
  { table: 'stock_signals', ageColumn: 'created_at', horizonDays: 120, budgetMb: 40, prunedBy: 'none', feeds: 'signal lifecycle + 90d outcome labeling window' },
  // KEEP: nightly component_efficacy rebuild joins FULL history of scores x outcomes by design
  // (read caps exist only to be raised). The future lever if this ever gets heavy: persist an
  // all-time rollup, then cap raw rows at ~365d - requires changing both unbounded readers first.
  { table: 'stock_signal_scores', ageColumn: 'created_at', horizonDays: null, budgetMb: 60, prunedBy: 'keep', feeds: 'component efficacy evidence base (engine correctness) - full history by design' },
  // Audited: ZERO readers anywhere - write-only archive. 30d kept for incident debugging only.
  { table: 'stock_indicators', ageColumn: 'created_at', horizonDays: 30, budgetMb: 10, prunedBy: 'none', feeds: 'nothing reads this table (audited 2026-07-18) - debugging archive only' },
  // KEEP: public track record is an ALL-TIME aggregate computed from raw rows - no persisted
  // stand-in exists. Pruning shrinks measured history and flips the UI back to "still measuring".
  { table: 'signal_outcomes', ageColumn: 'created_at', horizonDays: null, budgetMb: 60, prunedBy: 'keep', feeds: 'all-time public track record + efficacy (engine correctness) - the distilled learning' },
  { table: 'scout_items', ageColumn: 'created_at', horizonDays: 90, budgetMb: 40, prunedBy: 'worker (scout nightly prune)', feeds: 'ideas board evidence windows (14d drumbeat, 90d retention)' },
  // KEEP (audited - no safe finite horizon): findings/graph project events with no age bound,
  // and portfolio/watchlist threshold dedupe keys are date-less and holding-lifetime. Held
  // deliveries must live until released. All three are tiny.
  { table: 'notification_events', ageColumn: 'created_at', horizonDays: null, budgetMb: 15, prunedBy: 'keep', feeds: 'findings/graph projections + lifetime threshold dedupe + engagement validation' },
  { table: 'notification_deliveries', ageColumn: 'created_at', horizonDays: null, budgetMb: 10, prunedBy: 'keep', feeds: 'held-until-released rows + 24h retry window' },
  { table: 'notification_engagements', ageColumn: 'engaged_at', horizonDays: null, budgetMb: 5, prunedBy: 'keep', feeds: 'personalization - which alerts actually get acted on' },
  // Audited: no code reader today (worker computes hype from fresh provider fetches). Budget
  // guard only; ~25 tiny rows/night once migration 049 is applied.
  { table: 'news_items', ageColumn: 'created_at', horizonDays: null, budgetMb: 20, prunedBy: 'none', feeds: 'no reader today (audited) - future ticker news surfaces' },
  // KEEP: cross-session chat memory reads newest-8 per user with NO age bound - a returning
  // user must not be a cold start. Gap-miner needs only 30d.
  { table: 'chat_turns', ageColumn: 'created_at', horizonDays: null, budgetMb: 10, prunedBy: 'keep', feeds: 'copilot cross-session memory (age-unbounded) + gap-miner 30d (consent-gated)' },
  // KEEP: [AI-SEC-05] durable audit trail - no code reader yet, but pruning destroys audit
  // evidence rather than breaking a feature.
  { table: 'ai_runs', ageColumn: 'created_at', horizonDays: null, budgetMb: 5, prunedBy: 'keep', feeds: 'AI durable audit trail (AI-SEC-05)' },
  { table: 'component_efficacy', ageColumn: 'updated_at', horizonDays: null, budgetMb: 5, prunedBy: 'nightly full rebuild (bounded)', feeds: 'engine correctness per score component/band/horizon' },
  // Binding reader: yearly review benchmark/AUD baselines (earliest snapshot at/after Jan 1).
  { table: 'market_context_snapshots', ageColumn: 'captured_at', horizonDays: 372, budgetMb: 10, prunedBy: 'none', feeds: 'macro strip latest + yearly/quarterly review benchmark baselines' },
  // Emerging Winner Engine (shadow-live). predictions is the IMMUTABLE append-only ledger (a trigger
  // blocks UPDATE/DELETE) - kept by design so the track record can be earned over the 12mo horizon; it
  // is small (one row per surfaced candidate per nightly run over a bounded universe). Runs = headers;
  // outcomes = matured 12mo labels that feed future calibration/retraining. Revisit budgets when the
  // real small-cap universe (Phase 1) expands the candidate count.
  { table: 'emerging_winner_runs', ageColumn: 'started_at', horizonDays: null, budgetMb: 5, prunedBy: 'keep', feeds: 'run headers for the shadow-live scoring loop' },
  { table: 'emerging_winner_predictions', ageColumn: 'predicted_at', horizonDays: null, budgetMb: 40, prunedBy: 'keep (immutable append-only ledger)', feeds: 'shadow-live winner predictions -> Emerging Winners surface + future calibration/track record' },
  { table: 'emerging_winner_outcomes', ageColumn: 'matured_at', horizonDays: null, budgetMb: 5, prunedBy: 'keep', feeds: 'matured 12mo winner labels -> calibration + retraining' },
];
// Not individually monitored (negligible or covered by the whole-DB tripwires): scout_runs
// (1 row/night), ipos + company_events + event_risks + valuation_metrics + hype_scores (small,
// some product-surface-unbounded like the IPO explorer), push_subscriptions, user tables.

// ---------------------------------------------------------------------------------------------
// 1. Resolve the connection URL without ever printing it (mirror of check-schema-drift.mjs).
function resolveDbUrl() {
  for (const k of ['SUPABASE_POOLER_URL', 'SUPABASE_DB_URL', 'DATABASE_URL']) {
    const v = process.env[k];
    if (v && /postgres(ql)?:\/\//.test(v)) return v.replace(/^.*?(postgres(ql)?:\/\/)/, '$1').trim();
  }
  const envLocal = path.join(root, '.env.local');
  if (fs.existsSync(envLocal)) {
    for (const line of fs.readFileSync(envLocal, 'utf8').split('\n')) {
      const m = line.match(/^(SUPABASE_POOLER_URL|SUPABASE_DB_URL|DATABASE_URL)\s*=\s*"?(postgres(ql)?:\/\/[^"\s]+)"?/);
      if (m) return m[2].trim();
    }
  }
  return null;
}

function skip(msg) {
  if (requireDb) {
    console.error(`[data-economics] FAIL - ${msg}`);
    console.error('  --require-db was passed, so a missing URL is a failure: this gate must never be silently skipped where it is meant to run.');
    process.exit(1);
  }
  console.log(`[data-economics] SKIPPED - ${msg}. (Pass --require-db where this must run.)`);
  process.exit(0);
}

const dbUrl = resolveDbUrl();
if (!dbUrl) skip('no SUPABASE_POOLER_URL / SUPABASE_DB_URL / DATABASE_URL configured');

function sql(query) {
  return execFileSync('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

// ---------------------------------------------------------------------------------------------
// 2. Manifest drift check: every monitored table + age column must exist. A manifest that
//    names a ghost is the same lie as a check that always passes.
let live;
try {
  live = JSON.parse(
    sql(`select coalesce(json_object_agg(table_name, cols), '{}'::json) from (
           select table_name, json_agg(column_name) as cols
           from information_schema.columns where table_schema = 'public'
           group by table_name) t;`)
  );
} catch (err) {
  console.error(`[data-economics] FAIL - could not query the database: ${String(err.message || err).slice(0, 300)}`);
  process.exit(1);
}

const drift = [];
for (const m of MONITORED) {
  if (!live[m.table]) drift.push(`${m.table}: table missing from live schema`);
  else if (!live[m.table].includes(m.ageColumn)) drift.push(`${m.table}.${m.ageColumn}: age column missing`);
}
if (drift.length) {
  console.error('[data-economics] FAIL - manifest drift (fix MONITORED in this script or apply the missing migration):');
  for (const d of drift) console.error(`  - ${d}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// 3. Measure. One query, one JSON blob.
const parts = MONITORED.map((m) => {
  const past = m.horizonDays
    ? `(select count(*) from "${m.table}" where "${m.ageColumn}" < now() - make_interval(days => ${m.horizonDays}))`
    : 'null';
  return `json_build_object(
    'table', '${m.table}',
    'rows', (select count(*) from "${m.table}"),
    'bytes', pg_total_relation_size('public.${m.table}'),
    'past_horizon', ${past},
    'rows_7d', (select count(*) from "${m.table}" where "${m.ageColumn}" > now() - interval '7 days'))`;
});
const report = JSON.parse(
  sql(`select json_build_object(
         'db_bytes', pg_database_size(current_database()),
         'tables', json_build_array(${parts.join(',')}))::text;`)
);

// ---------------------------------------------------------------------------------------------
// 4. Judge.
const MB = 1024 * 1024;
const dbMb = report.db_bytes / MB;
const failures = [];
const warnings = [];
const rows = report.tables.map((t) => {
  const m = MONITORED.find((x) => x.table === t.table);
  const mb = t.bytes / MB;
  const bytesPerRow = t.rows > 0 ? t.bytes / t.rows : 0;
  const sunkMb = t.past_horizon != null ? (t.past_horizon * bytesPerRow) / MB : null;
  const perDay = t.rows_7d / 7;
  const daysToBudget = perDay > 0 && bytesPerRow > 0 ? Math.floor((m.budgetMb * MB - t.bytes) / (perDay * bytesPerRow)) : null;
  if (mb >= m.budgetMb) failures.push(`${t.table}: ${mb.toFixed(1)} MB >= budget ${m.budgetMb} MB (runaway writer or stale budget)`);
  else if (mb >= m.budgetMb * 0.8) warnings.push(`${t.table}: ${mb.toFixed(1)} MB is >=80% of its ${m.budgetMb} MB budget`);
  if (sunkMb != null && t.rows > 0 && t.past_horizon / t.rows > 0.5 && m.prunedBy === 'none')
    warnings.push(`${t.table}: ${((100 * t.past_horizon) / t.rows).toFixed(0)}% of rows are past the ${m.horizonDays}d benefit horizon (~${sunkMb.toFixed(1)} MB reclaimable) - ratify pruning in DATA-ECONOMICS.md`);
  return { ...t, mb, sunkMb, perDay, daysToBudget, m };
});

if (dbMb >= DB_FAIL_MB) failures.push(`database ${dbMb.toFixed(0)} MB >= ${DB_FAIL_MB} MB tripwire - DATA-ECONOMICS.md says act NOW (retention or Supabase Pro)`);
else if (dbMb >= DB_WARN_MB) warnings.push(`database ${dbMb.toFixed(0)} MB >= ${DB_WARN_MB} MB - approaching the ${DB_FAIL_MB} MB act-now tripwire`);

// ---------------------------------------------------------------------------------------------
// 5. Report.
if (jsonMode) {
  console.log(JSON.stringify({ ok: failures.length === 0, dbMb: +dbMb.toFixed(1), freeLimitMb: DB_FREE_LIMIT_MB, failures, warnings, tables: rows.map(({ m, ...r }) => ({ ...r, budgetMb: m.budgetMb, horizonDays: m.horizonDays, feeds: m.feeds })) }, null, 2));
} else {
  console.log(`[data-economics] database: ${dbMb.toFixed(1)} MB of ${DB_FREE_LIMIT_MB} MB free tier (warn ${DB_WARN_MB}, fail ${DB_FAIL_MB})`);
  console.log('');
  console.log('  table                       size      budget   sunk-past-horizon        7d-rate    feeds');
  for (const r of rows) {
    const sunk = r.sunkMb != null ? `${r.past_horizon} rows ~${r.sunkMb.toFixed(1)} MB` : r.m.prunedBy === 'keep' ? 'keep (no horizon)' : 'no horizon set';
    console.log(
      `  ${r.table.padEnd(27)} ${`${r.mb.toFixed(1)} MB`.padEnd(9)} ${`${r.m.budgetMb} MB`.padEnd(8)} ${sunk.padEnd(24)} ${`${r.perDay.toFixed(0)}/day`.padEnd(10)} ${r.m.feeds}`
    );
  }
  console.log('');
  for (const w of warnings) console.log(`  WARN: ${w}`);
  for (const f of failures) console.log(`  FAIL: ${f}`);
  if (!warnings.length && !failures.length) console.log('  ok - every table inside budget, no tripwire in sight');
}

if (failures.length) {
  console.error(`\n[data-economics] FAIL - ${failures.length} breach(es). Doctrine + levers: DATA-ECONOMICS.md`);
  process.exit(1);
}
console.log(`\n[data-economics] OK${warnings.length ? ` - ${warnings.length} warning(s), no breach` : ''}`);
