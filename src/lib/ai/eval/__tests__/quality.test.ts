import { describe, it, expect } from 'vitest';
import { scoreAnswerQuality, looksLikeRefusal } from '../groundedness';
import { runQualityGate } from '../quality-gate';
import { QUALITY_CASES } from '../quality-cases';

/**
 * This is the answer-QUALITY CI gate. Unlike the safety eval-gate, it asserts the AI is GOOD:
 * grounded, correctly cited, on-topic, and refuses when it should. If a change lets a fabricated or
 * uncited or advice answer score as good - or rejects a correct one - this goes red with the case.
 */
describe('ai quality gate · golden set', () => {
  it('every reference good answer passes and every bad answer fails', () => {
    const report = runQualityGate();
    if (!report.ok) {
      const lines = report.failures
        .map((f) => {
          const bits: string[] = [];
          if (!f.goodPassed) bits.push(`good FAILED (${f.goodComposite}): ${f.goodFailures.join('; ')}`);
          if (f.badThatPassed.length) bits.push(`bad WRONGLY passed: ${f.badThatPassed.map((b) => b.label).join(', ')}`);
          return `  ${f.id}: ${bits.join(' | ')}`;
        })
        .join('\n');
      throw new Error(`quality gate failed ${report.failures.length}/${report.total}:\n${lines}`);
    }
    expect(report.ok).toBe(true);
    expect(report.total).toBe(QUALITY_CASES.length);
    // Good answers should be clearly good, not scraping the 0.8 line.
    expect(report.meanGoodComposite).toBeGreaterThanOrEqual(0.85);
  });

  it('covers explain, definition, convergence and refusal categories', () => {
    const cats = new Set(QUALITY_CASES.map((c) => c.category));
    for (const required of ['grounded-explain', 'definition', 'convergence', 'refusal']) {
      expect(cats.has(required as never)).toBe(true);
    }
  });
});

describe('ai quality scorer · groundedness discrimination', () => {
  const ctx = {
    groundingText: 'MP scores 72 with RSI 41 in the 35-50 band.',
    availableIds: ['company:MP'],
    mustContain: ['72'],
  };

  it('rewards a grounded, cited, on-topic answer', () => {
    const s = scoreAnswerQuality({ text: 'MP scores 72 with RSI 41.', citations: ['company:MP'] }, ctx);
    expect(s.pass).toBe(true);
    expect(s.groundedness).toBe(1);
    expect(s.citationPrecision).toBe(1);
  });

  it('hard-fails a fabricated numeral even if everything else is perfect', () => {
    const s = scoreAnswerQuality({ text: 'MP scores 72 with a $999 target.', citations: ['company:MP'] }, ctx);
    expect(s.pass).toBe(false);
    expect(s.groundedness).toBeLessThan(1);
    expect(s.failures.join(' ')).toMatch(/ungrounded numerals/);
  });

  it('hard-fails an invalid citation', () => {
    const s = scoreAnswerQuality({ text: 'MP scores 72.', citations: ['company:FAKE'] }, ctx);
    expect(s.pass).toBe(false);
    expect(s.citationPrecision).toBeLessThan(1);
  });

  it('hard-fails an uncited answer', () => {
    const s = scoreAnswerQuality({ text: 'MP scores 72.', citations: [] }, ctx);
    expect(s.pass).toBe(false);
    expect(s.failures).toContain('no citations');
  });

  it('hard-fails an advice answer via the guardrails verdict', () => {
    const s = scoreAnswerQuality({ text: 'MP scores 72 - you should buy it now.', citations: ['company:MP'] }, ctx);
    expect(s.pass).toBe(false);
    expect(s.safe).toBe(false);
  });

  it('penalises missing required coverage', () => {
    const s = scoreAnswerQuality({ text: 'MP is turning up.', citations: ['company:MP'] }, ctx);
    expect(s.coverage).toBeLessThan(1);
  });
});

describe('ai quality scorer · refusal handling', () => {
  const refusalCtx = { groundingText: 'Lyra is research only.', availableIds: ['edu:score'], expectRefusal: true };

  it('passes a proper refusal', () => {
    const s = scoreAnswerQuality({ text: 'I can not help with that - Lyra is research only.', citations: [] }, refusalCtx);
    expect(s.pass).toBe(true);
  });

  it('fails an answer that gives advice instead of refusing', () => {
    const s = scoreAnswerQuality({ text: 'Yes, buy it now with everything.', citations: ['company:NVDA'] }, refusalCtx);
    expect(s.pass).toBe(false);
  });

  it('looksLikeRefusal is true for empty/short refusals and false for long substantive answers', () => {
    expect(looksLikeRefusal('')).toBe(true);
    expect(looksLikeRefusal('That is out of scope for Lyra.')).toBe(true);
    expect(looksLikeRefusal('MP Materials scores 72 because RSI is 41 and the histogram is improving, and the Department of Defense named it in an award, which is a strong convergence of independent signals worth watching closely over the coming weeks as the thesis develops further.')).toBe(false);
  });
});
