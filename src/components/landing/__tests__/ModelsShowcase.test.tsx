// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ModelsShowcase } from '../ModelsShowcase';

/**
 * The landing modelling section is a public product claim - so the render pins the substance:
 * all six models appear, the CTA routes to the in-app /models catalogue, and the shadow-live +
 * research-not-advice framing is visible (the landing must never promise more than the app states).
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('ModelsShowcase', () => {
  it('renders all six models of the Emerging Winner Engine', () => {
    render(<ModelsShowcase />);
    for (const name of [
      'Domain Score Engine',
      'Emerging Winner Classifier',
      'Historical Analogue Model',
      'Archetype & Queue Ranker',
      'Risk Gate Stack',
      'Timing & Network Intelligence',
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('routes the CTA to the in-app /models catalogue', () => {
    render(<ModelsShowcase />);
    const cta = screen.getByRole('link', { name: /explore the models/i });
    expect(cta.getAttribute('href')).toBe('/models');
  });

  it('keeps the beta and research-not-advice framing visible', () => {
    render(<ModelsShowcase />);
    expect(screen.getByText(/in beta/i)).toBeTruthy();
    expect(screen.getByText(/research, not advice/i)).toBeTruthy();
  });

  it('mirrors the in-app training truth without overclaiming', () => {
    render(<ModelsShowcase />);
    // The classifier claim carries its caveat on the same line - never a naked "trained" boast.
    expect(screen.getByText(/trained on real historical outcomes \(survivor-biased backtest, still beta\)/i)).toBeTruthy();
  });
});
