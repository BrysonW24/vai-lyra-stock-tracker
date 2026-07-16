import { describe, expect, it } from 'vitest';
import { guardProse, numeralsIn, stripFabricatedSentences } from '../prose';

const GROUNDING = [
  'CONTEXT: NVDA score 82/100, RSI 41.3, price 131.20, 60-period low 120.10.',
  'User: I bought NVDA at 118.',
];

describe('numeralsIn', () => {
  it('extracts integers, decimals, and thousands-separated numerals', () => {
    expect(numeralsIn('score 82 price 1,240.50 and 41.3')).toEqual(['82', '1,240.50', '41.3']);
  });
});

describe('stripFabricatedSentences', () => {
  it('keeps grounded sentences and drops fabricated-digit sentences', () => {
    const text = 'NVDA scores 82/100 with RSI 41.3. The P/E ratio is 74.5 which is rich.';
    const result = stripFabricatedSentences(text, numeralsIn(GROUNDING.join('\n')));
    expect(result.text).toContain('82/100');
    expect(result.text).not.toContain('74.5');
    expect(result.fabricated).toContain('74.5');
  });

  it('drops spelled-out magnitude claims the digit guard cannot see', () => {
    const text = 'NVDA scores 82/100. It could easily double from here. RSI sits at 41.3.';
    const result = stripFabricatedSentences(text, numeralsIn(GROUNDING.join('\n')));
    expect(result.text).not.toContain('double');
    expect(result.text).toContain('RSI sits at 41.3');
    expect(result.fabricated.length).toBeGreaterThan(0);
  });
});

describe('guardProse - the chat/brief output gate', () => {
  it('passes a fully grounded answer through unchanged', () => {
    const answer = 'NVDA scores 82/100 - the RSI of 41.3 sits inside the reset band, with price 131.20 near the 120.10 low.';
    const result = guardProse(answer, GROUNDING);
    expect(result.ok).toBe(true);
    expect(result.text).toBe(answer);
    expect(result.strippedFigures).toEqual([]);
  });

  it('lets the model echo a number the USER supplied', () => {
    const result = guardProse('From your 118 entry, price 131.20 means the position is up.', GROUNDING);
    expect(result.ok).toBe(true);
  });

  it('repairs fabrication by stripping the sentence, not the whole answer', () => {
    const answer = 'NVDA scores 82/100. Its market cap is 3.2 trillion dollars. The RSI of 41.3 is in the reset band.';
    const result = guardProse(answer, GROUNDING);
    expect(result.ok).toBe(true);
    expect(result.text).not.toContain('3.2');
    expect(result.text).toContain('82/100');
    expect(result.strippedFigures).toContain('3.2');
  });

  it('blocks directive advice even when every number is grounded', () => {
    const result = guardProse('NVDA scores 82/100 - you should buy it now before it moves.', GROUNDING);
    expect(result.ok).toBe(false);
    expect(result.verdict.blockedReasons.join(' ')).toMatch(/advice|buy/i);
  });

  it('refuses when nothing survives the strip', () => {
    const result = guardProse('The market cap is 3.2 trillion at a P/E of 74.5.', GROUNDING);
    expect(result.ok).toBe(false);
    expect(result.text).toBe('');
  });
});
