export type EducationCategory = 'Technical' | 'Fundamental' | 'Risk';

export interface EducationModule {
  id: string;
  title: string;
  category: EducationCategory;
  definition: string;
  whyItMatters: string;
  howConsoleUsesIt: string;
  liveExampleHint?: string;
}

export const EDUCATION_MODULES: EducationModule[] = [
  // Technical Indicators
  {
    id: 'rsi',
    title: 'RSI (Relative Strength Index)',
    category: 'Technical',
    definition:
      'RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. It ranges from 0 to 100: above 70 indicates overbought (potential pullback), below 30 indicates oversold (potential bounce).',
    whyItMatters:
      'RSI identifies extremes in price momentum. A stock oversold and recovering often signals a strong entry point; overbought conditions warn of exhaustion.',
    howConsoleUsesIt:
      'Displayed in the signal table and ticker detail. RSI delta tracks whether momentum is accelerating or weakening. Used in score calculation to weight momentum recovery setups.',
    liveExampleHint:
      'Look for a ticker with RSI below 35 on the Radar to see an oversold candidate; check the ticker detail to see RSI trend.',
  },
  {
    id: 'macd',
    title: 'MACD (Moving Average Convergence Divergence)',
    category: 'Technical',
    definition:
      'MACD is a momentum indicator that shows the relationship between two moving averages. The MACD line (12-day EMA minus 26-day EMA) oscillates around a signal line (9-day EMA of MACD).',
    whyItMatters:
      'MACD reveals trend changes and momentum shifts. Crosses above the signal line suggest bullish momentum; crosses below suggest weakening.',
    howConsoleUsesIt:
      'The console tracks MACD state (bullish_above, bullish_below, bearish_above, bearish_below) as a core signal component. Momentum recovery is identified when histogram is negative but rising.',
    liveExampleHint:
      'Filter for tickers in "bullish_above" MACD state on the Radar to see confirmed uptrend setups.',
  },
  {
    id: 'macd-histogram',
    title: 'MACD Histogram',
    category: 'Technical',
    definition:
      'The MACD Histogram is the difference between the MACD line and its signal line. Positive values indicate MACD above the signal line; negative values indicate below.',
    whyItMatters:
      'The histogram slope reveals momentum acceleration or deceleration. A negative histogram that is rising (becoming less negative) signals early momentum recovery-a powerful low-risk setup.',
    howConsoleUsesIt:
      'Histogram value and slope are displayed in the signal table. Negative-but-rising histogram is a core trigger for momentum_recovery signals. The "Hist" column shows both value and directional arrow.',
    liveExampleHint:
      'On the Radar, find a ticker with a negative histogram value and an upward arrow (↑) in the Hist column to see momentum recovery in action.',
  },
  {
    id: 'moving-averages',
    title: 'Moving Averages (SMA 20/50/200)',
    category: 'Technical',
    definition:
      'Simple moving averages (SMAs) smooth price data over 20, 50, and 200 days. These act as support/resistance levels and trend filters: price above all three suggests uptrend; below all three suggests downtrend.',
    whyItMatters:
      'Moving averages define trend context. A stock pulling back to its 20-day MA often finds support; price above the 200-day MA indicates a long-term uptrend.',
    howConsoleUsesIt:
      'The console calculates distance from each MA. These distances feed into the price-location score component. Strong setups typically have price near the 20-day MA in an uptrend.',
    liveExampleHint:
      'Check a ticker detail to see "Price vs SMA" bars and understand whether the stock is near support or extended above resistance.',
  },
  {
    id: 'volume-confirmation',
    title: 'Volume Confirmation',
    category: 'Technical',
    definition:
      'Volume confirmation compares recent trading volume to its average. A volume ratio above 1.0x means higher-than-average trading; above 1.5x indicates strong conviction. High volume on recoveries validates the move.',
    whyItMatters:
      'Volume confirms signal strength. A momentum recovery on weak volume is unreliable; on strong volume, it suggests real institutional interest.',
    howConsoleUsesIt:
      'The "Vol" column shows volume ratio. High-confidence signals (strong_setup) typically have volume above 1.2x. Volume is weighted in the signal score.',
    liveExampleHint:
      'Compare a strong_setup signal (should have >1.2x volume) to a no_signal ticker to see the volume difference.',
  },
  {
    id: 'support-resistance',
    title: 'Support & Resistance',
    category: 'Technical',
    definition:
      'Support is a price level where buying interest absorbs selling pressure, preventing further decline. Resistance is where selling pressure overcomes buying, preventing further rise. Both are derived from recent price extremes and moving average levels.',
    whyItMatters:
      'These levels define risk boundaries and entry/exit zones. A stock holding support often bounces; breaking resistance signals continuation.',
    howConsoleUsesIt:
      'Distance from low (52-week or recent) is displayed in the signal table. Support and resistance levels inform watchlist target zones. Portfolio risk state accounts for proximity to support.',
    liveExampleHint:
      'Check the watchlist to see target buy zones-these are derived from support levels. A stock approaching its target buy zone has declining trigger distance.',
  },
  {
    id: 'momentum-recovery',
    title: 'Momentum Recovery Signal',
    category: 'Technical',
    definition:
      'A momentum recovery signal fires when a stock is oversold (RSI < 40) with a negative but rising MACD histogram, near its 20-day moving average, and sees volume above average. This low-risk setup marks early stages of a bounce.',
    whyItMatters:
      'Recovery signals offer some of the best risk/reward ratios in the market. Entry at the trough carries minimal downside yet full upside potential.',
    howConsoleUsesIt:
      'The signal type "momentum_recovery" appears in the signal table. The score breakdown shows all components. Portfolio holdings in recovery setups are flagged for action review.',
    liveExampleHint:
      'On the Radar, filter by signal type or look for tickers with RSI rising off <30 and histogram trending up.',
  },
  {
    id: 'overextension',
    title: 'Overextension Risk',
    category: 'Technical',
    definition:
      'Overextension occurs when a stock has risen significantly without pulling back-RSI above 75 AND price well above the 20-day MA AND histogram positive but flattening. Extended setups lack safe entry points.',
    whyItMatters:
      'Overextended stocks risk sharp pullbacks with little support. Chasing these setups often results in buying near local tops. Better to wait for a retracement.',
    howConsoleUsesIt:
      'The signal status "overextended" appears for extended setups. Portfolio holdings flagged as overextended receive an action state of "trim_review" to prompt risk reduction.',
    liveExampleHint:
      'On the Radar, look for tickers with status "overextended" and note their high RSI and distance from support.',
  },
  {
    id: 'distance-from-low',
    title: 'Distance from Low',
    category: 'Technical',
    definition:
      'Distance from low measures how far the current price has risen from the 52-week or recent low as a percentage. A stock 30% off its low has recovered significantly but still has room; one 80% off its low is extended.',
    whyItMatters:
      'This metric contextualises risk. A recovery near the low risks false bottoms; one far from the low risks running into resistance.',
    howConsoleUsesIt:
      'The "Low" column in the signal table shows this percentage. Used in price-location score. Watchlist trigger distances account for it.',
    liveExampleHint:
      'Compare a strong_setup (often 20-50% off low) to an overextended signal (>70% off low) on the Radar.',
  },
  {
    id: 'timeframes',
    title: 'Timeframes - which chart to read',
    category: 'Technical',
    definition:
      'The candle interval you view changes what the chart tells you. Very short intervals (45s, 1m) are noisy and useful only for fine-tuning the exact moment of an entry or exit. Longer intervals filter the noise: 5m is a solid short-term default, 15m confirms whether a move is holding or just a spike, 1h shows whether a trend is meaningful beyond a quick pump, and the daily is the frame for any proper sell/hold decision.',
    whyItMatters:
      'Reading a fast, vertical move on a 45-second chart is mostly noise unless you are literally scalping. Confirming the same move on the 5m/15m and checking the 1h for trend is the difference between chasing a pump and acting on a real move. A simple framework by style: Scalp = 1m + 5m. Day trade = 5m + 15m + 1h. Swing / investment = 1h + 4h + daily. Use the shortest interval only to time the actual entry or trim.',
    howConsoleUsesIt:
      'Lyra scans and scores on the hourly candle, so its signals are trend-meaningful by design rather than 45-second noise. Use the ticker detail to step through timeframes: 5m or 15m as your primary read, then the 1h to confirm the trend before you act.',
    liveExampleHint:
      'On a sharp vertical move, check the 5m and 15m next. If RSI is still cooked, price is at or outside the upper Bollinger Band, and MACD is starting to curl down, that is a far stronger picture than anything the 45-second chart shows.',
  },
  {
    id: 'taking-profit',
    title: 'Trimming a sharp vertical move',
    category: 'Risk',
    definition:
      'After a fast, near-vertical run, three signals appearing together often mark exhaustion: RSI still very high ("cooked"), price pinned at or outside the upper Bollinger Band, and the MACD just beginning to curl back down. No single one is decisive - together they suggest the easy part of the move is likely done.',
    whyItMatters:
      'Chasing a stock that has already gone vertical is where a lot of gains get given back. Recognising exhaustion - rather than reacting to a single green candle - is what separates trimming into strength from buying the top. The cleaner reads come from the 5m/15m, not the 45-second chart.',
    howConsoleUsesIt:
      'The console surfaces Overextension Risk and tracks RSI, MACD state and distance-from-low on the ticker detail, so you can see these conditions for yourself. It never tells you to sell - it shows the evidence; the decision is always yours.',
    liveExampleHint:
      'Open a name that has run hard, switch to the 5m/15m, and watch for RSI holding above 70, price at the upper band, and the MACD histogram shrinking. That combination is the classic "trim, do not add" picture.',
  },

  // Fundamental Metrics
  {
    id: 'revenue-growth',
    title: 'Revenue Growth',
    category: 'Fundamental',
    definition:
      'Year-over-year percentage increase in total sales. High revenue growth (>20% YoY) suggests the company is expanding market share or entering new markets. Declining or flat revenue suggests competitive pressure or market saturation.',
    whyItMatters:
      'Revenue growth is the foundation of business value. A company with strong, consistent revenue growth typically attracts institutional capital and supports higher valuations.',
    howConsoleUsesIt:
      'Revenue growth appears in ticker detail fundamentals. Used to filter universe by business quality. Stocks with strong growth momentum often have stronger technical momentum as institutions rotate in.',
    liveExampleHint:
      'Check fundamentals on a strong_setup ticker to see whether revenue growth aligns with the technical signal.',
  },
  {
    id: 'ebitda',
    title: 'EBITDA (Earnings Before Interest, Tax, Depreciation, Amortisation)',
    category: 'Fundamental',
    definition:
      'EBITDA measures operating profitability before financing and accounting adjustments. A healthy EBITDA margin (>25% for SaaS, >10% for hardware) indicates a business can generate cash from operations.',
    whyItMatters:
      'EBITDA reveals whether a company is actually profitable operationally, separate from capital structure. High EBITDA signals financial health; low or negative EBITDA warns of cash burn.',
    howConsoleUsesIt:
      'EBITDA appears in ticker fundamentals. Companies with strong EBITDA and positive momentum often see sustained institutional buying.',
    liveExampleHint:
      'Compare EBITDA margin of a strong_setup tech stock to the sector average to see whether the company is operationally outperforming.',
  },
  {
    id: 'ev-ebitda',
    title: 'EV/EBITDA Multiple',
    category: 'Fundamental',
    definition:
      'Enterprise Value divided by EBITDA-the "valuation multiple" showing how many years of EBITDA the market will pay. Lower multiples (8-12x for stable tech) suggest undervaluation; higher multiples (>20x) suggest growth premium pricing.',
    whyItMatters:
      'EV/EBITDA separates cheap stocks from undervalued ones. A low multiple combined with strong growth momentum often marks a dislocation-a buying opportunity.',
    howConsoleUsesIt:
      'Displayed in fundamentals. Very low multiples (<8x) on strong growth often trigger strong_setup signals; high multiples (>30x) on slowing growth warn of valuation risk.',
    liveExampleHint:
      'Find a strong_setup ticker with growth >25% and EV/EBITDA <15x-this is classic undervalued setup.',
  },
  {
    id: 'price-to-sales',
    title: 'Price-to-Sales Ratio (P/S)',
    category: 'Fundamental',
    definition:
      'Stock price divided by annual revenue per share. P/S is useful for unprofitable companies (where P/E fails). A low P/S (<2x for SaaS, <0.5x for mature) suggests relative undervaluation.',
    whyItMatters:
      'P/S is harder to manipulate than earnings-based metrics. It reveals whether the market has priced in future profitability or punished the stock unfairly.',
    howConsoleUsesIt:
      'Displayed in fundamentals. Used to filter universe by relative valuation. Combined with growth, it identifies undervalued growth stocks.',
    liveExampleHint:
      'On a strong_setup ticker, compare P/S to peers to see whether the stock is trading at a discount despite strong momentum.',
  },
  {
    id: 'earnings-per-share',
    title: 'P/E Ratio (Price-to-Earnings)',
    category: 'Fundamental',
    definition:
      'Stock price divided by annual earnings per share. A lower P/E (8-15x for value, 20-40x for growth) can indicate undervaluation; very high P/E (>50x) assumes significant future growth.',
    whyItMatters:
      'P/E is the most common valuation metric. It quickly reveals whether investors expect high growth (high P/E) or have limited expectations (low P/E).',
    howConsoleUsesIt:
      'Displayed in fundamentals. Very low P/E combined with momentum recovery signals can mark deep value setups; moderate P/E with growth aligns with momentum setups.',
    liveExampleHint:
      "Compare a strong_setup ticker's P/E to its sector average; deviation suggests either opportunity or risk.",
  },
  {
    id: 'free-cash-flow',
    title: 'Free Cash Flow (FCF)',
    category: 'Fundamental',
    definition:
      'Operating cash flow minus capital expenditure-the cash a company generates and can deploy (dividends, buybacks, debt reduction, R&D). Positive, growing FCF is the ultimate sign of business health.',
    whyItMatters:
      'Cash flow is reality; earnings can be accounting fiction. A company with strong FCF growth will eventually see stock appreciation; weak FCF warns of trouble ahead.',
    howConsoleUsesIt:
      'Free cash flow trends appear in fundamentals. Strong FCF growth on momentum signals increases conviction; negative FCF warns to be cautious despite technical setup.',
    liveExampleHint:
      'Check a strong_setup ticker-if it has strong FCF growth, the signal is more trustworthy than if FCF is negative or declining.',
  },
  {
    id: 'market-cap',
    title: 'Market Capitalisation',
    category: 'Fundamental',
    definition:
      'Total market value of all shares outstanding. Used to categorise stocks: micro-cap <$300M, small-cap $300M-$2B, mid-cap $2B-$10B, large-cap >$10B. Smaller caps have higher volatility and lower liquidity; large-caps offer stability.',
    whyItMatters:
      'Market cap determines trading liquidity and information availability. Large-cap stocks are heavily researched and less prone to surprises; small-caps offer growth potential but higher risk.',
    howConsoleUsesIt:
      'Market cap filters the scanner universe and informs watchlist target zones. Small-cap momentum recoveries are more explosive but riskier; large-cap signals are more reliable.',
    liveExampleHint:
      'Filter the Radar by market cap to see whether strong setups are concentrated in small-cap (riskier, faster) or large-cap (stabler, slower) stocks.',
  },

  // Risk Management
  {
    id: 'risk-reward',
    title: 'Risk/Reward Ratio',
    category: 'Risk',
    definition:
      'The ratio of potential profit to potential loss on a trade. A 2:1 risk/reward means you risk $1 to make $2. Trades with >1.5:1 risk/reward are worth considering; <1:1 should be avoided.',
    whyItMatters:
      'Risk/reward separates high-conviction setups from lottery tickets. Even if you win only 40% of your trades, a 2.5:1 average risk/reward means you profit over time.',
    howConsoleUsesIt:
      'The console calculates risk/reward for momentum recovery signals based on distance to support (downside) and distance to resistance (upside). Displayed in signal explanation.',
    liveExampleHint:
      'On a strong_setup ticker detail, check the explanation for risk/reward assessment-look for 2:1 or better.',
  },
  {
    id: 'position-sizing',
    title: 'Position Sizing',
    category: 'Risk',
    definition:
      'The dollar amount or number of shares to buy for each position, calibrated to portfolio size and risk tolerance. A common rule: risk no more than 1-2% of portfolio on any single trade. Smaller positions on untested setups, larger on high-conviction.',
    whyItMatters:
      'Position sizing prevents catastrophic loss on a single bad trade. Proper sizing lets you compound small wins; poor sizing can wipe you out on one large loss.',
    howConsoleUsesIt:
      'The portfolio section shows current position weights. Positions >10% of portfolio are flagged for trim_review if they weaken. The console guides position addition based on signal strength and current exposure.',
    liveExampleHint:
      'Check the portfolio section to see your exposure per holding and note whether any single position dominates.',
  },
  {
    id: 'candle-closes',
    title: 'Candle Closes & Timeframes',
    category: 'Technical',
    definition:
      'A candlestick represents price action over a specific timeframe (e.g., 1m, 5m, 1h). Each candle has an Open, High, Low, and Close. The "close" is the final price of the period, which is crucial because a candle can change shape entirely while still forming.',
    whyItMatters:
      'Judging a candle before it closes is a classic rookie mistake. During a 5m window, a price spike from $203 to $205 can look extremely bullish. However, if sellers reject the move and push the price back down to $201.50 by the end of the 5-minute bracket, the candle closes weak with a large upper wick (a fakeout). Waiting for the close confirms if buyers actually maintained control.',
    howConsoleUsesIt:
      'Lyra scans, evaluates, and alerts on closed hourly candles to filter out high-frequency noise and false breakouts. Use the ticker detail to view multiple timeframes: 1m for entry precision, 5m for short-term trade windows, and 1h/daily to confirm structural changes.',
    liveExampleHint:
      'Watch a stock making an aggressive vertical move. Switch between the 1m and 5m charts. If the 1m spikes but the 5m closes weak with a long wick, that signals immediate buying pressure but failed structural follow-through.',
  },
];

export function getModulesByCategory(category: EducationCategory): EducationModule[] {
  return EDUCATION_MODULES.filter((m) => m.category === category);
}

export function getCategories(): EducationCategory[] {
  const categories: Set<EducationCategory> = new Set();
  EDUCATION_MODULES.forEach((m) => categories.add(m.category));
  return Array.from(categories);
}

export function getModule(id: string): EducationModule | undefined {
  return EDUCATION_MODULES.find((m) => m.id === id);
}
