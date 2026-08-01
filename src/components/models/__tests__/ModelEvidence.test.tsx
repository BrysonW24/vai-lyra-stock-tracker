// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ModelEvidence } from '../ModelEvidence';
import { loadModelEvidence, normaliseModelEvidence } from '@/lib/models/evidence';

/**
 * The Evidence surface is the product's proof layer: it shows what stands behind the model numbers,
 * sourced entirely from the generated model-evidence.json artifact. These pins protect the honesty
 * contract: real-v1 reads promoted and the synthetic prior champion reads refuted on the holdout,
 * the survivor-bias caveat travels with the numbers, all six report-card dimensions render, dead
 * data domains are labelled unbuilt rather than silently zeroed, and a stripped-down artifact
 * (missing optional fields) never crashes the section.
 */

afterEach(cleanup);

function openSection() {
  fireEvent.click(screen.getByText('Evidence behind these numbers'));
}

describe('ModelEvidence (evidence behind the model numbers)', () => {
  it('keeps the honest framing visible even while collapsed', () => {
    render(<ModelEvidence />);
    expect(screen.getByText('Evidence behind these numbers')).toBeTruthy();
    expect(screen.getByText(/survivor-biased corpus, research only, not a live track record/i)).toBeTruthy();
  });

  it('shows the deployed champion promoted and the refuted baseline in the holdout verdict strip', () => {
    // Gen-2+ verdict shape: the deployed champion (promoted) leads; the latest retrained
    // challenger appears with its own non-promoted status; the hand-designed reference scorecard
    // stays refuted-as-ranker. (The gen-1 "prior synthetic champion" rows left the reports the
    // moment real-v1 took the champion slot.)
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();

    const champion = evidence.verdict.find((v) => v.model === 'champion' && v.split === 'holdout');
    const reference = evidence.verdict.find(
      (v) => v.model === 'reference_scorecard' && v.split === 'holdout',
    );
    expect(champion).toBeTruthy();
    expect(champion!.status).toBe('promoted');
    expect(reference).toBeTruthy();
    expect(screen.getByText(champion!.label)).toBeTruthy();
    expect(screen.getByText(reference!.label)).toBeTruthy();
    expect(screen.getAllByText('Promoted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Refuted as ranker').length).toBeGreaterThanOrEqual(1);
    // The deployed champion leads the strip.
    const strip = screen.getByText('Verdict on the untouched holdout').closest('section')!;
    const text = strip.textContent ?? '';
    expect(text.indexOf(champion!.label)).toBeLessThan(text.indexOf(reference!.label));
  });

  it('renders the full survivor-bias caveat from the artifact', () => {
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();
    expect(evidence.caveat).toBeTruthy();
    expect(screen.getByText(evidence.caveat!)).toBeTruthy();
  });

  it('renders every report-card dimension (six in the current artifact)', () => {
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();
    expect(evidence.grades?.dimensions.length).toBe(6);
    for (const d of evidence.grades!.dimensions) {
      expect(screen.getByText(d.dimension)).toBeTruthy();
      expect(screen.getByText(d.why)).toBeTruthy();
    }
  });

  it('labels every zero weight as unbuilt instead of drawing a fake bar', () => {
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();
    const zeros = evidence.weights!.current.filter((w) => w === 0).length;
    expect(zeros).toBeGreaterThan(0);
    expect(screen.getAllByText('unbuilt').length).toBe(zeros);
    // The artifact's own honesty note travels with the bars.
    expect(screen.getByText(evidence.weights!.note!)).toBeTruthy();
  });

  it('shows the leakage story in order, ending on the one-shot holdout confirmation', () => {
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();
    expect(evidence.leakage.length).toBeGreaterThanOrEqual(2);
    const block = screen.getByText('How the number was earned').closest('section')!;
    const text = block.textContent ?? '';
    let last = -1;
    for (const step of evidence.leakage) {
      const idx = text.indexOf(step.label);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('hides the promotion justification behind a disclosure and reveals the recorded reason', () => {
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();
    expect(screen.queryByText(evidence.promotion!.reason!)).toBeNull();
    fireEvent.click(screen.getByText('Promotion justification'));
    expect(screen.getByText(evidence.promotion!.reason!)).toBeTruthy();
  });

  it('footers the corpus provenance and evidence docs as plain code text', () => {
    const evidence = loadModelEvidence();
    render(<ModelEvidence />);
    openSection();
    const sha12 = evidence.generatedFromCorpus!.sha256!.slice(0, 12);
    expect(screen.getByText(new RegExp(`corpus ${sha12}`))).toBeTruthy();
    for (const doc of evidence.evidenceDocs) {
      const el = screen.getByText(doc);
      expect(el.tagName.toLowerCase()).toBe('code');
      expect(el.closest('a')).toBeNull();
    }
  });

  it('does not crash when optional fields are stripped to a minimal artifact', () => {
    const minimal = normaliseModelEvidence({
      verdict: [
        {
          model: 'real_v1',
          label: 'real-v1 (trained on real outcomes)',
          split: 'holdout',
          status: 'promoted',
          lift: 1.5,
          ci90: [1.2, 1.8],
        },
      ],
    });
    render(<ModelEvidence evidence={minimal} />);
    openSection();
    expect(screen.getByText('real-v1 (trained on real outcomes)')).toBeTruthy();
    expect(screen.getByText('Promoted')).toBeTruthy();
    // Optional blocks are omitted, not broken.
    expect(screen.queryByText('What the model learned')).toBeNull();
    expect(screen.queryByText('Report card')).toBeNull();
    expect(screen.queryByText('Caveats')).toBeNull();
  });

  it('renders an honest empty state when the artifact is entirely absent', () => {
    render(<ModelEvidence evidence={normaliseModelEvidence(null)} />);
    openSection();
    expect(screen.getByText(/No evidence artifact is available yet/i)).toBeTruthy();
  });
});
