import { describe, expect, it } from 'vitest';
import { groundedNumberTokens, guardProse, numeralsIn, stripFabricatedSentences } from '../prose';
import { assertNoFabricatedNumbers } from '../schema';

const GROUNDING = [
  'CONTEXT: NVDA score 82/100, RSI 41.3, price 131.20, 60-period low 120.10.',
  'User: I bought NVDA at 118.',
];

describe('numeralsIn', () => {
  it('extracts integers, decimals, and thousands-separated numerals', () => {
    expect(numeralsIn('score 82 price 1,240.50 and 41.3')).toEqual(['82', '1,240.50', '41.3']);
  });
});

describe('groundedNumberTokens (unit-aware allow-set, audit V5)', () => {
  it('emits the bare value AND the unit-qualified token for %, x, and $', () => {
    // Tokens are raw (commas preserved); normalisation to a canonical numeric form happens at
    // comparison time inside assertNoFabricatedNumbers, so grounding and output tokens still match.
    expect(groundedNumberTokens('weight 12% vol 1.5x value $1,640.00')).toEqual([
      '12',
      '12%',
      '1.5',
      '1.5x',
      '1,640.00',
      '$1,640.00',
    ]);
  });

  it('emits only the bare value for a plain number (a score never licenses a percent)', () => {
    expect(groundedNumberTokens('score 82/100')).toEqual(['82', '100']);
  });
});

describe('assertNoFabricatedNumbers unit-awareness (audit V5)', () => {
  it('flags a fabricated percent that only collides with a bare score', () => {
    // Grounding has the score 82 but no 82% figure; "up 82%" must NOT be licensed by the bare 82.
    const allowed = groundedNumberTokens('NVDA score 82, weight 12%');
    const check = assertNoFabricatedNumbers('NVDA is up 82% this year', allowed);
    expect(check.ok).toBe(false);
    expect(check.fabricated).toContain('82%');
  });

  it('passes a percent that is genuinely grounded with its unit', () => {
    const allowed = groundedNumberTokens('NVDA score 82, weight 12%');
    expect(assertNoFabricatedNumbers('its weight is 12%', allowed).ok).toBe(true);
  });

  it('passes a grounded x multiple and flags an ungrounded one', () => {
    const allowed = groundedNumberTokens('vol 1.5x');
    expect(assertNoFabricatedNumbers('volume is 1.5x average', allowed).ok).toBe(true);
    expect(assertNoFabricatedNumbers('volume is 3x average', allowed).fabricated).toContain('3x');
  });

  it('still grounds bare restated numbers (no over-stripping of plain figures)', () => {
    const allowed = groundedNumberTokens('score 82, RSI 41.3');
    expect(assertNoFabricatedNumbers('the score is 82 with RSI 41.3', allowed).ok).toBe(true);
  });

  it('falls back to value-based when the grounding carries no unit tokens (bare-only callers)', () => {
    // A legacy/bare-only allow-set (e.g. genui metrics) must not start flagging legitimate percents.
    expect(assertNoFabricatedNumbers('up 82%', ['82']).ok).toBe(true);
  });
});

describe('guardProse unit-aware grounding (audit V5)', () => {
  it('strips a fabricated return claim that reuses a bare score as a percent', () => {
    // Realistic chat grounding carries percentages (macro / portfolio weight), so unit-strict mode
    // applies: the bare score 82 no longer licenses a fabricated "up 82%" return claim.
    const grounding = [...GROUNDING, 'MACRO: S&P500 +0.4%, portfolio weight 12%.'];
    const result = guardProse('NVDA scores 82/100. It is up 82% this year.', grounding);
    expect(result.text).toContain('82/100');
    expect(result.text).not.toContain('up 82%');
    expect(result.strippedFigures).toContain('82%');
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
