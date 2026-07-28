/**
 * Output-side guardrails: schema validation, citation enforcement, and
 * fabricated-number detection. [AI-SEC-04]
 *
 * Model output is untrusted until it passes these gates. validateAgentOutput
 * checks the payload against the agent's registry schema (strict objects, so
 * order-shaped fields injected into a trade_readiness payload fail here) and
 * enforces the agent's citation requirement. assertNoFabricatedNumbers catches
 * the most dangerous hallucination class in a finance product: numerals that do
 * not exist in the evidence the model was given.
 *
 * Pure functions, no I/O - everything here is unit-testable in isolation.
 */
import { AGENT_REGISTRY } from '../agents/registry';
import type { AiAgentName } from '../policy';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate an agent's raw output payload against its registered Zod schema.
 * Also enforces at least one citation when the agent's definition requires it.
 */
export function validateAgentOutput(agentName: AiAgentName, payload: unknown): ValidationResult {
  const definition = AGENT_REGISTRY[agentName];
  const errors: string[] = [];

  const parsed = definition.outputSchema.safeParse(payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      errors.push(`${path}: ${issue.message}`);
    }
  }

  if (definition.requiresCitations) {
    const citationCheck = enforceCitations(payload, 1);
    if (!citationCheck.ok) errors.push(...citationCheck.errors);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Require a payload to carry at least minCitations non-empty string citations
 * in a top-level `citations` array. Fail-closed on any unexpected shape.
 */
export function enforceCitations(payload: unknown, minCitations = 1): ValidationResult {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, errors: ['citations: payload is not an object, citations cannot be verified'] };
  }
  const raw = (payload as Record<string, unknown>).citations;
  if (!Array.isArray(raw)) {
    return { ok: false, errors: ['citations: missing or not an array'] };
  }
  const valid = raw.filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
  if (valid.length < minCitations) {
    return { ok: false, errors: [`citations: expected at least ${minCitations}, found ${valid.length}`] };
  }
  return { ok: true, errors: [] };
}

/** Normalise a numeral string to a canonical numeric form ("1,200.50" -> "1200.5"). */
function normaliseNumeral(raw: string): string {
  const stripped = raw.replace(/,/g, '');
  const value = Number(stripped);
  return Number.isFinite(value) ? String(value) : stripped;
}

/**
 * Match a numeral with its magnitude unit, if any: an optional $ prefix and an optional % suffix or
 * x multiple (a standalone x, not the leading letter of a word). The unit is what makes a numeral a
 * FIELD-SPECIFIC claim - "82%" is a different assertion from a bare score of 82 - and the grounding
 * always writes percentages with % and multiples with x, so the unit is safe to hold the output to.
 */
const UNIT_NUMERAL_RE = /(\$)?(\d[\d,]*(?:\.\d+)?)(%|[xX](?![a-zA-Z]))?/g;

/** True if any allow-set entry carries a magnitude unit (a % or x suffix). */
function setHasUnitTokens(allowed: Set<string>): boolean {
  for (const a of allowed) if (a.endsWith('%') || a.endsWith('x')) return true;
  return false;
}

export interface FabricationCheckResult {
  ok: boolean;
  /** Numerals (as written in the output) that are absent from the allowed evidence set. */
  fabricated: string[];
}

/**
 * Flag every numeral in outputText that is not present in the allowed evidence set.
 *
 * Bare numerals are value-based after normalisation, so "1,200.50" in evidence covers "1200.5" in
 * output (and a $-prefixed figure is checked on its value, since currency rounding is legitimate).
 *
 * Numerals carrying a magnitude unit (% or x) are held to that unit (audit V5): "up 82%" is grounded
 * only if "82%" itself is in the evidence, so a bare score of 82 elsewhere no longer licenses a
 * fabricated 82% return claim - the exact value-set collision the audit flagged. To stay safe for
 * bare-only callers (a grounding block with no unit tokens at all), unit checking falls back to the
 * value-based rule when the allow-set contains no unit tokens, so no legitimate figure is over-stripped.
 *
 * The allow-set should be built with groundedNumberTokens (prose.ts), which emits both the bare and
 * the unit-qualified form of each grounding numeral. Pure - exported for direct unit testing.
 */
export function assertNoFabricatedNumbers(outputText: string, allowedNumbers: string[]): FabricationCheckResult {
  const allowed = new Set(allowedNumbers.map(normaliseNumeral));
  const hasUnits = setHasUnitTokens(allowed);

  const fabricated: string[] = [];
  const re = new RegExp(UNIT_NUMERAL_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(outputText)) !== null) {
    const [raw, , value, suffix] = m;
    let grounded: boolean;
    if (suffix === '%' || (suffix && (suffix === 'x' || suffix === 'X'))) {
      const unit = suffix === '%' ? '%' : 'x';
      const unitKey = normaliseNumeral(`${value}${unit}`);
      // Strict unit match when the grounding actually carries units; otherwise fall back to value.
      grounded = allowed.has(unitKey) || (!hasUnits && allowed.has(normaliseNumeral(value)));
    } else {
      grounded = allowed.has(normaliseNumeral(value));
    }
    if (!grounded && !fabricated.includes(raw)) fabricated.push(raw);
  }
  return { ok: fabricated.length === 0, fabricated };
}
