/**
 * The code-written offer that goes with a confirm card. Pins that it is only ever a record-keeping
 * action (never a buy), only one the reader asked for in so many words, and that its own wording
 * passes the guards that stopped the model's.
 */
import { describe, expect, it } from 'vitest';
import { explicitlyAsked, isOfferable, offerText, type OfferedAction } from '../action-offer';
import { adviceFindings, predictionFindings } from '../guardrails/engine';
import { guardProse } from '../guardrails/prose';

const WATCH: OfferedAction = { type: 'add_watchlist', symbol: 'NVDA' };
const HOLD: OfferedAction = { type: 'add_portfolio', symbol: 'BRK.B' };

describe('isOfferable', () => {
  it('lets code offer a watchlist or portfolio entry, and never a buy', () => {
    expect(isOfferable(WATCH)).toBe(true);
    expect(isOfferable(HOLD)).toBe(true);
    // A model-proposed buy carries an amount the model chose. Shown after the guard stopped the
    // model's advice, that card would be a position size delivered by code.
    expect(isOfferable({ type: 'log_trade', symbol: 'NVDA' })).toBe(false);
    expect(isOfferable({ type: 'sell_everything', symbol: 'NVDA' })).toBe(false);
  });
});

describe('offerText', () => {
  it('passes the advice and forecast checks that stop the model saying the same thing', () => {
    // What a model writes for this, and why it cannot be shown.
    expect(adviceFindings('Add NVDA to your watchlist? Tap confirm below.')).not.toEqual([]);
    for (const action of [WATCH, HOLD]) {
      const text = offerText(action);
      expect(adviceFindings(text), text).toEqual([]);
      expect(predictionFindings(text), text).toEqual([]);
      expect(guardProse(text, [`add ${action.symbol}`]).ok, text).toBe(true);
    }
  });

  it('names the ticker, and nothing about the stock itself', () => {
    expect(offerText(WATCH)).toBe('I can add NVDA to your watchlist. Confirm below and it is done - you can undo it.');
    expect(offerText(HOLD)).toContain('I can add BRK.B to your portfolio so Lyra tracks it.');
  });
});

describe('explicitlyAsked', () => {
  it('is true when the reader named the ticker and said where it is to go', () => {
    expect(explicitlyAsked('add nvda to my watchlist', WATCH)).toBe(true);
    expect(explicitlyAsked('Can you track NVDA for me?', WATCH)).toBe(true);
    expect(explicitlyAsked('watch NVDA please', WATCH)).toBe(true);
    expect(explicitlyAsked('put BRK.B in my portfolio', HOLD)).toBe(true);
    expect(explicitlyAsked('Add BRK.B to my holdings - I own 10 shares', HOLD)).toBe(true);
  });

  it('is false for a question about buying, however it is worded', () => {
    // "add" here means "buy more": no watchlist and no portfolio is named, so nothing is offered.
    expect(explicitlyAsked('Should I add NVDA? How much would you put in?', WATCH)).toBe(false);
    expect(explicitlyAsked('Should I add NVDA? How much would you put in?', { type: 'add_portfolio', symbol: 'NVDA' })).toBe(false);
    expect(explicitlyAsked('Should I buy NVDA?', WATCH)).toBe(false);
    expect(explicitlyAsked('What does the score say about NVDA?', WATCH)).toBe(false);
    expect(explicitlyAsked('Is BRK.B a good portfolio stock?', HOLD)).toBe(false);
  });

  it('is false for another ticker, or a ticker inside another word', () => {
    expect(explicitlyAsked('add AMD to my watchlist', WATCH)).toBe(false);
    expect(explicitlyAsked('add NVDAX to my watchlist', WATCH)).toBe(false);
    expect(explicitlyAsked('put BRKXB in my portfolio', HOLD)).toBe(false);
    expect(explicitlyAsked('', WATCH)).toBe(false);
  });

  it('never builds a pattern from something that is not shaped like a ticker', () => {
    expect(explicitlyAsked('add (.*) to my watchlist', { type: 'add_watchlist', symbol: '(.*)' })).toBe(false);
  });
});
