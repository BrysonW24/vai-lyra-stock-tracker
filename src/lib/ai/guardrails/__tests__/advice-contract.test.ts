/**
 * contracts/guardrails/advice.json is read by BOTH guards: the workers' (ai_read_guard.py) and
 * this one. This runs the contract's own test sentences through the app's side, so a pattern that
 * means one thing in Python and another in JavaScript fails here rather than in a reader's chat.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { adviceFindings, GUARDRAILS_VERSION, predictionFindings } from '../engine';
import { guardProse, stripPredictions } from '../prose';

const contract = JSON.parse(readFileSync(new URL('../../../../../contracts/guardrails/advice.json', import.meta.url), 'utf8')) as {
  advice: Array<{ id: string; pattern: string; flags: string; why: string }>;
  prediction: Array<{ id: string; pattern: string; flags: string; why: string }>;
  vectors: Record<string, string[]>;
};

/** Sentences only the `future-time` rule catches. Chat may state a scheduled date from the
 * dashboard, so that rule is the one part of the contract this side does not apply. */
const DATE_ONLY = new Set(['Going forward, breadth matters most.', 'Over the next few sessions breadth matters.', 'In the near term the group stays weak.']);

describe('the shared advice contract, on the app side', () => {
  it.each(contract.vectors.advice_blocks)('blocks advice: %s', (sentence) => {
    expect(adviceFindings(sentence).length).toBeGreaterThan(0);
  });

  it.each(contract.vectors.advice_passes)('lets description through: %s', (sentence) => {
    expect(adviceFindings(sentence)).toEqual([]);
  });

  it.each(contract.vectors.prediction_removes.filter((sentence) => !DATE_ONLY.has(sentence)))('removes a forecast: %s', (sentence) => {
    expect(predictionFindings(sentence).length).toBeGreaterThan(0);
  });

  it.each(contract.vectors.prediction_keeps)('keeps what happened: %s', (sentence) => {
    expect(predictionFindings(sentence)).toEqual([]);
  });

  it('does not treat a scheduled date as a forecast in chat', () => {
    for (const sentence of DATE_ONLY) expect(predictionFindings(sentence)).toEqual([]);
    expect(predictionFindings('NVDA reports earnings tomorrow.')).toEqual([]);
  });

  it('compiles every pattern with the flags the contract states', () => {
    for (const entry of [...contract.advice, ...contract.prediction]) {
      expect(['i', '']).toContain(entry.flags);
      expect(() => new RegExp(entry.pattern, entry.flags)).not.toThrow();
      expect(entry.pattern).not.toMatch(/\(\?<|\(\?P|\(\?i/);
    }
    expect(GUARDRAILS_VERSION).toBe(3);
  });
});

describe('guardProse with the shared contract', () => {
  const GROUNDING = ['NVDA: score 82, strong setup. AMD: score 48, weakening. Breadth 1 up, 60 down.'];

  it('blocks the whole answer for advice, even in a sentence it would have stripped anyway', () => {
    // 9.9% is not in the grounding, so this sentence would be stripped - and its advice with it.
    const laundered = guardProse('NVDA is a strong setup with a score of 82. AMD rose 9.9%, so you should buy it now.', GROUNDING);
    expect(laundered.ok).toBe(false);
    expect(laundered.text).toBe('');
    expect(laundered.verdict.blockedReasons.join(' ')).toMatch(/advice|instruction/);
    expect(guardProse('NVDA is a strong setup with a score of 82. Buy NVDA now.', GROUNDING).ok).toBe(false);
    expect(guardProse('Investors should consider adding to NVDA, which has a score of 82.', GROUNDING).ok).toBe(false);
  });

  it('removes a sentence that forecasts and keeps the rest', () => {
    const guarded = guardProse('NVDA is a strong setup with a score of 82. It is likely to rebound from here. AMD is weakening at 48.', GROUNDING);
    expect(guarded.ok).toBe(true);
    expect(guarded.text).toBe('NVDA is a strong setup with a score of 82. AMD is weakening at 48.');
    expect(guarded.removedPredictions).toEqual(['predicts a move', 'says what is likely']);
    expect(stripPredictions('Breadth was 1 up, 60 down.')).toEqual({ text: 'Breadth was 1 up, 60 down.', removed: [] });
  });

  it('refuses when a forecast was all there was', () => {
    const guarded = guardProse('The selling could continue.', GROUNDING);
    expect(guarded.ok).toBe(false);
    expect(guarded.removedPredictions.length).toBe(1);
  });

  it('still passes a plain grounded answer unchanged', () => {
    const text = 'NVDA is a strong setup with a score of 82, while AMD is weakening at 48. Breadth was narrow, with 1 up and 60 down.';
    expect(guardProse(text, GROUNDING)).toMatchObject({ ok: true, text, strippedFigures: [], removedPredictions: [] });
  });
});
