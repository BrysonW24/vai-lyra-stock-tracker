import { describe, expect, it } from 'vitest';
import { parseTradeLogIntent } from '../trade-intent';

describe('trade intent parser', () => {
  it('parses a trade amount directed to a ticker', () => {
    expect(parseTradeLogIntent('I made a trade of $5,000 to SPCX')).toEqual({
      side: 'buy',
      symbol: 'SPCX',
      notional: 5000,
    });
  });

  it('parses compact k/m amounts', () => {
    expect(parseTradeLogIntent('I bought $2.5k of nvda')).toEqual({
      side: 'buy',
      symbol: 'NVDA',
      notional: 2500,
    });
    expect(parseTradeLogIntent('allocated 1.2m into MSFT')).toEqual({
      side: 'buy',
      symbol: 'MSFT',
      notional: 1_200_000,
    });
  });

  it('parses ticker-first buys', () => {
    expect(parseTradeLogIntent('I bought spcx for $350')).toEqual({
      side: 'buy',
      symbol: 'SPCX',
      notional: 350,
    });
  });

  it('refuses sells, shorts, options, live trading, and margin language', () => {
    expect(parseTradeLogIntent('I sold $500 of SPCX')).toBeNull();
    expect(parseTradeLogIntent('short $500 SPCX')).toBeNull();
    expect(parseTradeLogIntent('buy $500 SPCX call option')).toBeNull();
    expect(parseTradeLogIntent('place a live trade of $500 to SPCX')).toBeNull();
    expect(parseTradeLogIntent('buy $500 of SPCX on margin')).toBeNull();
  });

  it('ignores non-trade questions', () => {
    expect(parseTradeLogIntent('what do you think about SPCX this week?')).toBeNull();
  });
});
