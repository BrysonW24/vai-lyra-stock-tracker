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

  it('keeps the shadow-live and research-not-advice framing visible', () => {
    render(<ModelsShowcase />);
    expect(screen.getByText(/shadow-live/i)).toBeTruthy();
    expect(screen.getByText(/research, not advice/i)).toBeTruthy();
  });
});
