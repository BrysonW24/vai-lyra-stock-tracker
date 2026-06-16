/**
 * Scene definitions and copy for the Signal Calibration activation sequence.
 */

export interface ActivationScene {
  id: string;
  title: string;
  description: string;
  step: number;
  totalSteps: number;
}

export const ACTIVATION_SCENES: Record<string, ActivationScene> = {
  chooseMarket: {
    id: 'choose-market',
    title: 'Choose your market',
    description: 'Choose the companies you own, watch, or want scanned.',
    step: 1,
    totalSteps: 5,
  },
  readMomentum: {
    id: 'read-momentum',
    title: 'Read the momentum',
    description: 'RSI and MACD help reveal when momentum is recovering.',
    step: 2,
    totalSteps: 5,
  },
  actConsole: {
    id: 'act-console',
    title: 'Act from the console',
    description: 'Signals, portfolio risk and alerts come together in one command centre.',
    step: 3,
    totalSteps: 5,
  },
  paperBot: {
    id: 'paper-bot',
    title: 'Trade on paper, before it counts',
    description: 'The AI proposes. You approve. Every fill is simulated — no real money, no regrets.',
    step: 4,
    totalSteps: 5,
  },
  ready: {
    id: 'ready',
    title: 'Command Centre Ready',
    description: 'Your scanner is active. We\'ll surface what changes, what matters and what deserves review.',
    step: 5,
    totalSteps: 5,
  },
};

export const TICKER_CHIPS = [
  'NVDA',
  'AMD',
  'MSFT',
  'AAPL',
  'META',
  'GOOGL',
  'CRWD',
  'SNOW',
];

export const PORTFOLIO_EXAMPLE = ['NVDA', 'AAPL', 'MSFT'];
export const WATCHLIST_EXAMPLE = ['AMD', 'META', 'CRWD'];

/**
 * Sample signal data for Scene 2 (momentum animation).
 * RSI and MACD values shown during the line-draw animations.
 */
export const SIGNAL_ANIMATION_DATA = {
  rsi: {
    label: 'RSI',
    min: 0,
    max: 100,
    lowerBand: 30,
    upperBand: 70,
    startValue: 38,
    endValue: 46,
    milestones: [38, 40, 42, 44, 46],
  },
  macd: {
    label: 'MACD',
    startValue: -0.15,
    endValue: -0.05,
    milestones: [-0.15, -0.12, -0.09, -0.07, -0.05],
  },
};

/**
 * Sample signal table rows for Scene 3 (command centre animation).
 * Represents the dense signal dashboard post-calibration.
 */
export const SIGNAL_TABLE_ROWS = [
  {
    ticker: 'AMD',
    score: 82,
    delta: 9,
    status: 'Buy Review',
    rsi: 62,
    macdHist: 0.08,
  },
  {
    ticker: 'CRM',
    score: 76,
    delta: 6,
    status: 'Watch',
    rsi: 58,
    macdHist: 0.05,
  },
  {
    ticker: 'NVDA',
    score: 41,
    delta: -12,
    status: 'Do Not Add',
    rsi: 35,
    macdHist: -0.12,
  },
];

/**
 * Sample alert for Scene 3.
 * Represents the Telegram-style alert that surfaces during calibration.
 */
export const SAMPLE_ALERT = {
  ticker: 'AMD',
  score: 82,
  scoreDelta: 9,
  rsiStatus: 'RSI rising',
  macdStatus: 'MACD improving',
  message: 'AMD upgraded to Strong Setup, Score 82, RSI rising, MACD improving',
  timestamp: new Date(),
};
