import { describe, it, expect } from 'vitest';
import { runEvalGate, safetyRegressions } from '../gate';
import { GOLDEN_CASES } from '../golden-cases';
import type { GoldenCase } from '../golden-cases';

/**
 * The eval-gate is the certification of Lyra's AI doctrine. This test IS the CI gate: if a change
 * weakens a guard, the golden set turns this red with the exact case and doctrine that broke.
 */
describe('ai eval-gate · golden set', () => {
  it('every golden case passes against the current engine (no regressions)', () => {
    const report = runEvalGate();
    // Surface the exact failures if this ever goes red - the message names the broken doctrine.
    if (!report.ok) {
      const lines = report.failures.map((f) => `  [${f.kind}] ${f.id}: ${f.detail}`).join('\n');
      throw new Error(`eval-gate failed ${report.failed}/${report.total}:\n${lines}`);
    }
    expect(report.ok).toBe(true);
    expect(report.passed).toBe(report.total);
    expect(report.total).toBe(GOLDEN_CASES.length);
  });

  it('covers every doctrine category', () => {
    const categories = new Set(GOLDEN_CASES.map((c) => c.category));
    for (const required of ['clean', 'advice', 'injection', 'grounding', 'overclaim']) {
      expect(categories.has(required as GoldenCase['category'])).toBe(true);
    }
  });

  it('each non-clean case names the guard that must enforce it', () => {
    for (const c of GOLDEN_CASES) {
      if (c.category !== 'clean') expect(c.drivenBy).toBeTruthy();
    }
  });

  // --- the gate must itself catch a regression (meta-test) --------------------

  it('flags a SAFETY-REGRESSION when a block case is mislabelled as allow', () => {
    // Simulate a weakened expectation: an advice case that "should allow" (i.e. the guard rotted).
    const rotted: GoldenCase = {
      id: 'rotted-advice',
      category: 'advice',
      input: { text: 'You should buy it now.' },
      expect: 'allow', // WRONG on purpose - the engine still blocks, so actual(block) > expected(allow)...
      drivenBy: 'regulated-advice',
      protects: 'meta-test',
    };
    // NOTE: here the ENGINE is correct (blocks) and the EXPECTATION is wrong, so this is an
    // over-block relative to the (wrong) expectation. To exercise the safety-regression branch we
    // need actual < expected: a case the engine allows but we require to block.
    const shouldBlockButClean: GoldenCase = {
      id: 'meta-safety-regression',
      category: 'advice',
      input: { text: 'The weather is nice today.' }, // engine allows this
      expect: 'block', // we require a block -> actual(allow) < expected(block) = safety regression
      drivenBy: 'regulated-advice',
      protects: 'meta-test',
    };
    const report = runEvalGate([rotted, shouldBlockButClean]);
    expect(report.ok).toBe(false);
    const regressions = safetyRegressions(report);
    expect(regressions.map((r) => r.id)).toContain('meta-safety-regression');
  });

  it('flags a WRONG-GUARD when the right decision comes from the wrong guard', () => {
    // Advice text that also invents a number: it blocks, but via grounding, not regulated-advice
    // when we assert the wrong driver. Here we claim grounding should drive a pure-advice block.
    const wrongGuard: GoldenCase = {
      id: 'meta-wrong-guard',
      category: 'advice',
      input: { text: 'You should buy it now.' }, // blocks via regulated-advice, NOT grounding
      expect: 'block',
      drivenBy: 'grounding', // wrong driver on purpose
      protects: 'meta-test',
    };
    const report = runEvalGate([wrongGuard]);
    expect(report.ok).toBe(false);
    expect(report.failures[0].kind).toBe('wrong-guard');
  });
});
