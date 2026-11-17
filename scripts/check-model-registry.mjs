#!/usr/bin/env node
/**
 * check:model-registry - keeps lyra-evals/model-registry.json honest.
 *
 * A model-versions registry is only worth having if it cannot lie. This gate proves every claim in the
 * registry is backed by a real artifact on disk, so a number nobody measured can never sit in it:
 *
 *   1. code_versions.*        -> the exact version string exists next to its const in the worker source.
 *   2. deployed_champion      -> matches the FROZEN champion artifact (modelVersion + dataset source).
 *   3. north_star.current     -> ties to a RECORDED row in model-metrics-history.jsonl by corpus hash,
 *                                and its value equals that row's value at north_star.current.source_path.
 *   4. guardrails             -> every non-rule guardrail has a numeric current + a PASSING/FAILING status.
 *
 * Any mismatch exits non-zero with the exact drift. Runs dependency-free, in CI (after check:ledgers).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'lyra-evals/model-registry.json';
const HISTORY = 'lyra-evals/model-metrics-history.jsonl';

const errors = [];
const ok = [];
const fail = (msg) => errors.push(msg);
const pass = (msg) => ok.push(msg);

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf-8'));
}

function readText(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

/** Resolve a dotted path ("holdout.challenger_real_v1.lift_at_k") against an object, or undefined. */
function dig(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

let registry;
try {
  registry = readJson(REGISTRY);
} catch (e) {
  console.error(`FATAL: cannot read ${REGISTRY}: ${e.message}`);
  process.exit(1);
}

// --- 1. code_versions exist in the worker source -------------------------------------------------
for (const [key, spec] of Object.entries(registry.code_versions || {})) {
  let src;
  try {
    src = readText(spec.file);
  } catch {
    fail(`code_versions.${key}: file not found: ${spec.file}`);
    continue;
  }
  // The const assignment must carry the exact value, e.g. ENGINE_VERSION = "emerging-winner-engine-v1-shadow-live"
  const re = new RegExp(`${spec.const}\\s*(?::[^=]+)?=\\s*["']${spec.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
  if (re.test(src)) {
    pass(`code_versions.${key} = "${spec.value}" present in ${spec.file}`);
  } else {
    fail(`code_versions.${key}: "${spec.value}" NOT found next to ${spec.const} in ${spec.file} (registry drifted from code)`);
  }
}

// --- 2. deployed champion matches the frozen artifact --------------------------------------------
const champ = registry.deployed_champion || {};
if (!champ.artifact) {
  fail('deployed_champion.artifact is missing');
} else {
  let artifact;
  try {
    artifact = readJson(champ.artifact);
  } catch (e) {
    fail(`deployed_champion.artifact unreadable (${champ.artifact}): ${e.message}`);
  }
  if (artifact) {
    if (artifact.modelVersion === champ.model_version) {
      pass(`deployed champion "${champ.model_version}" matches artifact modelVersion`);
    } else {
      fail(`deployed_champion.model_version "${champ.model_version}" != artifact.modelVersion "${artifact.modelVersion}"`);
    }
    const artifactDataset = dig(artifact, 'dataset.source');
    if (artifactDataset === champ.dataset) {
      pass(`deployed champion dataset "${champ.dataset}" matches artifact`);
    } else {
      fail(`deployed_champion.dataset "${champ.dataset}" != artifact dataset.source "${artifactDataset}"`);
    }
    // If the artifact was force-promoted, the registry must own the reason (no silent overrides).
    const artForced = dig(artifact, 'floor.forced') === true;
    if (artForced && champ.forced !== true) {
      fail('artifact was force-promoted (floor.forced=true) but deployed_champion.forced is not true - unexplained override');
    }
    if (artForced && champ.forced === true && !champ.force_reason) {
      fail('deployed_champion.forced=true but force_reason is empty - a forced promotion must record why');
    }
    if (artForced && champ.forced === true && champ.force_reason) {
      pass('forced promotion carries a recorded reason');
    }
  }
}

// --- 3. north star ties to a recorded metrics-history row ----------------------------------------
const ns = registry.north_star || {};
const cur = ns.current || {};
let lastRow;
try {
  const lines = readText(HISTORY).trim().split('\n').filter(Boolean);
  if (lines.length === 0) fail(`${HISTORY} is empty - north-star reading cannot be tied to a recorded cycle`);
  else lastRow = JSON.parse(lines[lines.length - 1]);
} catch (e) {
  fail(`cannot read ${HISTORY}: ${e.message}`);
}
if (lastRow) {
  if (cur.corpus_sha256 && lastRow.corpus_sha256 === cur.corpus_sha256) {
    pass(`north_star.current corpus hash matches the latest recorded cycle (${cur.corpus_sha256.slice(0, 8)}...)`);
  } else {
    fail(`north_star.current.corpus_sha256 (${(cur.corpus_sha256 || '').slice(0, 8)}...) != latest history row (${(lastRow.corpus_sha256 || '').slice(0, 8)}...) - north-star number is not from a recorded cycle`);
  }
  if (cur.source_path) {
    const recorded = dig(lastRow, cur.source_path);
    if (recorded === undefined) {
      fail(`north_star.current.source_path "${cur.source_path}" does not resolve in the latest history row (stale path)`);
    } else if (Math.abs(Number(recorded) - Number(cur.value)) <= 0.01) {
      pass(`north_star.current.value ${cur.value} matches recorded ${cur.source_path} = ${recorded}`);
    } else {
      fail(`north_star.current.value ${cur.value} != recorded ${cur.source_path} = ${recorded} (drift > 0.01)`);
    }
  } else {
    fail('north_star.current.source_path is missing - cannot verify the value against the recorded cycle');
  }
}

// --- 4. guardrails are numeric + statused --------------------------------------------------------
for (const g of ns.guardrails || []) {
  if (g.op === 'rule') continue;
  if (typeof g.current !== 'number') fail(`guardrail "${g.id}": current is not numeric`);
  if (g.status !== 'PASSING' && g.status !== 'FAILING') fail(`guardrail "${g.id}": status must be PASSING or FAILING (got "${g.status}")`);
  // Sanity: the stated status must agree with the threshold + operator.
  if (typeof g.current === 'number' && typeof g.threshold === 'number') {
    const should = g.op === '>=' ? g.current >= g.threshold : g.op === '<=' ? g.current <= g.threshold : null;
    if (should !== null) {
      const stated = g.status === 'PASSING';
      if (should !== stated) fail(`guardrail "${g.id}": status "${g.status}" disagrees with ${g.current} ${g.op} ${g.threshold}`);
    }
  }
}
if ((ns.guardrails || []).length > 0 && errors.length === 0) pass('guardrails numeric + statuses consistent with thresholds');

// --- report --------------------------------------------------------------------------------------
if (errors.length) {
  console.error('check:model-registry FAILED\n');
  for (const e of errors) console.error(`  x ${e}`);
  console.error(`\n${errors.length} drift issue(s). Fix the registry or the source it drifted from.`);
  process.exit(1);
}
console.log('check:model-registry OK');
for (const m of ok) console.log(`  + ${m}`);
const arrived = dig(ns, 'target.arrived_definition.holdout_lift_at_k');
console.log(`\nNorth star: ${ns.metric} = ${cur.value}x now; arrived = ${arrived}x (CI floor ${dig(ns, 'target.arrived_definition.ci90_floor')}x, ${dig(ns, 'target.canonical_source')}). Deployed champion: ${champ.model_version}.`);
