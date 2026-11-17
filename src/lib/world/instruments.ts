/**
 * The world board - every instrument Lyra reads to say how markets moved outside the scanned US
 * technology list: the regional indices of Asia, Europe, the US and Australia, the technology
 * leaders of each region, the sector funds that show a technology or small-cap move, the US index
 * futures that show how New York is set before it opens, and the macro gauges (volatility, the US
 * 10-year yield, the Australian dollar, gold, oil, bitcoin).
 *
 * Every symbol here was checked against Yahoo's daily chart on 2026-11-18 (the same source the
 * live signals read). Two that answered with a single bar - the Hang Seng TECH index and the
 * CSI 300 - were left out; KWEB stands in for Chinese internet shares and the Shanghai Composite
 * for the mainland.
 *
 * This is data, not opinion: the list says what is read, never what to buy. Adding a name here is
 * the whole change - the snapshot, the read and the chat all take it from this list.
 */

export type WorldRegion = 'asia' | 'europe' | 'us' | 'australia' | 'macro';

export type InstrumentKind = 'index' | 'stock' | 'fund' | 'future' | 'rate' | 'fx' | 'commodity' | 'crypto' | 'volatility';

export interface WorldInstrument {
  /** Yahoo symbol. */
  symbol: string;
  /** The name a reader knows it by. */
  label: string;
  region: WorldRegion;
  /** The country or market it trades for, for the read's wording. */
  market: string;
  kind: InstrumentKind;
  /** A technology bellwether or technology index - counted in its region's tech pulse. */
  tech?: boolean;
  /** Small companies - the small-cap line of the read. */
  smallCap?: boolean;
  /** What people type when they ask about it (matched case-insensitively). */
  aliases?: readonly string[];
}

export const WORLD_INSTRUMENTS: readonly WorldInstrument[] = [
  // Asia - the session that opens the day
  { symbol: '^N225', label: 'Nikkei 225', region: 'asia', market: 'Japan', kind: 'index', aliases: ['nikkei', 'japan'] },
  { symbol: '^KS11', label: 'KOSPI', region: 'asia', market: 'Korea', kind: 'index', aliases: ['kospi', 'korea'] },
  { symbol: '^HSI', label: 'Hang Seng', region: 'asia', market: 'Hong Kong', kind: 'index', aliases: ['hang seng', 'hong kong', 'hsi'] },
  { symbol: '000001.SS', label: 'Shanghai Composite', region: 'asia', market: 'China', kind: 'index', aliases: ['shanghai', 'china', 'chinese'] },
  { symbol: '^TWII', label: 'Taiex', region: 'asia', market: 'Taiwan', kind: 'index', aliases: ['taiex', 'taiwan'] },
  { symbol: '2330.TW', label: 'TSMC', region: 'asia', market: 'Taiwan', kind: 'stock', tech: true, aliases: ['tsmc', 'taiwan semiconductor', 'tsm'] },
  { symbol: '005930.KS', label: 'Samsung Electronics', region: 'asia', market: 'Korea', kind: 'stock', tech: true, aliases: ['samsung'] },
  { symbol: '000660.KS', label: 'SK Hynix', region: 'asia', market: 'Korea', kind: 'stock', tech: true, aliases: ['sk hynix', 'hynix'] },
  { symbol: '8035.T', label: 'Tokyo Electron', region: 'asia', market: 'Japan', kind: 'stock', tech: true, aliases: ['tokyo electron'] },
  { symbol: '6857.T', label: 'Advantest', region: 'asia', market: 'Japan', kind: 'stock', tech: true, aliases: ['advantest'] },
  { symbol: '9984.T', label: 'SoftBank Group', region: 'asia', market: 'Japan', kind: 'stock', tech: true, aliases: ['softbank'] },
  { symbol: '0700.HK', label: 'Tencent', region: 'asia', market: 'Hong Kong', kind: 'stock', tech: true, aliases: ['tencent'] },
  { symbol: '9988.HK', label: 'Alibaba', region: 'asia', market: 'Hong Kong', kind: 'stock', tech: true, aliases: ['alibaba', 'baba'] },
  { symbol: '1810.HK', label: 'Xiaomi', region: 'asia', market: 'Hong Kong', kind: 'stock', tech: true, aliases: ['xiaomi'] },

  // Europe
  { symbol: '^STOXX', label: 'STOXX Europe 600', region: 'europe', market: 'Europe', kind: 'index', aliases: ['stoxx', 'europe', 'european'] },
  { symbol: '^GDAXI', label: 'DAX', region: 'europe', market: 'Germany', kind: 'index', aliases: ['dax', 'germany', 'german'] },
  { symbol: '^FTSE', label: 'FTSE 100', region: 'europe', market: 'UK', kind: 'index', aliases: ['ftse', 'london', 'uk'] },
  { symbol: '^FCHI', label: 'CAC 40', region: 'europe', market: 'France', kind: 'index', aliases: ['cac', 'france', 'paris'] },
  { symbol: 'ASML.AS', label: 'ASML', region: 'europe', market: 'Netherlands', kind: 'stock', tech: true, aliases: ['asml'] },
  { symbol: 'SAP.DE', label: 'SAP', region: 'europe', market: 'Germany', kind: 'stock', tech: true, aliases: ['sap'] },
  { symbol: 'IFX.DE', label: 'Infineon', region: 'europe', market: 'Germany', kind: 'stock', tech: true, aliases: ['infineon'] },

  // United States
  { symbol: '^GSPC', label: 'S&P 500', region: 'us', market: 'US', kind: 'index', aliases: ['s&p', 'sp500', 's&p 500', 'spx'] },
  { symbol: '^NDX', label: 'Nasdaq 100', region: 'us', market: 'US', kind: 'index', aliases: ['nasdaq', 'ndx', 'qqq'] },
  { symbol: '^DJI', label: 'Dow Jones', region: 'us', market: 'US', kind: 'index', aliases: ['dow'] },
  { symbol: '^RUT', label: 'Russell 2000', region: 'us', market: 'US', kind: 'index', smallCap: true, aliases: ['russell', 'small caps', 'small cap', 'iwm'] },
  { symbol: '^SOX', label: 'US semiconductors (SOX)', region: 'us', market: 'US', kind: 'index', tech: true, aliases: ['sox', 'semis', 'semiconductors', 'chips', 'smh'] },
  { symbol: 'XLK', label: 'US tech sector (XLK)', region: 'us', market: 'US', kind: 'fund', tech: true, aliases: ['xlk', 'tech sector'] },
  { symbol: 'IGV', label: 'US software (IGV)', region: 'us', market: 'US', kind: 'fund', tech: true, aliases: ['igv', 'software'] },
  { symbol: 'KWEB', label: 'China internet (KWEB)', region: 'us', market: 'China, US-listed', kind: 'fund', tech: true, aliases: ['kweb', 'china internet', 'china tech'] },
  { symbol: 'ES=F', label: 'S&P 500 futures', region: 'us', market: 'US', kind: 'future', aliases: ['futures', 's&p futures'] },
  { symbol: 'NQ=F', label: 'Nasdaq 100 futures', region: 'us', market: 'US', kind: 'future', aliases: ['nasdaq futures'] },

  // Australia
  { symbol: '^AXJO', label: 'ASX 200', region: 'australia', market: 'Australia', kind: 'index', aliases: ['asx', 'australia', 'australian'] },
  { symbol: '^AXIJ', label: 'ASX 200 tech', region: 'australia', market: 'Australia', kind: 'index', tech: true, aliases: ['asx tech', 'xij'] },

  // Macro gauges
  { symbol: '^VIX', label: 'VIX volatility', region: 'macro', market: 'US', kind: 'volatility', aliases: ['vix', 'volatility', 'fear'] },
  { symbol: '^TNX', label: 'US 10-year yield', region: 'macro', market: 'US', kind: 'rate', aliases: ['10 year', '10-year', 'treasury', 'yields', 'bond'] },
  { symbol: 'AUDUSD=X', label: 'AUD/USD', region: 'macro', market: 'FX', kind: 'fx', aliases: ['aud', 'aussie dollar', 'australian dollar'] },
  { symbol: 'GC=F', label: 'Gold', region: 'macro', market: 'Commodities', kind: 'commodity', aliases: ['gold'] },
  { symbol: 'CL=F', label: 'Crude oil', region: 'macro', market: 'Commodities', kind: 'commodity', aliases: ['oil', 'crude'] },
  { symbol: 'BTC-USD', label: 'Bitcoin', region: 'macro', market: 'Crypto', kind: 'crypto', aliases: ['bitcoin', 'btc', 'crypto'] },
];

export const REGION_LABEL: Record<WorldRegion, string> = {
  asia: 'Asia',
  europe: 'Europe',
  us: 'United States',
  australia: 'Australia',
  macro: 'Macro',
};

/** The reading order of a world read: the day begins in Asia. */
export const REGION_ORDER: readonly WorldRegion[] = ['asia', 'europe', 'us', 'australia', 'macro'];

/** The instruments a reader means by a word they typed ("how is korea", "tsmc", "semis"). */
export function instrumentsMentioned(text: string): WorldInstrument[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9&.\- ]+/g, ' ')} `;
  return WORLD_INSTRUMENTS.filter((instrument) =>
    [instrument.label.toLowerCase(), instrument.symbol.toLowerCase(), ...(instrument.aliases ?? [])].some((alias) => {
      const needle = alias.toLowerCase();
      return needle.length >= 2 && lower.includes(` ${needle} `.replace(/\s+/g, ' ')) ? true : needle.length >= 4 && lower.includes(needle);
    }),
  );
}
