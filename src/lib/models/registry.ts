/**
 * The Lyra model registry - the single, honest catalogue behind the /models surface.
 *
 * Every entry states its STAGE (how far it has actually shipped) and its PROVENANCE (deterministic,
 * trained, reference heuristic, or spec-only) separately, because "running" and "trained" are
 * different claims and conflating them is how a research tool starts lying. Static and deterministic:
 * this file is data, the page only renders it.
 *
 * Doctrine (unbroken): the deterministic engine decides; models inform. Nothing registered here ever
 * issues an instruction to act or prints a price target.
 */

export type ModelStage = 'live' | 'shadow-live' | 'built' | 'designed';

export interface ModelEntry {
  key: string;
  name: string;
  family: string;
  /** What the model answers, in one user-facing line. */
  answers: string;
  stage: ModelStage;
  /** Honest provenance: what the numbers actually come from today. */
  provenance: string;
  /** Where its output is accessible in the app, when it surfaces anywhere. */
  surface?: { href: string; label: string };
  /** Repo path for the curious. */
  code: string;
}

export interface ModelGroup {
  key: string;
  title: string;
  blurb: string;
  entries: ModelEntry[];
}

export const STAGE_LABEL: Record<ModelStage, string> = {
  live: 'Live',
  'shadow-live': 'Beta',
  built: 'Reference',
  designed: 'Planned',
};

export const MODEL_GROUPS: ModelGroup[] = [
  {
    key: 'backbone',
    title: 'The always-on backbone',
    blurb:
      'The deterministic core that powers every scan. It is the safety floor the predictive models sit on top of - and it stays in charge.',
    entries: [
      {
        key: 'score-model',
        name: 'Deterministic Score Model',
        family: 'Deterministic rules (TS + Python, golden-vector parity)',
        answers:
          'The 0-100 score behind every scan: reset-band RSI, improving-but-negative MACD histogram, and proximity to the 60-period low.',
        stage: 'live',
        provenance:
          'Fully deterministic - same inputs, same outputs. The TS and Python implementations are cross-checked by golden vectors so they can never drift apart.',
        surface: { href: '/radar', label: 'Signal Radar' },
        code: 'src/lib/score-model.ts · workers/stock_scanner/signal_engine.py',
      },
      {
        key: 'recovery-probability',
        name: 'Recovery Probability Model',
        family: 'Logistic regression (frozen coefficients, calibrated)',
        answers:
          'A calibrated probability band that a beaten-down name recovers, from the same signals the score already computes.',
        stage: 'built',
        provenance:
          'Trained offline on synthetic fixtures - real-data training is still pending, so it informs research context only. Frozen coefficients; a drift guard keeps the TS mirror byte-identical to the Python trainer.',
        surface: { href: '/ai-ops', label: 'AI Ops' },
        code: 'workers/stock_scanner/ml/recovery_model.py · src/lib/ml/recovery-probability.ts',
      },
    ],
  },
  {
    key: 'emerging-winner',
    title: 'Emerging Winner Engine - the six-model stack',
    blurb:
      'Does this small cap structurally resemble the companies that became outsized winners? All six models run end to end in beta, logging to an immutable ledger. Reference v1 until the point-in-time winner dataset (Phase 1) lets the learned models train honestly.',
    entries: [
      {
        key: 'ew-m1-domain-score',
        name: 'Model 1 - Domain Score Engine',
        family: 'Deterministic 10-domain scorecard',
        answers:
          'Which of the 10 winner domains (technical, accumulation, liquidity, theme, quality, capital, government, adoption, sponsorship, narrative) are present, weak, or not yet assessable.',
        stage: 'shadow-live',
        provenance:
          'Real deterministic logic, coverage-honest: a domain with no data pipeline yet reads "not yet assessed" and is never counted as a weak trait.',
        surface: { href: '/emerging-winners', label: 'Emerging Winners' },
        code: 'workers/emerging_winner/domains.py · scorecard.py',
      },
      {
        key: 'ew-m2-classifier',
        name: 'Model 2 - Emerging Winner Classifier',
        family: 'Calibrated logistic (reference for CatBoost/LightGBM)',
        answers:
          'Winner similarity 0-100, a 4-stage conviction ladder (weak / interesting / strong / breakout archetype), and which domains drove the call.',
        stage: 'shadow-live',
        provenance:
          'Reference v1 - not yet trained on real winners. The trained gradient-boosted model drops in behind the same interface once the Phase 1 dataset exists.',
        surface: { href: '/emerging-winners', label: 'Emerging Winners' },
        code: 'workers/emerging_winner/classifier.py',
      },
      {
        key: 'ew-m3-analogue',
        name: 'Model 3 - Historical Analogue Model',
        family: 'Centred cosine similarity over domain profiles',
        answers:
          'Which past winners and failures this name most resembles - and what the closest winners had that it is still missing.',
        stage: 'shadow-live',
        provenance:
          'Matches against an illustrative analogue library until the real point-in-time snapshot store lands (Phase 1). Every match is labelled with that caveat.',
        surface: { href: '/emerging-winners', label: 'Emerging Winners' },
        code: 'workers/emerging_winner/analogue.py · reference_data.py',
      },
      {
        key: 'ew-m4-archetype-ranker',
        name: 'Model 4 - Archetype & Research Queue Ranker',
        family: 'Archetype rules + weighted priority (reference for learning-to-rank)',
        answers:
          'Which winner archetype it fits (AI infrastructure, government-backed strategic tech, quantum, robotics, space/defence, turnaround) and what deserves research attention first.',
        stage: 'shadow-live',
        provenance:
          'Reference v1 ranking weights; actions are research actions only (deep research, watchlist, paper-bot candidate). A learned ranker replaces the weights in Phase 3.',
        surface: { href: '/emerging-winners', label: 'Emerging Winners' },
        code: 'workers/emerging_winner/ranker.py',
      },
      {
        key: 'ew-m5-risk-gates',
        name: 'Model 5 - Risk Gate Stack',
        family: 'Five deterministic gates',
        answers:
          'Survivability, dilution, manipulation/hype, liquidity, and downside - each gate reads PASS, REVIEW, or BLOCK, and a BLOCK excludes the name from the queue.',
        stage: 'shadow-live',
        provenance:
          'Real gate logic doing real work: a speculative pump with a tiny float and thin liquidity is caught and excluded. Missing data reads INSUFFICIENT - never a silent pass.',
        surface: { href: '/emerging-winners', label: 'Emerging Winners' },
        code: 'workers/emerging_winner/risk_gates.py',
      },
      {
        key: 'ew-m6-timing-network',
        name: 'Model 6 - Timing & Network Intelligence',
        family: 'Temporal + network heuristics (shadow challenger)',
        answers:
          'Is the evidence accelerating, dormant, or already crowded - and is the name inside the clusters winners historically sat inside (smart money, supply chains, government programs).',
        stage: 'shadow-live',
        provenance:
          'A strict shadow challenger: it annotates every finding but contributes nothing to ranking or risk until it earns promotion. When attention runs ahead of evidence it says the crowd likely arrived first.',
        surface: { href: '/emerging-winners', label: 'Emerging Winners' },
        code: 'workers/emerging_winner/timing.py',
      },
    ],
  },
  {
    key: 'event-families',
    title: 'Event-model families - designed, not built',
    blurb:
      'The candidate architectures for the fast-follow event model ("will this name move +20% within 21 / 63 / 126 trading days?"). Specs live in lyra-modelling/; none of these are running yet, and this page will say so until one is.',
    entries: [
      {
        key: 'fam-gbdt',
        name: 'Gradient Boosted Trees',
        family: 'LightGBM / CatBoost (champion candidate)',
        answers:
          'Ranked probability that a name reaches +20% within 21 / 63 / 126 trading days, from structured technical + theme features, with SHAP explainability.',
        stage: 'designed',
        provenance: 'Spec only (deck families-1of5). First production champion once the event-model lane opens.',
        code: 'lyra-modelling/families-1of5-gradient-boosted-trees.png',
      },
      {
        key: 'fam-tft',
        name: 'Temporal Fusion Transformer',
        family: 'Multi-horizon sequence model',
        answers: 'Multi-horizon +20% probabilities that learn regime shifts and which time periods mattered.',
        stage: 'designed',
        provenance: 'Spec only (deck families-2of5). Advanced challenger for deeper temporal forecasting.',
        code: 'lyra-modelling/families-2of5-temporal-fusion-transformer.png',
      },
      {
        key: 'fam-tcn',
        name: 'TCN / GRU / LSTM',
        family: 'Neural sequence models',
        answers: 'Whether a developing setup is building toward a strong future move - the shape of a setup over time.',
        stage: 'designed',
        provenance: 'Spec only (deck families-3of5). Challenger to the tabular models for momentum buildup.',
        code: 'lyra-modelling/families-3of5-tcn-gru-lstm-sequence-models.png',
      },
      {
        key: 'fam-graph-nn',
        name: 'Dynamic Graph Neural Network',
        family: 'Temporal knowledge graph',
        answers:
          'Which connected companies may benefit second-order through supply chains, themes, and contracts - the hidden beneficiaries.',
        stage: 'designed',
        provenance: 'Spec only (deck families-4of5). Most differentiated once the entity graph is mature.',
        code: 'lyra-modelling/families-4of5-dynamic-graph-neural-network.png',
      },
      {
        key: 'fam-ensemble',
        name: 'Stacked Ensemble + Uncertainty',
        family: 'Model-orchestration layer',
        answers:
          'The final calibrated probability with a confidence band, combining tree, temporal, graph, and deterministic outputs.',
        stage: 'designed',
        provenance: 'Spec only (deck families-5of5). The end-state decision layer once the full stack is live.',
        code: 'lyra-modelling/families-5of5-stacked-ensemble-uncertainty.png',
      },
    ],
  },
];

export type PhaseStatus = 'done' | 'next' | 'pending' | 'ongoing';

export interface RoadmapPhase {
  phase: number;
  title: string;
  status: PhaseStatus;
  note: string;
}

/** The Emerging Winner Engine phased build plan (research doc §11), stated honestly. */
export const ROADMAP: RoadmapPhase[] = [
  { phase: 0, title: 'Domain scorecard', status: 'done', note: 'Deterministic 10-domain engine, coverage-honest.' },
  { phase: 1, title: 'Point-in-time dataset', status: 'next', note: 'Small-cap universe incl. delisted names + first-touch labels. The gate for everything learned.' },
  { phase: 2, title: 'Winner classifier (trained)', status: 'pending', note: 'Gradient-boosted 4-class, walk-forward by year, SHAP.' },
  { phase: 3, title: 'Archetype classifier (trained)', status: 'pending', note: 'Learned archetype tags replace the rules.' },
  { phase: 4, title: 'Explainability layer', status: 'done', note: 'The research card ships today in reference form.' },
  { phase: 5, title: 'Live research queue', status: 'done', note: 'Ranked queue + immutable ledger, beta today over an illustrative universe.' },
  { phase: 6, title: 'Feedback loop', status: 'pending', note: 'Outcomes mature over 12 months, then challenger promotion begins.' },
];
