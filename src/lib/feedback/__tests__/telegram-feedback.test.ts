import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_PREFIX,
  PILLAR_NAMES,
  TELEGRAM_ALLOWED_UPDATES,
  generationFromMarkup,
  nextStep,
  notedKeyboard,
  parseFeedbackData,
  reasonKeyboard,
  voteKeyboard,
} from '../telegram-feedback';

const ID = '0b8f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4';
const contract = JSON.parse(readFileSync(new URL('../../../../contracts/feedback/telegram-feedback.json', import.meta.url), 'utf8'));

describe('telegram feedback buttons', () => {
  it('builds the first row exactly as the workers do (workers/stock_scanner/feedback.py)', () => {
    expect(voteKeyboard(ID)).toEqual({
      inline_keyboard: [[{ text: '👍 Useful', callback_data: `fb:${ID}:u` }, { text: '👎 Not for me', callback_data: `fb:${ID}:d` }]],
    });
    expect(FEEDBACK_PREFIX).toBe('fb');
    expect(TELEGRAM_ALLOWED_UPDATES).toEqual(['message', 'callback_query']);
  });

  it('parses only its own closed grammar', () => {
    expect(parseFeedbackData(`fb:${ID}:u`)).toEqual({ kind: 'rate', generationId: ID, rating: 'up' });
    expect(parseFeedbackData(`fb:${ID}:d:cla`)).toEqual({ kind: 'reason', generationId: ID, rating: 'down', pillar: 'clarity' });
    expect(parseFeedbackData(`fb:${ID}:u:-`)).toEqual({ kind: 'reason', generationId: ID, rating: 'up', pillar: null });
    expect(parseFeedbackData(`fb:${ID}:c`)).toEqual({ kind: 'change', generationId: ID });
    for (const bad of [undefined, '', 'fb', `xx:${ID}:u`, 'fb:not-a-uuid:u', `fb:${ID}:x`, `fb:${ID}:d:zzz`, `fb:${ID}:c:rel`, `fb:${ID}:u:rel:extra`, `fb:${ID.toUpperCase()}:u`]) {
      expect(parseFeedbackData(bad)).toBeNull();
    }
  });

  it('offers the six pillars as reasons, then a noted button that keeps the generation on the message', () => {
    for (const rating of ['up', 'down'] as const) {
      const keyboard = reasonKeyboard(ID, rating);
      const step = rating === 'up' ? 'u' : 'd';
      expect(keyboard.inline_keyboard.map((row) => row.length)).toEqual([3, 3, 1]);
      const chips = keyboard.inline_keyboard.slice(0, 2).flat();
      expect(chips.map((chip) => chip.text)).toEqual(contract.reasons[step].chips.map(([, text]: [string, string]) => text));
      const pillars = chips.map((chip) => (parseFeedbackData(chip.callback_data) as { pillar: string }).pillar);
      expect([...pillars].sort()).toEqual([...PILLAR_NAMES].sort());
      expect(keyboard.inline_keyboard[2][0]).toEqual({ text: 'Skip', callback_data: `fb:${ID}:${step}:-` });
      for (const button of keyboard.inline_keyboard.flat()) expect(new TextEncoder().encode(button.callback_data).length).toBeLessThanOrEqual(64);
    }
    expect(nextStep({ kind: 'rate', generationId: ID, rating: 'down' })).toEqual({ toast: 'Thanks. What fell short?', keyboard: reasonKeyboard(ID, 'down') });
    expect(nextStep({ kind: 'reason', generationId: ID, rating: 'down', pillar: 'insight' })).toEqual({ toast: 'Thanks - noted.', keyboard: notedKeyboard(ID) });
    expect(nextStep({ kind: 'change', generationId: ID })).toEqual({ toast: '', keyboard: voteKeyboard(ID) });
  });

  it('finds the generation a replied-to message came from, whatever step its buttons are at', () => {
    expect(generationFromMarkup(voteKeyboard(ID))).toBe(ID);
    expect(generationFromMarkup(reasonKeyboard(ID, 'up'))).toBe(ID);
    expect(generationFromMarkup(notedKeyboard(ID))).toBe(ID);
    expect(generationFromMarkup({ inline_keyboard: [[{ callback_data: 'other:thing' }]] })).toBeNull();
    expect(generationFromMarkup(undefined)).toBeNull();
  });

  it('writes plain hyphens, never an em or en dash', () => {
    const text = JSON.stringify(contract);
    expect(text).not.toMatch(/[–—]/);
  });
});
