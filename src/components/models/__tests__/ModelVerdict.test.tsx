// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ModelVerdict } from '../ModelVerdict';
import { loadModelEvidence, normaliseModelEvidence } from '@/lib/models/evidence';

/**
 * The Model Verdict is the post-run reveal - the light-glass "does this model predict success?"
 * surface. It is also the product's proof layer, so these pins protect the honesty contract exactly
 * as the prior evidence surface did: the deployed champion reads promoted and beats chance, the
 * hand-designed reference reads refuted, the survivor-bias caveat travels with the numbers, all six
 * report-card dimensions render, dead data domains are shown unbuilt rather than faked, the leakage
 * decomposition renders in order, and a stripped/absent artifact degrades rather than crashing.
 */

afterEach(cleanup);

describe('ModelVerdict (post-run evidence surface)', () => {
  it('leads with the deployed champion, promoted, and shows the refuted reference', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);

    const ch = ev.verdict.find((v) => v.model === 'champion' && v.split === 'holdout');
    const ref = ev.verdict.find((v) => v.model === 'reference_scorecard' && v.split === 'holdout');
    expect(ch).toBeTruthy();
    expect(ch!.status).toBe('promoted');
    expect(ref).toBeTruthy();

    // Role legend + status framing visible (chips read promoted / held / refuted).
    expect(screen.getAllByText(/promoted/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/refuted/i).length).toBeGreaterThanOrEqual(1);
    // Data-driven marks: the champion lift and the reference row both render.
    expect(screen.getAllByText(`${ch!.lift.toFixed(2)}×`).length).toBeGreaterThanOrEqual(1);
    // Reference appears on both splits (holdout + dev) in the verdict chart.
    expect(screen.getAllByText('reference scorecard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the full survivor-bias caveat from the artifact', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);
    expect(ev.caveat).toBeTruthy();
    expect(screen.getByText(ev.caveat!)).toBeTruthy();
  });

  it('renders every report-card dimension (six in the current artifact)', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);
    expect(ev.grades?.dimensions.length).toBe(6);
    for (const d of ev.grades!.dimensions) {
      expect(screen.getByText(d.dimension)).toBeTruthy();
      expect(screen.getByText(d.why)).toBeTruthy();
    }
  });

  it('shows dead data domains as unbuilt, never a faked bar, and keeps the honesty note', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);
    const zeros = ev.weights!.current.filter((w) => w === 0).length;
    expect(zeros).toBeGreaterThan(0);
    // The legend states the zero-weight meaning in plain language.
    expect(screen.getAllByText(/pipeline unbuilt/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(ev.weights!.note!)).toBeTruthy();
  });

  it('renders the leakage decomposition in order, ending on the confirmed number', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);
    expect(ev.leakage.length).toBeGreaterThanOrEqual(2);
    // The full step labels live in the SVG <title>s; assert their order via the block text content.
    const block = screen.getByText('How the number was earned').parentElement!;
    const text = block.textContent ?? '';
    let last = -1;
    for (const step of ev.leakage) {
      const idx = text.indexOf(step.label);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('hides the promotion justification behind a disclosure and reveals the recorded reason', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);
    expect(screen.queryByText(ev.promotion!.reason!)).toBeNull();
    fireEvent.click(screen.getByText('Promotion justification'));
    expect(screen.getByText(ev.promotion!.reason!)).toBeTruthy();
  });

  it('footers the corpus provenance and evidence docs as plain code text', () => {
    const ev = loadModelEvidence();
    render(<ModelVerdict />);
    const sha12 = ev.generatedFromCorpus!.sha256!.slice(0, 12);
    expect(screen.getByText(new RegExp(`corpus ${sha12}`))).toBeTruthy();
    for (const doc of ev.evidenceDocs) {
      const el = screen.getByText(doc);
      expect(el.tagName.toLowerCase()).toBe('code');
      expect(el.closest('a')).toBeNull();
    }
  });

  it('does not crash on a minimal artifact and omits the blocks it has no data for', () => {
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
    render(<ModelVerdict evidence={minimal} />);
    expect(screen.getByText(/Does this model genuinely predict success/i)).toBeTruthy();
    expect(screen.queryByText(/report card/i)).toBeNull();
    expect(screen.queryByText(/What real data taught the model/i)).toBeNull();
  });

  it('renders an honest empty state when the artifact is entirely absent', () => {
    render(<ModelVerdict evidence={normaliseModelEvidence(null)} />);
    expect(screen.getByText(/No evidence artifact is available yet/i)).toBeTruthy();
  });
});
