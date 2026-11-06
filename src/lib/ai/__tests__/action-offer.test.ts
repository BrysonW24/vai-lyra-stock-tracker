/**
 * The code-written offer that goes with a confirm card. Pins that it is only made for an action
 * the reader asked for in so many words, and that its own wording passes the guards that stopped
 * the model's.
 */
import { describe, expect, it } from 'vitest';
import { explicitlyAsked, offerText, type OfferedAction } from '../action-offer';
import { adviceFindings, predictionFindings } from '../guardrails/engine';
import { guardProse } from '../guardrails/prose';

const ACTIONS: OfferedAction[] = [
  { type: 'add_watchlist', symbol: 'NVDA' },
  { type: 'add_portfolio', symbol: 'BRK.B' },
  { type: 'log_trade', symbol: 'AMD', notional: 1500 },
];

describe('offerText', () => {
  it('passes the advice and forecast checks that stop the model saying the same thing', () => {
    // What a model writes for this, and why it cannot be shown.
    expect(adviceFindings('Add NVDA to your watchlist? Tap confirm below.')).not.toEqual([]);
    for (const action of ACTIONS) {
      const text = offerText(action);
      expect(adviceFindings(text), text).toEqual([]);
      expect(predictionFindings(text), text).toEqual([]);
      // The log-a-buy offer quotes the amount the reader typed, so that is the context it is checked in.
      expect(guardProse(text, [`log a $1,500 buy in ${action.symbol}`]).ok, text).toBe(true);
    }
  });

  it('names the ticker and the amount, and nothing about the stock itself', () => {
    expect(offerText(ACTIONS[0])).toBe('I can add NVDA to your watchlist. Confirm below and it is done - you can undo it.');
    expect(offerText(ACTIONS[2])).toContain('a $1,500 buy in AMD');
  });
});

describe('explicitlyAsked', () => {
  it('is true only when the reader named the ticker and asked for the action', () => {
    expect(explicitlyAsked('add nvda to my watchlist', ACTIONS[0])).toBe(true);
    expect(explicitlyAsked('Can you track NVDA for me?', ACTIONS[0])).toBe(true);
    expect(explicitlyAsked('log a $1,500 buy in AMD', ACTIONS[2])).toBe(true);
    expect(explicitlyAsked('put BRK.B in my portfolio', ACTIONS[1])).toBe(true);
  });

  it('is false for a question, another ticker, or a ticker inside another word', () => {
    expect(explicitlyAsked('Should I buy NVDA?', ACTIONS[0])).toBe(false);
    expect(explicitlyAsked('What does the score say about NVDA?', ACTIONS[0])).toBe(false);
    expect(explicitlyAsked('add AMD to my watchlist', ACTIONS[0])).toBe(false);
    expect(explicitlyAsked('add NVDAX to my watchlist', ACTIONS[0])).toBe(false);
    expect(explicitlyAsked('put BRKXB in my portfolio', ACTIONS[1])).toBe(false);
    expect(explicitlyAsked('', ACTIONS[0])).toBe(false);
  });

  it('never builds a pattern from something that is not shaped like a ticker', () => {
    expect(explicitlyAsked('add (.*) to my watchlist', { type: 'add_watchlist', symbol: '(.*)' })).toBe(false);
  });
});
