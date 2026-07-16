/**
 * Guardrails engine - the single verdict surface for the AI layer, ported from the Vivacity GaaS
 * pattern (named guards, worst-wins severity, one typed verdict, fail-closed on an unknown guard)
 * and tuned for a stock research app. It composes Lyra's existing guards (injection resistance,
 * number grounding) with two finance-specific ones (regulated-advice, content-safety) so any AI
 * entry point can run ONE call - evaluateGuardrails(...) - instead of scattering ad-hoc checks.
 *
 * Doctrine: this NEVER authorises an action or a number. It classifies text as allow / review /
 * block and reports why. Deterministic and pure. Research only.
 */
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { assertNoFabricatedNumbers } from '@/lib/ai/guardrails/schema';

export type GuardStatus = 'pass' | 'warn' | 'fail';
export type GuardDecision = 'allow' | 'review' | 'block';

export interface GuardResult {
  guardId: string;
  status: GuardStatus;
  findings: string[];
}

export interface GuardrailVerdict {
  decision: GuardDecision;
  safeToProceed: boolean;
  /** Locked false: the guardrail layer never authorises a live/side-effecting action. */
  safeForLiveAction: false;
  guardResults: GuardResult[];
  blockedReasons: string[];
  warnings: string[];
}

export interface GuardInput {
  /** The model output (or candidate text) being checked. */
  text: string;
  /**
   * External/untrusted content the text may derive from (news, filings, retrieved chunks). Used by
   * the injection guard - instructions embedded in this content must never be obeyed.
   */
  external?: string;
  /** Numerals present in the grounding the model was given; anything else in `text` is fabricated. */
  allowedNumbers?: string[];
}

/** A guard is a pure function over the input. */
type Guard = (input: GuardInput) => GuardResult;

// --- individual guards -------------------------------------------------------

/** Untrusted content (or the output itself) trying to inject instructions -> block. */
const injectionResistance: Guard = ({ text, external }) => {
  const findings: string[] = [];
  if (external && detectInjectionAttempt(external)) findings.push('external content contains instruction-injection patterns');
  if (detectInjectionAttempt(text)) findings.push('output echoes instruction-injection patterns');
  return { guardId: 'injection-resistance', status: findings.length ? 'fail' : 'pass', findings };
};

/** A money/percent/date numeral not present in the grounding -> block (the engine owns numbers). */
const grounding: Guard = ({ text, allowedNumbers }) => {
  if (!allowedNumbers) return { guardId: 'grounding', status: 'pass', findings: [] };
  const check = assertNoFabricatedNumbers(text, allowedNumbers);
  return check.ok
    ? { guardId: 'grounding', status: 'pass', findings: [] }
    : { guardId: 'grounding', status: 'fail', findings: [`ungrounded numerals: ${check.fabricated.join(', ')}`] };
};

// Advice / recommendation language a research tool must never emit. Lyra's action language is
// "Buy Review / Watch / Do Not Add" - never "buy now" / "I recommend" / "guaranteed".
const ADVICE_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /\b(?:you should|i (?:recommend|suggest|advise)|my advice)\b.{0,30}\b(?:buy|sell|short|invest|purchase)\b/i, why: 'directive advice to trade' },
  { re: /\b(?:buy|sell|short) (?:it|now|today|immediately)\b/i, why: 'time-pressured buy/sell instruction' },
  { re: /\b(?:guaranteed|risk[- ]free|can'?t lose|sure thing|will (?:definitely|certainly) (?:go up|rise|moon))\b/i, why: 'certainty / guaranteed-return claim' },
  // Positive framing as advice fires; the compliant disclaimer ("this is ... not financial advice")
  // is excluded by the lookbehind - a preceding "not" within ~24 chars means it's a disclaimer.
  { re: /(?<!\bnot\b.{0,24})\b(?:financial|investment) advice\b/i, why: 'framed as financial advice' },
];

/** Advice/recommendation/guarantee language -> block (research only, never advice). */
const regulatedAdvice: Guard = ({ text }) => {
  const findings = ADVICE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.why);
  return { guardId: 'regulated-advice', status: findings.length ? 'fail' : 'pass', findings };
};

// Overclaims a research tool should not make about itself or the data.
const OVERCLAIM_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /\b(?:i (?:can )?predict|i know (?:for (?:sure|certain)|what will happen)|proven to (?:beat|outperform))\b/i, why: 'predictive overclaim' },
  { re: /\b(?:insider|non[- ]public|leaked) (?:information|tip|data)\b/i, why: 'insider-information framing' },
];

/** Predictive / insider overclaims -> warn (review). */
const contentSafety: Guard = ({ text }) => {
  const findings = OVERCLAIM_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.why);
  return { guardId: 'content-safety', status: findings.length ? 'warn' : 'pass', findings };
};

// --- registry + engine -------------------------------------------------------

/** guardId -> guard. Adding a guard is one entry here; an unknown guardId in a policy fails closed. */
const REGISTRY: Record<string, Guard> = {
  'injection-resistance': injectionResistance,
  grounding,
  'regulated-advice': regulatedAdvice,
  'content-safety': contentSafety,
};

/** The stock-research guard set, in run order. All four run by default. */
export const STOCK_OPS_GUARDS = ['injection-resistance', 'grounding', 'regulated-advice', 'content-safety'] as const;

const worst = (a: GuardStatus, b: GuardStatus): GuardStatus => {
  const rank: Record<GuardStatus, number> = { pass: 0, warn: 1, fail: 2 };
  return rank[a] >= rank[b] ? a : b;
};

/**
 * Run the named guards (default: the full stock-ops set) and fold into one verdict. Worst status
 * wins: any fail -> block, any warn -> review, else allow. An unknown guardId THROWS (fail-closed) -
 * a typo in a policy must never silently skip a guard.
 */
export function evaluateGuardrails(input: GuardInput, guardIds: readonly string[] = STOCK_OPS_GUARDS): GuardrailVerdict {
  const guardResults: GuardResult[] = [];
  let overall: GuardStatus = 'pass';
  for (const id of guardIds) {
    const guard = REGISTRY[id];
    if (!guard) throw new Error(`guardrails: unknown guardId "${id}"`);
    const result = guard(input);
    guardResults.push(result);
    overall = worst(overall, result.status);
  }
  const decision: GuardDecision = overall === 'fail' ? 'block' : overall === 'warn' ? 'review' : 'allow';
  const blockedReasons = guardResults.filter((r) => r.status === 'fail').flatMap((r) => r.findings);
  const warnings = guardResults.filter((r) => r.status === 'warn').flatMap((r) => r.findings);
  return {
    decision,
    safeToProceed: decision !== 'block',
    safeForLiveAction: false,
    guardResults,
    blockedReasons,
    warnings,
  };
}
