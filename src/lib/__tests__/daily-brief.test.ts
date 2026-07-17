import { describe, it, expect } from 'vitest';
import { buildDailyBrief } from '../daily-brief';
import type { DashboardData } from '@/types/scanner';
import type { MarketContextSnapshot } from '../market-context';

describe('buildDailyBrief', () => {
  const mockMarketContext: MarketContextSnapshot = {
    source: 'sample',
    capturedAt: new Date().toISOString(),
    sp500Price: 5200,
    sp500ChangePct: 0.5,
    nasdaqPrice: 18200,
    nasdaqChangePct: 1.2,
    dowPrice: 42000,
    dowChangePct: 0.2,
    vixPrice: 12.5,
    vixChangePct: -0.5,
    yield10y: 3.8,
    yield10yChangePct: 0.02,
    goldPrice: 2050,
    goldChangePct: 0.3,
    oilPrice: 78,
    oilChangePct: 1.5,
    btcPrice: 65000,
    btcChangePct: 5.2,
    fearGreedIndex: 55,
    fearGreedLabel: 'Greed',
    regime: 'risk_on' as const,
  };

  const mockDashboardData: DashboardData = {
    generatedFrom: 'demo',
    latestRun: {
      jobName: 'test',
      timeframe: '1h',
      status: 'success',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      tickersScanned: 100,
      candlesSaved: 1000,
      indicatorsSaved: 1000,
      signalsCreated: 50,
      portfolioOverlaysCreated: 5,
      watchlistOverlaysCreated: 10,
      alertsSent: 3,
    },
    signals: [
      {
        symbol: 'NVDA',
        companyName: 'NVIDIA',
        score: 85,
        scoreDelta: 5,
        status: 'strong_setup',
        actionState: 'buy_review',
        lifecycleState: 'upgraded',
        signalType: 'momentum',
        scoreBreakdown: {
          rsiScore: 75,
          macdScore: 80,
          priceLocationScore: 85,
          trendScore: 90,
          volumeScore: 70,
        },
        close: 900,
        priceChange1h: 1.5,
        priceChange1d: 3.2,
        rsi: 70,
        previousRsi: 65,
        rsiDelta: 5,
        macdHistogram: 1.2,
        previousMacdHistogram: 0.8,
        histDelta: 0.4,
        macdState: 'recovering',
        histogramSlope: 0.5,
        volumeRatio: 1.8,
        distanceFromLow: 15,
        priceVsSma20: 5,
        priceVsSma50: 8,
        priceVsSma200: 12,
        lastAlert: null,
        lastUpdated: new Date().toISOString(),
        explanation: {
          triggeredBecause: ['RSI crossing 70', 'MACD histogram positive'],
          missingConfirmation: [],
          riskNotes: [],
          action: 'buy_review',
        },
        summary: {
          rsi: 'Overbought',
          macd: 'Recovering',
          volume: 'Strong',
          trend: 'Uptrend',
          price: 'Near highs',
        },
      },
      {
        symbol: 'AMD',
        companyName: 'AMD',
        score: 45,
        scoreDelta: -3,
        status: 'watchlist_setup',
        actionState: 'watch',
        lifecycleState: 'downgraded',
        signalType: 'reversal',
        scoreBreakdown: {
          rsiScore: 40,
          macdScore: 45,
          priceLocationScore: 50,
          trendScore: 40,
          volumeScore: 55,
        },
        close: 150,
        priceChange1h: -0.5,
        priceChange1d: -2.0,
        rsi: 45,
        previousRsi: 48,
        rsiDelta: -3,
        macdHistogram: -0.5,
        previousMacdHistogram: -0.3,
        histDelta: -0.2,
        macdState: 'weakening',
        histogramSlope: -0.1,
        volumeRatio: 0.9,
        distanceFromLow: -5,
        priceVsSma20: -2,
        priceVsSma50: -3,
        priceVsSma200: -4,
        lastAlert: null,
        lastUpdated: new Date().toISOString(),
        explanation: {
          triggeredBecause: [],
          missingConfirmation: ['Price confirmation needed'],
          riskNotes: [],
          action: 'watch',
        },
        summary: {
          rsi: 'Neutral',
          macd: 'Weakening',
          volume: 'Weak',
          trend: 'Downtrend',
          price: 'Below averages',
        },
      },
    ],
    alerts: [],
    tickers: [],
    portfolio: [
      {
        symbol: 'MSFT',
        quantity: 10,
        averagePrice: 380,
        currentPrice: 420,
        marketValue: 4200,
        unrealisedPnl: 400,
        unrealisedPnlPercent: 10.5,
        portfolioWeight: 60,
        signalScore: 70,
        scoreDelta: 2,
        signalStatus: 'strong_setup',
        actionState: 'hold',
        rsi: 65,
        macdState: 'recovering',
        riskState: 'low_risk',
        suggestedAction: 'Hold',
        explanation: {
          triggeredBecause: [],
          missingConfirmation: [],
          riskNotes: [],
          action: 'hold',
        },
      },
      {
        symbol: 'TSLA',
        quantity: 5,
        averagePrice: 200,
        currentPrice: 180,
        marketValue: 900,
        unrealisedPnl: -100,
        unrealisedPnlPercent: -10,
        portfolioWeight: 12.8,
        signalScore: 35,
        scoreDelta: -8,
        signalStatus: 'weakening',
        actionState: 'sell_review',
        rsi: 30,
        macdState: 'invalidated',
        riskState: 'elevated_risk',
        suggestedAction: 'Review',
        explanation: {
          triggeredBecause: [],
          missingConfirmation: [],
          riskNotes: ['Signal invalidated'],
          action: 'sell_review',
        },
      },
    ],
    watchlist: [
      {
        symbol: 'GOOGL',
        companyName: 'Google',
        category: 'mega_cap_platforms',
        targetBuyZone: 140,
        currentPrice: 142,
        distanceToTarget: 0.02, // 2% away
        signalScore: 55,
        scoreDelta: 1,
        signalStatus: 'watchlist_setup',
        triggerState: 'approaching',
        targetSignalScore: 60,
        rsi: 55,
        macdHistogram: 0.2,
        volumeRatio: 1.0,
        alertStatus: 'active',
        notes: 'Watching for entry',
        explanation: {
          triggeredBecause: [],
          missingConfirmation: [],
          riskNotes: [],
          action: 'watch',
        },
      },
    ],
    signalChanges: [],
    scoreHistory: [],
    thresholds: {
      alert: 70,
      watchlist: 60,
      signalChange: 5,
    },
  };

  it('should return a brief with a headline', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    expect(brief.headline).toBeDefined();
    expect(brief.headline.length).toBeGreaterThan(0);
    expect(brief.headline).toContain('strong setup');
  });

  it('should include the correct count of strong setups in the headline', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    // mockDashboardData has 1 strong_setup signal (NVDA)
    expect(brief.headline).toContain('1 strong setup');
  });

  it('should include portfolio P&L in headline when portfolio exists', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    // Portfolio total: MSFT +400, TSLA -100 = +300 total; cost = 4200 + 900 - 500 = 4600
    // pnlPct = 300 / 4600 ≈ 6.5%
    expect(brief.headline).toContain('your book is');
  });

  it('should have at least 3 lines in the brief', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    expect(brief.lines.length).toBeGreaterThanOrEqual(3);
  });

  it('should include a Market line', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const marketLine = brief.lines.find((l) => l.label === 'Market');
    expect(marketLine).toBeDefined();
    expect(marketLine?.tone).toBe('pos'); // risk_on regime
  });

  it('should include a Lead setup line when strong setups exist', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const leadLine = brief.lines.find((l) => l.label === 'Lead setup');
    expect(leadLine).toBeDefined();
    expect(leadLine?.text).toContain('NVDA');
    expect(leadLine?.text).toContain('85');
  });

  it('should include a Risk watch line when holdings are flagged', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const riskLine = brief.lines.find((l) => l.label === 'Risk watch');
    expect(riskLine).toBeDefined();
    expect(riskLine?.text).toContain('TSLA');
    expect(riskLine?.tone).toBe('warn');
  });

  it('should include a Watchlist line when watchlist items exist', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const watchlistLine = brief.lines.find((l) => l.label === 'Watchlist');
    expect(watchlistLine).toBeDefined();
    expect(watchlistLine?.text).toContain('GOOGL');
  });

  it('should always include a Reminder line with disclaimer', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const reminderLine = brief.lines.find((l) => l.label === 'Reminder');
    expect(reminderLine).toBeDefined();
    expect(reminderLine?.text).toContain('Research only');
    expect(reminderLine?.text).toContain('Lyra never trades');
  });

  it('should set regime label and tone from market context', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    expect(brief.regimeLabel).toBe('Risk-on');
    expect(brief.regimeTone).toBe('pos');
  });

  it('should handle neutral regime', () => {
    const neutralMarket: MarketContextSnapshot = {
      ...mockMarketContext,
      regime: 'neutral' as const,
      nasdaqChangePct: 0,
    };

    const brief = buildDailyBrief(mockDashboardData, neutralMarket);

    expect(brief.regimeLabel).toBe('Neutral');
    expect(brief.regimeTone).toBe('neutral');
  });

  it('should handle risk-off regime', () => {
    const riskOffMarket: MarketContextSnapshot = {
      ...mockMarketContext,
      regime: 'risk_off' as const,
      nasdaqChangePct: -2.5,
      vixPrice: 25,
    };

    const brief = buildDailyBrief(mockDashboardData, riskOffMarket);

    expect(brief.regimeLabel).toBe('Risk-off');
    expect(brief.regimeTone).toBe('neg');
  });

  it('should handle empty portfolio', () => {
    const dataNoPortfolio: DashboardData = {
      ...mockDashboardData,
      portfolio: [],
    };

    const brief = buildDailyBrief(dataNoPortfolio, mockMarketContext);

    expect(brief.headline).not.toContain('your book');
    const bookLine = brief.lines.find((l) => l.label === 'Your book');
    expect(bookLine).toBeUndefined();
  });

  it('should handle empty watchlist', () => {
    const dataNoWatchlist: DashboardData = {
      ...mockDashboardData,
      watchlist: [],
    };

    const brief = buildDailyBrief(dataNoWatchlist, mockMarketContext);

    const watchlistLine = brief.lines.find((l) => l.label === 'Watchlist');
    expect(watchlistLine).toBeUndefined();
  });

  it('should have correct tone for lead setup with positive delta', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const leadLine = brief.lines.find((l) => l.label === 'Lead setup');
    expect(leadLine?.tone).toBe('pos'); // NVDA has +5 scoreDelta
  });

  it('should have correct tone for Your book with positive delta', () => {
    const brief = buildDailyBrief(mockDashboardData, mockMarketContext);

    const bookLine = brief.lines.find((l) => l.label === 'Your book');
    // TSLA is the biggest mover (abs(scoreDelta) = 8 vs MSFT's 2), and it's negative
    expect(bookLine?.tone).toBe('neg'); // TSLA has -8 scoreDelta (highest magnitude mover)
  });
});
