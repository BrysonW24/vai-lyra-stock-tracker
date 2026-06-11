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

/** Matches integers and decimals, with optional thousands separators. */
const NUMERAL_SOURCE = '\\d[\\d,]*(?:\\.\\d+)?';

/** Normalise a numeral string to a canonical numeric form ("1,200.50" -> "1200.5"). */
function normaliseNumeral(raw: string): string {
  const stripped = raw.replace(/,/g, '');
  const value = Number(stripped);
  return Number.isFinite(value) ? String(value) : stripped;
}

export interface FabricationCheckResult {
  ok: boolean;
  /** Numerals (as written in the output) that are absent from the allowed evidence set. */
  fabricated: string[];
}

/**
 * Flag every numeral in outputText that is not present in the allowed evidence
 * set. Comparison is value-based after normalisation, so "1,200.50" in evidence
 * covers "1200.5" in output. Pure - exported for direct unit testing.
 */
export function assertNoFabricatedNumbers(outputText: string, allowedNumbers: string[]): FabricationCheckResult {
  const allowed = new Set(allowedNumbers.map(normaliseNumeral));
  const found = outputText.match(new RegExp(NUMERAL_SOURCE, 'g')) ?? [];

  const fabricated: string[] = [];
  for (const raw of found) {
    if (!allowed.has(normaliseNumeral(raw)) && !fabricated.includes(raw)) {
      fabricated.push(raw);
    }
  }
  return { ok: fabricated.length === 0, fabricated };
}
