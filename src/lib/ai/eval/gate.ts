/**
 * The eval-gate - runs the safety golden set (./golden-cases.ts) against the guardrails engine and
 * returns a pass/fail report. This is the certification that Lyra's AI doctrine holds; it is meant
 * to run in CI (via the unit test that wraps it) so a change that weakens a guard turns the build
 * red with the exact case and doctrine it broke.
 *
 * Fail-closed severity: a case that returns LESS restrictive than required (e.g. advice that should
 * block but only reviews/allows) is a `safety-regression` - the dangerous direction. A case that
 * returns MORE restrictive (clean text that blocks) is an `over-block` - a usability regression. The
 * gate reports both; a caller decides whether over-blocks fail the build (the wrapping test does).
 */
import { evaluateGuardrails, type GuardDecision } from '@/lib/ai/guardrails/engine';
import { GOLDEN_CASES, type GoldenCase } from './golden-cases';

const RANK: Record<GuardDecision, number> = { allow: 0, review: 1, block: 2 };

export type FailureKind = 'safety-regression' | 'over-block' | 'wrong-guard';

export interface EvalFailure {
  id: string;
  category: GoldenCase['category'];
  kind: FailureKind;
  expected: GuardDecision;
  actual: GuardDecision;
  protects: string;
  detail: string;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  /** True only when every case matched its expected decision AND was driven by the named guard. */
  ok: boolean;
  failures: EvalFailure[];
}

/**
 * Run every golden case (or a supplied subset) and classify any mismatch. A case passes when the
 * engine returns exactly the expected decision and, for non-clean cases, the named guard actually
 * fired (status !== 'pass'). Otherwise it is recorded as the appropriate failure kind.
 */
export function runEvalGate(cases: readonly GoldenCase[] = GOLDEN_CASES): EvalReport {
  const failures: EvalFailure[] = [];

  for (const c of cases) {
    const verdict = evaluateGuardrails(c.input);
    const actual = verdict.decision;

    if (actual !== c.expect) {
      const kind: FailureKind = RANK[actual] < RANK[c.expect] ? 'safety-regression' : 'over-block';
      failures.push({
        id: c.id,
        category: c.category,
        kind,
        expected: c.expect,
        actual,
        protects: c.protects,
        detail:
          kind === 'safety-regression'
            ? `weaker than required (${actual} < ${c.expect}) - ${c.protects}`
            : `over-restrictive (${actual} > ${c.expect}) - ${c.protects}`,
      });
      continue;
    }

    // Decision matched. For a non-clean case, confirm the NAMED guard is the one that drove it -
    // a right answer for the wrong reason (e.g. advice blocked only because a number was invented)
    // would let the advice guard rot undetected.
    if (c.drivenBy) {
      const guard = verdict.guardResults.find((g) => g.guardId === c.drivenBy);
      const fired = guard && guard.status !== 'pass';
      if (!fired) {
        failures.push({
          id: c.id,
          category: c.category,
          kind: 'wrong-guard',
          expected: c.expect,
          actual,
          protects: c.protects,
          detail: `decision correct but the "${c.drivenBy}" guard did not fire - the guarantee is not actually enforced by its guard`,
        });
      }
    }
  }

  const passed = cases.length - failures.length;
  return { total: cases.length, passed, failed: failures.length, ok: failures.length === 0, failures };
}

/** Just the fail-closed slice: cases whose safety guarantee weakened. Empty means no regressions. */
export function safetyRegressions(report: EvalReport): EvalFailure[] {
  return report.failures.filter((f) => f.kind === 'safety-regression');
}
