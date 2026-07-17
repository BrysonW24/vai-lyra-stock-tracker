#!/usr/bin/env node
/**
 * Onboarding CONTRACT gate: proves that what onboarding captures is persisted, read back, and
 * actually reaches the AI - and that the read layer can never silently null the whole profile.
 *
 * This is the SOLID, deterministic guard behind the "onboarding values are captured properly and
 * utilised properly by the AI" promise. It runs in CI (no model, no network) so that if anyone ever
 * changes the pipeline - adds a profile field, renames a column, drops a line from the prompt - the
 * build fails loudly with an instruction, instead of shipping a profile the AI silently ignores.
 *
 * The pipeline it locks down:
 *
 *   CAPTURE   onboarding form  ->  OperatorProfile / CapitalContext        (src/lib/onboarding.ts)
 *   PERSIST   POST /api/onboarding upserts into operator_profiles          (src/app/api/onboarding/route.ts)
 *   READ      getUserConstraints selects the columns back                  (src/lib/ai/user-context.ts)
 *   PROMPT    buildConstraintsBlock + deriveTone put them in the AI prompt (src/lib/ai/user-context.ts, chat-context.ts)
 *
 * The invariants (each maps to a real failure mode we have hit or want to prevent):
 *   A. Every column in getUserConstraints' CORE select exists in the onboarding BASELINE schema
 *      (<= migration 022). A CORE column from a LATER migration would 400 the whole read on any
 *      project that has not applied it - nulling ALL personalisation everywhere. Newer columns must
 *      live in OPTIONAL_PROFILE_COLUMNS (read best-effort). THIS is the goal_target_amount lesson.
 *   B. Every column in the OPTIONAL select exists in some migration (no read of a phantom column).
 *   C. Every operator_profiles column the onboarding route writes exists in a migration (no silent
 *      write to a column that is not there).
 *   D. Every individualisation column that is persisted is also read back by getUserConstraints
 *      (nothing captured is dropped at the read layer).
 *   E. buildConstraintsBlock references every individualisation field (nothing loaded is dropped
 *      before the prompt - the "captured but not utilised" regression guard).
 *   F. deriveTone factors the beginner learning style (tone individualises per user).
 *   G. The base_currency the read joins from `profiles` exists in a migration.
 *
 * Usage:  node scripts/check-onboarding-contract.mjs [--json]
 * Exit:   0 = contract holds, 1 = a contract invariant broke (details printed), 2 = a checked file is missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

// Columns added at or before this migration ship with the onboarding baseline and are treated as
// guaranteed-present. The CORE profile read may only reference these; anything newer is best-effort.
const CORE_BASELINE_MAX = 22;

// The user answers that individualise the AI. Each MUST be captured -> persisted -> read -> prompted.
// snake_case = the DB column; camelCase = the field name the prompt builder must reference.
const INDIVIDUALISATION = [
  { col: 'experience_level', field: 'experienceLevel' },
  { col: 'investing_style', field: 'investingStyle' },
  { col: 'preferred_timeframe', field: 'preferredTimeframe' },
  { col: 'risk_comfort', field: 'riskComfort' },
  { col: 'primary_goal', field: 'primaryGoal' },
  { col: 'traded_before', field: 'tradedBefore' },
  { col: 'beginner_motivation', field: 'beginnerMotivation' },
  { col: 'beginner_knowledge', field: 'beginnerKnowledge' },
  { col: 'beginner_involvement', field: 'beginnerInvolvement' },
  { col: 'beginner_learning_style', field: 'beginnerLearningStyle' },
  { col: 'beginner_horizon', field: 'beginnerHorizon' },
];
// Fields the prompt must reference that come from the OPTIONAL/capital columns, not the list above.
const PROMPT_ALSO_REQUIRES = ['goalTargetAmount', 'cashAvailable', 'maxPositionSizePct'];

const USER_CONTEXT = 'src/lib/ai/user-context.ts';
const CHAT_CONTEXT = 'src/lib/ai/chat-context.ts';
const ONBOARDING_ROUTE = 'src/app/api/onboarding/route.ts';
const MIGRATIONS_DIR = 'supabase/migrations';

const problems = [];
const fail = (inv, message) => problems.push({ inv, message });

for (const f of [USER_CONTEXT, CHAT_CONTEXT, ONBOARDING_ROUTE]) {
  if (!exists(f)) {
    if (!jsonMode) console.error(`onboarding-contract: MISSING ${f} - a pipeline file was moved or deleted.`);
    process.exit(2);
  }
}

// --- Parse the schema: every operator_profiles / profiles column -> the migration that introduced it.
const { operatorCols, profilesCols } = parseSchema();

// --- Parse the read layer (getUserConstraints CORE + OPTIONAL selects). -----------------------
const userCtx = read(USER_CONTEXT);
const coreMatch = userCtx.match(/const CORE_PROFILE_COLUMNS\s*=\s*'([^']*)'/);
const optionalMatch = userCtx.match(/const OPTIONAL_PROFILE_COLUMNS\s*=\s*\[([^\]]*)\]/);
if (!coreMatch) fail('A', `${USER_CONTEXT}: could not find CORE_PROFILE_COLUMNS - the read layer must declare its core select as a single string literal so this gate can verify it.`);
if (!optionalMatch) fail('B', `${USER_CONTEXT}: could not find OPTIONAL_PROFILE_COLUMNS - later-migration columns must be declared here and read best-effort.`);

const coreCols = coreMatch ? splitCols(coreMatch[1]) : [];
const optionalCols = optionalMatch ? [...optionalMatch[1].matchAll(/'([a-z_][a-z0-9_]*)'/g)].map((m) => m[1]) : [];
const selectedCols = new Set([...coreCols, ...optionalCols]);

// --- A. CORE columns must exist AND be no newer than the baseline. -----------------------------
for (const col of coreCols) {
  const mig = operatorCols.get(col);
  if (mig === undefined) {
    fail('A', `CORE_PROFILE_COLUMNS reads "${col}" but no migration adds it to operator_profiles. Remove it, fix the name, or add the column.`);
  } else if (mig > CORE_BASELINE_MAX) {
    fail('A', `CORE_PROFILE_COLUMNS reads "${col}" (migration ${String(mig).padStart(3, '0')}), which is NEWER than the onboarding baseline (${String(CORE_BASELINE_MAX).padStart(3, '0')}). On a project that has not applied that migration this select 400s and nulls the ENTIRE profile for every AI surface. Move "${col}" into OPTIONAL_PROFILE_COLUMNS and read it best-effort.`);
  }
}

// --- B. OPTIONAL columns must exist in some migration. -----------------------------------------
for (const col of optionalCols) {
  if (!operatorCols.has(col)) {
    fail('B', `OPTIONAL_PROFILE_COLUMNS reads "${col}" but no migration adds it to operator_profiles - the best-effort read targets a phantom column.`);
  }
}

// --- C. Every column the onboarding route persists must exist in the schema. -------------------
for (const col of operatorUpsertKeys(read(ONBOARDING_ROUTE))) {
  if (!operatorCols.has(col)) {
    fail('C', `${ONBOARDING_ROUTE} writes operator_profiles.${col} but no migration defines it - the save silently drops this field.`);
  }
}

// --- D. Every individualisation column persisted must be read back. ----------------------------
for (const { col } of INDIVIDUALISATION) {
  if (!operatorCols.has(col)) {
    fail('D', `Individualisation column "${col}" is missing from the schema entirely - onboarding cannot capture it.`);
    continue;
  }
  if (!selectedCols.has(col)) {
    fail('D', `Individualisation column "${col}" is captured but getUserConstraints never selects it - the answer is collected then never read. Add it to CORE_PROFILE_COLUMNS.`);
  }
}

// --- E. buildConstraintsBlock must reference every individualisation field (+ the extras). ------
const blockBody = sliceFunction(userCtx, 'buildConstraintsBlock');
if (!blockBody) {
  fail('E', `${USER_CONTEXT}: could not locate buildConstraintsBlock - the prompt builder must exist for the contract to hold.`);
} else {
  const requiredFields = [...INDIVIDUALISATION.map((x) => x.field), ...PROMPT_ALSO_REQUIRES];
  for (const field of requiredFields) {
    if (!blockBody.includes(field)) {
      fail('E', `buildConstraintsBlock never references "${field}" - it is captured and read but dropped before the AI prompt. Emit a line for it so the AI actually uses it.`);
    }
  }
}

// --- F. deriveTone must factor the beginner learning style. ------------------------------------
const toneBody = sliceFunction(read(CHAT_CONTEXT), 'deriveTone');
if (!toneBody) {
  fail('F', `${CHAT_CONTEXT}: could not locate deriveTone - tone must be derivable for the contract to hold.`);
} else if (!toneBody.includes('beginnerLearningStyle')) {
  fail('F', `deriveTone ignores beginnerLearningStyle - two beginners who asked to be taught differently would get the same voice. Factor the learning style into the tone.`);
}

// --- G. base_currency (joined from profiles) must exist. ---------------------------------------
if (userCtx.includes("'base_currency'") && !profilesCols.has('base_currency')) {
  fail('G', `getUserConstraints reads profiles.base_currency but no migration defines it.`);
}

// --- Report ------------------------------------------------------------------------------------
if (jsonMode) {
  console.log(JSON.stringify({ ok: problems.length === 0, coreCols, optionalCols, problems }, null, 2));
} else if (problems.length === 0) {
  console.log(
    `[onboarding-contract] ok - ${coreCols.length} core + ${optionalCols.length} optional columns; ` +
      `${INDIVIDUALISATION.length} individualisation answers captured -> persisted -> read -> prompted.`,
  );
} else {
  console.error(`\n\x1b[31m[onboarding-contract] ${problems.length} contract violation(s)\x1b[0m`);
  for (const p of problems) console.error(`  [${p.inv}] ${p.message}`);
  console.error('\nThe onboarding capture -> persist -> AI pipeline drifted. Fix the file named above, then re-run `npm run check:onboarding-contract`.');
}
process.exit(problems.length === 0 ? 0 : 1);

// ================================================================================================
// Parsers - deterministic, regex over source. No SQL engine, no TS compiler.

/** column list from a comma-separated SQL select string -> lowercased names. */
function splitCols(s) {
  return s
    .split(',')
    .map((c) => c.trim())
    .filter((c) => /^[a-z_][a-z0-9_]*$/.test(c));
}

/** Every operator_profiles / profiles column -> the (numeric) migration that introduced it. */
function parseSchema() {
  const operatorCols = new Map();
  const profilesCols = new Map();
  const files = fs
    .readdirSync(path.join(root, MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const migNum = Number((file.match(/^(\d+)/) || [])[1] ?? 999);
    const sql = read(path.join(MIGRATIONS_DIR, file));

    // create table blocks
    for (const [table, cols] of createTableColumns(sql)) {
      const target = table === 'operator_profiles' ? operatorCols : table === 'profiles' ? profilesCols : null;
      if (!target) continue;
      for (const col of cols) if (!target.has(col)) target.set(col, migNum);
    }

    // alter table ... add column
    for (const m of sql.matchAll(/alter table\s+(?:public\.)?(\w+)\s+add column(?:\s+if not exists)?\s+([a-z_][a-z0-9_]*)/gi)) {
      const target = m[1] === 'operator_profiles' ? operatorCols : m[1] === 'profiles' ? profilesCols : null;
      if (target && !target.has(m[2])) target.set(m[2], migNum);
    }
  }
  return { operatorCols, profilesCols };
}

/** Parse `create table ... <name> ( ... )` blocks -> [tableName, [columns]]. */
function createTableColumns(sql) {
  const out = [];
  const re = /create table(?:\s+if not exists)?\s+(?:public\.)?(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    const table = m[1];
    const body = balancedParens(sql, re.lastIndex - 1);
    if (body === null) continue;
    const cols = [];
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('--')) continue;
      // skip table-level constraints
      if (/^(unique|primary|foreign|constraint|check|references)\b/i.test(t)) continue;
      const cm = t.match(/^([a-z_][a-z0-9_]*)\s+/);
      if (cm) cols.push(cm[1]);
    }
    out.push([table, cols]);
  }
  return out;
}

/** Return the substring inside the parentheses that opens at index `open` (points at "("). */
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

/** operator_profiles upsert object keys in the onboarding route. */
function operatorUpsertKeys(src) {
  const start = src.indexOf(".from('operator_profiles')");
  if (start === -1) return [];
  // The operator_profiles upsert closes at its onConflict; bound the scan there so we do not pick up
  // keys from the later user_alert_preferences / onboarding_progress upserts.
  const end = src.indexOf("{ onConflict: 'user_id' }", start);
  const block = src.slice(start, end === -1 ? undefined : end);
  return [...block.matchAll(/\n\s*([a-z_][a-z0-9_]*):/g)].map((m) => m[1]);
}

/** Best-effort extraction of a function body by name (brace-balanced from its first `{`). */
function sliceFunction(src, name) {
  const idx = src.search(new RegExp(`function\\s+${name}\\b`));
  if (idx === -1) return null;
  const open = src.indexOf('{', idx);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return src.slice(open);
}
