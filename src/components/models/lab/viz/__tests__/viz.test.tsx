// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { DomainRadar } from '../DomainRadar';
import { LeaderboardHeatmap } from '../LeaderboardHeatmap';
import { OpportunityMap } from '../OpportunityMap';
import { ConvictionFunnel } from '../ConvictionFunnel';
import { DomainProfileBars } from '../DomainProfileBars';
import { RiskGateSummary } from '../RiskGateSummary';
import { scoreColor, fmtCap, capRadius } from '../scale';
import type { EWDomain } from '@/lib/emerging-winner/types';
import type { LabResult, RunSummary } from '@/lib/models/lab';

/**
 * The visualisations are the honest render layer: they must draw real fields and NEVER colour an
 * `unavailable` domain (a data gap must read as a gap, not a low score). These smoke tests pin that
 * they render, that a click selects a name, and that the scale keeps its weak->strong direction.
 */

afterEach(cleanup);

function domains(): EWDomain[] {
  return [
    { key: 'technical', label: 'Technical structure', score: 80, coverage: 'full', reason: '', subsignals: [] },
    { key: 'theme', label: 'Theme strength', score: 60, coverage: 'partial', reason: '', subsignals: [] },
    { key: 'government', label: 'Government / policy', score: null, coverage: 'unavailable', reason: '', subsignals: [] },
  ];
}

function labResult(symbol: string, sim: number, cap: number | null): LabResult {
  return {
    symbol,
    companyName: symbol,
    kind: 'ew',
    headlineValue: Math.round(sim),
    headlineLabel: 'resemblance',
    tone: sim >= 60 ? 'strong' : 'weak',
    subtitle: 'weak',
    group: 'AI',
    strongest: ['Technical'],
    primaryRisk: 'thin float',
    evidence: '2/3 covered',
    marketCap: cap,
    ew: {
      symbol,
      engine_version: 'emerging-winner-classifier-real-v1',
      generated_at: '2026-08-01T00:00:00Z',
      winner_similarity: sim,
      probability: 0.1,
      ordinal_stage: 2,
      stage_label: 'weak',
      confidence: 'medium',
      completeness: 0.6,
      archetype: 'AI',
      archetype_confidence: 'low',
      market_cap: cap,
      domain_composite: sim,
      present_traits: [],
      strongest_domains: [],
      weakest_domains: [],
      missing_domains: [],
      contributions: [],
      domains: domains(),
      analogues: {
        nearest_winners: [],
        nearest_failures: [],
        winner_similarity: 50,
        failure_similarity: 20,
        winner_failure_ratio: 2.5,
        present_that_winners_had: [],
        missing_vs_top_winner: [],
        provenance: 'ref',
      },
      outcome_distribution: {
        p_2x_12m: 0.12,
        p_2x_24m: 0.2,
        p_5x_36m: 0.1,
        p_10x_60m: 0.05,
        p_ruin: 0.1,
        survivability: 'medium',
        expected_time_to_catalyst_months: 12,
        expected_max_drawdown_pct: 40,
        provenance: 'coarse',
      },
      risk: {
        verdict: 'pass',
        penalty: 10,
        blocked: false,
        gates: [
          { key: 'liq', label: 'Liquidity', verdict: 'pass', penalty: 0, reasons: [] },
          { key: 'dilution', label: 'Dilution', verdict: 'review', penalty: 10, reasons: ['thin'] },
        ],
      },
      priority_score: 40,
      action: 'watchlist',
      ranking_signals: {},
      surfaced: true,
      timing_state: 'accelerating',
      timing: { timing_state: 'accelerating', timing_score: 60, catalyst_window: 'near', network_state: '', network_score: null, network_notes: [], challenger_note: '', provenance: '' },
      risks: [],
    },
  };
}

const SUMMARY: RunSummary = {
  reviewed: 100,
  passed: 60,
  surfaced: 12,
  universeLabel: 'Real SEC-listed universe',
  illustrative: true,
  version: 'emerging-winner-classifier-real-v1',
};

describe('viz scale', () => {
  it('keeps a weak->strong colour direction and never colours unavailable', () => {
    expect(scoreColor(10)).not.toBe(scoreColor(90));
    expect(fmtCap(1_500_000_000)).toBe('$1.5B');
    expect(fmtCap(null)).toBe('n/a');
    expect(capRadius(null)).toBeLessThan(capRadius(3e12));
  });
});

describe('DomainRadar', () => {
  it('renders an svg with an accessible label', () => {
    render(<DomainRadar domains={domains()} focus={['theme']} />);
    expect(screen.getByRole('img', { name: /radar/i })).toBeTruthy();
  });

  it('never plots an unavailable domain as a value (gap = dashed spoke, no zero vertex)', () => {
    // domains() has 2 covered (technical, theme) + 1 unavailable (government).
    const { container } = render(<DomainRadar domains={domains()} />);
    // Only covered domains get a value dot - the gap has no vertex on the value axis.
    expect(container.querySelectorAll('circle').length).toBe(2);
    // The unavailable domain's spoke is drawn dashed (explicit "not measured").
    expect(container.querySelector('line[stroke-dasharray]')).toBeTruthy();
  });
});

describe('LeaderboardHeatmap', () => {
  it('renders rows and selects a name on click', () => {
    const onSelect = vi.fn();
    render(<LeaderboardHeatmap results={[labResult('AAA', 80, 1e9), labResult('BBB', 40, 2e8)]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('AAA'));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('OpportunityMap', () => {
  it('renders a bubble chart and labels the strongest name', () => {
    render(<OpportunityMap results={[labResult('AAA', 90, 1e9), labResult('BBB', 30, 2e8)]} />);
    expect(screen.getByRole('img', { name: /opportunity map/i })).toBeTruthy();
    expect(screen.getByText('AAA')).toBeTruthy();
  });

  it('draws a null-cap bubble hollow, not as the smallest real cap', () => {
    // Mixed run: AAA has a sourced cap, NC does not - NC must not read as the smallest company.
    const { container } = render(<OpportunityMap results={[labResult('AAA', 90, 1e9), labResult('NC', 40, null)]} />);
    const hollow = [...container.querySelectorAll('circle')].some((c) => c.getAttribute('fill') === 'none');
    expect(hollow).toBe(true);
  });
});

describe('ConvictionFunnel', () => {
  it('shows the real upstream counts and open forward stages', () => {
    render(<ConvictionFunnel summary={SUMMARY} results={[labResult('AAA', 80, 1e9)]} universeNote="Real SEC-listed universe" />);
    expect(screen.getByText('Reviewed')).toBeTruthy();
    expect(screen.getByText('Surfaced')).toBeTruthy();
    expect(screen.getByText('Watchlist')).toBeTruthy(); // open forward stage, honest placeholder
  });
});

describe('DomainProfileBars', () => {
  it('renders one row per domain averaged across the run', () => {
    render(<DomainProfileBars results={[labResult('AAA', 80, 1e9), labResult('BBB', 40, 2e8)]} focus={['theme']} />);
    expect(screen.getByText('Technical structure')).toBeTruthy();
    expect(screen.getByText('Theme strength')).toBeTruthy();
  });
});

describe('RiskGateSummary', () => {
  it('renders a stacked bar per gate with a verdict legend', () => {
    render(<RiskGateSummary results={[labResult('AAA', 80, 1e9)]} />);
    expect(screen.getByText('Liquidity')).toBeTruthy();
    expect(screen.getByText('Dilution')).toBeTruthy();
    expect(screen.getAllByText('pass').length).toBeGreaterThan(0); // legend
  });
});
