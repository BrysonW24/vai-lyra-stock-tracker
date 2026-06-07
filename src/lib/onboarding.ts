/**
 * Onboarding library for Stock Momentum Radar.
 * Deterministic setup flows, no network calls.
 */

// ====== TYPES ======

export type SetupPath = 'quick_start' | 'watchlist_first' | 'portfolio_first' | 'full_setup';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';

export type InvestingStyle = 'long_term' | 'swing_trader' | 'momentum_trader' | 'mixed' | 'learning';

export type PrimaryGoal =
  | 'grow_portfolio'
  | 'find_better_entries'
  | 'manage_risk'
  | 'learn_technical'
  | 'track_ai_tech'
  | 'build_discipline';

export type PreferredTimeframe = 'intraday' | 'daily' | 'weekly' | 'monthly' | 'long_term';

export type RiskComfort = 'conservative' | 'balanced' | 'aggressive' | 'experimental';

// Beginner branch - plain-English questions for people new to the market. These
// capture user-driven insight (motivation, knowledge, involvement, learning style,
// horizon) so we can tailor density, education, and tone rather than assuming
// trading literacy. All optional: only the active branch is required to proceed.
export type BeginnerMotivation = 'grow_savings' | 'extra_income' | 'learn_investing' | 'follow_tech' | 'long_term_wealth';
export type BeginnerKnowledge = 'scratch' | 'some_basics' | 'read_charts';
export type BeginnerInvolvement = 'guide_me' | 'now_and_then' | 'weekly' | 'daily';
export type BeginnerLearningStyle = 'plain_english' | 'real_examples' | 'step_by_step' | 'just_signal';
export type BeginnerHorizon = 'few_months' | 'year_or_two' | 'many_years' | 'unsure';

export interface OperatorProfile {
  /** Disqualifier: if 'no', the flow skips the portfolio + trade-snapshot steps. */
  tradedBefore?: 'yes' | 'no';
  experienceLevel: ExperienceLevel;
  investingStyle: InvestingStyle;
  primaryGoal: PrimaryGoal;
  preferredTimeframe: PreferredTimeframe;
  riskComfort: RiskComfort;
  // Beginner branch answers (only collected when tradedBefore === 'no').
  beginnerMotivation?: BeginnerMotivation;
  beginnerKnowledge?: BeginnerKnowledge;
  beginnerInvolvement?: BeginnerInvolvement;
  beginnerLearningStyle?: BeginnerLearningStyle;
  beginnerHorizon?: BeginnerHorizon;
}

export interface MarketUniverseSelection {
  selectedCategories: MarketCategory[];
  customTickers: string[];
}

export type MarketCategory =
  | 'mega_cap_platforms'
  | 'semiconductors'
  | 'ai_infrastructure'
  | 'cloud_enterprise'
  | 'cybersecurity'
  | 'data_analytics'
  | 'consumer_internet'
  | 'ecommerce'
  | 'fintech'
  | 'robotics_automation';

export interface WatchlistItem {
  symbol: string;
  targetBuyPrice?: number;
  targetSignalScore?: number;
  /** Price-move thresholds (%) to notify on, relative to the price at add-time. */
  alertPcts?: number[];
  notes?: string;
  // Display metadata captured at add-time from the on-demand ticker lookup.
  name?: string;
  lastPrice?: number;
  currency?: string;
}

export interface PortfolioHolding {
  symbol: string;
  quantity?: number;
  averageBuyPrice?: number;
  purchaseDate?: string;
  notes?: string;
  // Display metadata captured at add-time from the on-demand ticker lookup.
  name?: string;
  lastPrice?: number;
  currency?: string;
}

export interface CapitalContext {
  cashAvailable?: number;
  monthlyContribution?: number;
  maxPositionSizePct?: number;
  primaryOutcome?: string;
  simulationEnabled?: boolean;
  defaultTradeAmount?: number;
}

export interface AlertPreferences {
  strongSetupAlerts: boolean;
  portfolioRiskAlerts: boolean;
  watchlistTriggerAlerts: boolean;
  signalInvalidationAlerts: boolean;
  dailyDigest: boolean;
  hourlyDigest: boolean;
  /** Local time the daily digest is delivered, "HH:MM" (24h). */
  digestTime?: string;
  telegramConnected?: boolean;
}

export interface StrategySelection {
  strategyId: string;
  overrides: Record<string, unknown>;
}

export interface OnboardingState {
  path: SetupPath;
  profile?: OperatorProfile;
  marketUniverse?: MarketUniverseSelection;
  strategy?: StrategySelection;
  watchlist: WatchlistItem[];
  portfolio: PortfolioHolding[];
  capital?: CapitalContext;
  alerts?: AlertPreferences;
  completedSteps: number[];
}

// ====== DEFAULTS & CONSTANTS ======

export const DEFAULT_PROFILE: OperatorProfile = {
  experienceLevel: 'intermediate',
  investingStyle: 'mixed',
  primaryGoal: 'grow_portfolio',
  preferredTimeframe: 'daily',
  riskComfort: 'balanced',
};

export const DEFAULT_MARKET_UNIVERSE: MarketUniverseSelection = {
  selectedCategories: [
    'mega_cap_platforms',
    'semiconductors',
    'ai_infrastructure',
    'cloud_enterprise',
    'cybersecurity',
    'data_analytics',
    'consumer_internet',
    'ecommerce',
    'fintech',
    'robotics_automation',
  ],
  customTickers: [],
};

export const DEFAULT_ALERTS: AlertPreferences = {
  strongSetupAlerts: true,
  portfolioRiskAlerts: true,
  watchlistTriggerAlerts: true,
  signalInvalidationAlerts: true,
  dailyDigest: true,
  hourlyDigest: false,
  digestTime: '08:00',
  telegramConnected: false,
};

export const DEFAULT_STRATEGY: StrategySelection = {
  strategyId: 'momentum-recovery',
  overrides: {},
};

export const POPULAR_TICKERS = [
  'NVDA',
  'AMD',
  'MSFT',
  'AAPL',
  'GOOGL',
  'META',
  'AMZN',
  'TSLA',
  'AVGO',
  'PLTR',
  'CRM',
  'NOW',
  'SNOW',
  'CRWD',
  'PANW',
  'ARM',
];

export const MARKET_CATEGORIES: Record<MarketCategory, { label: string; tickers: string[] }> = {
  mega_cap_platforms: {
    label: 'Mega-cap platforms',
    tickers: ['MSFT', 'AAPL', 'GOOGL', 'META', 'AMZN', 'TSLA'],
  },
  semiconductors: {
    label: 'Semiconductors',
    tickers: ['NVDA', 'AMD', 'AVGO', 'QCOM', 'MU', 'ARM'],
  },
  ai_infrastructure: {
    label: 'AI infrastructure',
    tickers: ['NVDA', 'PLTR', 'SMCI', 'TSM', 'ASML', 'LRCX'],
  },
  cloud_enterprise: {
    label: 'Cloud & enterprise software',
    tickers: ['MSFT', 'CRM', 'NOW', 'SNOW', 'DDOG', 'CRWD'],
  },
  cybersecurity: {
    label: 'Cybersecurity',
    tickers: ['CRWD', 'PANW', 'NET', 'ZS', 'CHKP', 'FTNT'],
  },
  data_analytics: {
    label: 'Data & analytics',
    tickers: ['SNOW', 'DDOG', 'DBX', 'CLSK', 'PLTR', 'DT'],
  },
  consumer_internet: {
    label: 'Consumer internet',
    tickers: ['AMZN', 'TSLA', 'GOOG', 'META', 'SHOP', 'UBER'],
  },
  ecommerce: {
    label: 'E-commerce',
    tickers: ['AMZN', 'SHOP', 'EBAY', 'MELI', 'WISH', 'SE'],
  },
  fintech: {
    label: 'Fintech technology',
    tickers: ['PYPL', 'SQ', 'SOFI', 'COIN', 'UPST', 'BILL'],
  },
  robotics_automation: {
    label: 'Robotics & automation',
    tickers: ['TSLA', 'MRCY', 'AXP', 'NUWE', 'ISRG', 'ABB'],
  },
};

// ====== SETUP PATHS ======

export const SETUP_PATHS = {
  quick_start: {
    title: 'Scan the market',
    description: 'Start with the US Technology 100 and explore signals immediately.',
    steps: [1, 2, 3, 10, 9], // Welcome, Profile, Market, Strategy, Ready
    skipWatchlist: true,
    skipPortfolio: true,
  },
  watchlist_first: {
    title: 'Build a watchlist',
    description: 'Track companies you care about and receive setup alerts.',
    steps: [1, 2, 3, 4, 10, 9], // Welcome, Profile, Universe, Watchlist, Strategy, Ready
    skipPortfolio: true,
  },
  portfolio_first: {
    title: 'Add your portfolio',
    description: 'Analyse your current holdings, P/L, risk and trade history.',
    steps: [1, 2, 3, 4, 5, 10, 7, 8, 9], // Welcome, Profile, Universe, Watchlist, Holdings, Strategy, Capital, Alerts, Ready
  },
  full_setup: {
    title: 'Full setup',
    description: 'Add watchlist, portfolio, goals and alerts now.',
    steps: [1, 2, 3, 4, 5, 10, 6, 7, 8, 9], // Welcome, Profile, Universe, Watchlist, Holdings, Strategy, Snapshots, Capital, Alerts, Ready
  },
};

// ====== STEP DEFINITIONS ======

export const ONBOARDING_STEPS = [
  {
    id: 1,
    name: 'Welcome',
    title: 'Build your personal market command centre.',
    skipAvailable: false,
  },
  {
    id: 2,
    name: 'Operator Profile',
    title: 'How do you operate in the market?',
    skipAvailable: true,
  },
  {
    id: 3,
    name: 'Market Universe',
    title: 'This is your market universe.',
    skipAvailable: true,
  },
  {
    id: 10,
    name: 'Trading Strategy',
    title: 'Choose your trading strategy.',
    skipAvailable: true,
  },
  {
    id: 4,
    name: 'Watchlist',
    title: 'Add your watchlist.',
    skipAvailable: true,
  },
  {
    id: 5,
    name: 'Portfolio',
    title: 'Add your holdings.',
    skipAvailable: true,
  },
  {
    id: 6,
    name: 'Trade Snapshots',
    title: 'Create trade snapshots from your buy dates.',
    skipAvailable: true,
  },
  {
    id: 7,
    name: 'Capital Context',
    title: 'Set your operating context.',
    skipAvailable: true,
  },
  {
    id: 8,
    name: 'Alerts',
    title: 'Choose how you want to be alerted.',
    skipAvailable: true,
  },
  {
    id: 9,
    name: 'Ready',
    title: 'Your command centre is ready.',
    skipAvailable: false,
  },
];

// ====== UTILITIES ======

/**
 * Calculate onboarding completion percentage based on current state.
 */
export function calculateCompletion(state: OnboardingState): number {
  const path = SETUP_PATHS[state.path];
  if (!path) return 0;

  const requiredSteps = path.steps.length;
  const completedCount = state.completedSteps.length;

  return Math.round((completedCount / requiredSteps) * 100);
}

/**
 * Get the next step in the path.
 */
export function getNextStep(state: OnboardingState): number | null {
  const path = SETUP_PATHS[state.path];
  if (!path) return null;

  const nextStep = path.steps.find((step) => !state.completedSteps.includes(step));
  return nextStep ?? null;
}

/**
 * Get the previous step in the path.
 */
export function getPreviousStep(state: OnboardingState, currentStep: number): number | null {
  const path = SETUP_PATHS[state.path];
  if (!path) return null;

  const currentIndex = path.steps.indexOf(currentStep);
  if (currentIndex <= 0) return null;

  return path.steps[currentIndex - 1] ?? null;
}

/**
 * Check if a step can be skipped based on setup path rules.
 */
export function canSkipStep(state: OnboardingState, stepId: number): boolean {
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step) return false;

  return step.skipAvailable;
}

/**
 * Get tickers for a specific market category.
 */
export function getTickersForCategory(category: MarketCategory): string[] {
  return MARKET_CATEGORIES[category]?.tickers ?? [];
}

/**
 * Check if all required portfolio holdings have buy dates for snapshots.
 */
export function getPortfolioWithBuyDates(holdings: PortfolioHolding[]): PortfolioHolding[] {
  return holdings.filter((h) => h.purchaseDate);
}

/**
 * Calculate setup completeness for progressive enrichment prompts.
 */
export function calculateSetupCompleteness(state: OnboardingState): {
  percentage: number;
  watchlistCount: number;
  portfolioCount: number;
  portfolioEnrichedCount: number;
  missing: string[];
} {
  const watchlistCount = state.watchlist.length;
  const portfolioCount = state.portfolio.length;
  const portfolioEnrichedCount = state.portfolio.filter(
    (h) => h.quantity && h.averageBuyPrice && h.purchaseDate
  ).length;

  const missing: string[] = [];

  if (watchlistCount === 0) missing.push('watchlist');
  if (portfolioCount === 0) missing.push('portfolio');
  if (portfolioCount > 0 && portfolioEnrichedCount < portfolioCount) {
    missing.push('portfolio_enrichment');
  }
  if (!state.capital?.cashAvailable) missing.push('capital_context');
  if (!state.alerts?.telegramConnected) missing.push('telegram');

  // Core setup (completed by finishing the flow) is the baseline (60%); the
  // optional personalisation items fill the remaining 40%. Avoids a misleading
  // 0% when the core flow is done but no holdings/watchlist were added.
  const core = [
    Boolean(state.profile?.experienceLevel),
    (state.marketUniverse?.selectedCategories.length ?? 0) > 0 ||
      (state.marketUniverse?.customTickers.length ?? 0) > 0,
    Boolean(state.strategy?.strategyId),
    Boolean(
      state.alerts &&
        (state.alerts.strongSetupAlerts || state.alerts.portfolioRiskAlerts || state.alerts.dailyDigest),
    ),
  ];
  const coreEarned = core.filter(Boolean).length;

  const enrichment = [
    watchlistCount > 0,
    portfolioCount > 0,
    portfolioEnrichedCount > 0,
    Boolean(state.capital?.cashAvailable) || Boolean(state.alerts?.telegramConnected),
  ];
  const enrichmentEarned = enrichment.filter(Boolean).length;

  const percentage = Math.round((coreEarned / core.length) * 60 + (enrichmentEarned / enrichment.length) * 40);

  return {
    percentage,
    watchlistCount,
    portfolioCount,
    portfolioEnrichedCount,
    missing,
  };
}

/**
 * Create initial onboarding state.
 */
export function createInitialOnboardingState(path: SetupPath): OnboardingState {
  return {
    path,
    profile: DEFAULT_PROFILE,
    marketUniverse: DEFAULT_MARKET_UNIVERSE,
    strategy: DEFAULT_STRATEGY,
    watchlist: [],
    portfolio: [],
    alerts: DEFAULT_ALERTS,
    completedSteps: [],
  };
}
