/**
 * The answer-quality gate - runs the labelled Q&A golden set through the deterministic quality scorer
 * and checks two things per case: the reference GOOD answer passes, and every BAD answer fails. That
 * makes the scorer itself falsifiable - it must reward a grounded, cited, on-topic answer AND reject
 * fabrication, invalid citations, advice, missing coverage, and wrong refusals. The wrapping test is
 * the CI gate; this function is also reusable to score real production answers offline.
 */
import { scoreAnswerQuality } from './groundedness';
import { QUALITY_CASES, type QualityCase } from './quality-cases';

export interface QualityCaseResult {
  id: string;
  category: QualityCase['category'];
  goodPassed: boolean;
  goodComposite: number;
  goodFailures: string[];
  /** Bad answers that WRONGLY passed the scorer (should be empty). */
  badThatPassed: Array<{ label: string; composite: number }>;
}

export interface QualityReport {
  total: number;
  ok: boolean;
  /** Mean composite of the reference good answers - a headline "how good is good". */
  meanGoodComposite: number;
  results: QualityCaseResult[];
  failures: QualityCaseResult[];
}

/** Run the quality gate over the golden set (or a subset). */
export function runQualityGate(cases: readonly QualityCase[] = QUALITY_CASES): QualityReport {
  const results: QualityCaseResult[] = cases.map((c) => {
    const good = scoreAnswerQuality(c.goodAnswer, c);
    const badThatPassed = c.badAnswers
      .map((b) => ({ label: b.label, score: scoreAnswerQuality({ text: b.text, citations: b.citations }, c) }))
      .filter((b) => b.score.pass)
      .map((b) => ({ label: b.label, composite: b.score.composite }));
    return {
      id: c.id,
      category: c.category,
      goodPassed: good.pass,
      goodComposite: good.composite,
      goodFailures: good.failures,
      badThatPassed,
    };
  });

  const failures = results.filter((r) => !r.goodPassed || r.badThatPassed.length > 0);
  const meanGoodComposite =
    results.reduce((sum, r) => sum + r.goodComposite, 0) / Math.max(1, results.length);

  return {
    total: cases.length,
    ok: failures.length === 0,
    meanGoodComposite: Math.round(meanGoodComposite * 1000) / 1000,
    results,
    failures,
  };
}
