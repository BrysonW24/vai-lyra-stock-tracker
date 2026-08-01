/**
 * TypeScript shape of an Emerging Winner Engine result - mirrors EmergingWinnerResult.to_dict() in
 * workers/emerging_winner/engine.py. The Python worker computes every number and persists it to the
 * immutable ledger (migration 056); the frontend only reads and renders. Keep this in lockstep with
 * the Python to_dict() (add a field there -> add it here).
 */

export interface EWContribution {
  domain: string;
  label: string;
  contribution: number;
}

export interface EWSubSignal {
  name: string;
  // Most sub-signals are numeric, but a few are categorical (e.g. volume_state "accumulation",
  // macro_regime_fit "risk_on"), so the raw value can be a string.
  value: number | string | null;
  score: number | null;
}

export interface EWDomain {
  key: string;
  label: string;
  score: number | null;
  coverage: 'full' | 'partial' | 'unavailable';
  reason: string;
  subsignals: EWSubSignal[];
}

export interface EWAnalogueMatch {
  name: string;
  archetype: string;
  era: string;
  label: 'winner' | 'failure';
  similarity: number;
}

export interface EWAnalogues {
  nearest_winners: EWAnalogueMatch[];
  nearest_failures: EWAnalogueMatch[];
  winner_similarity: number;
  failure_similarity: number;
  winner_failure_ratio: number;
  present_that_winners_had: string[];
  missing_vs_top_winner: string[];
  provenance: string;
}

export interface EWDistribution {
  p_2x_12m: number;
  p_2x_24m: number;
  p_5x_36m: number;
  p_10x_60m: number;
  p_ruin: number;
  survivability: string;
  expected_time_to_catalyst_months: number;
  expected_max_drawdown_pct: number;
  provenance: string;
}

export interface EWGate {
  key: string;
  label: string;
  verdict: 'pass' | 'review' | 'block' | 'insufficient';
  penalty: number;
  reasons: string[];
}

export interface EWRisk {
  verdict: 'pass' | 'review' | 'block';
  penalty: number;
  blocked: boolean;
  gates: EWGate[];
}

export interface EWTiming {
  timing_state: string;
  timing_score: number | null;
  catalyst_window: string;
  network_state: string;
  network_score: number | null;
  network_notes: string[];
  challenger_note: string;
  provenance: string;
}

export interface EmergingWinnerResult {
  symbol: string;
  engine_version: string;
  generated_at: string;
  winner_similarity: number;
  probability: number;
  ordinal_stage: number;
  stage_label: string;
  confidence: string;
  completeness: number;
  archetype: string;
  archetype_confidence: string;
  /** Real market cap in USD when the feature source supplied one; null = not sourced (never a guess). */
  market_cap: number | null;
  domain_composite: number;
  present_traits: string[];
  strongest_domains: string[];
  weakest_domains: string[];
  missing_domains: string[];
  contributions: EWContribution[];
  domains: EWDomain[];
  analogues: EWAnalogues;
  outcome_distribution: EWDistribution;
  risk: EWRisk;
  priority_score: number;
  action: string;
  // Signals may carry the literal sentinel 'unavailable' when a pipeline does not supply an optional
  // input (news attention / portfolio relevance) - the ranker renormalises rather than fabricating a
  // neutral value, and the sentinel is part of the persisted ledger payload contract.
  ranking_signals: Record<string, number | "unavailable">;
  surfaced: boolean;
  timing_state: string;
  timing: EWTiming;
  risks: string[];
}

export interface EmergingWinnerQueue {
  queue: EmergingWinnerResult[];
  generated_at: string | null;
  engine_version: string;
  demo: boolean;
  note: string;
}
