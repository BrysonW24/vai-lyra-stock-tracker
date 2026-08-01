// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ModelsView } from '../ModelsView';
import { MODEL_GROUPS } from '@/lib/models/registry';

/**
 * Models & methods (the catalogue, now living behind the Lab's third tab) is Lyra's public honesty
 * statement about its model stack - so the render is pinned: every registered model appears, stages
 * render as chips, and the shadow-live framing is visible. A registry entry silently dropped by the
 * view would ship a lie of omission.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('ModelsView (Models & methods catalogue)', () => {
  it('renders every group and every registered model', () => {
    render(<ModelsView />);
    for (const group of MODEL_GROUPS) {
      expect(screen.getByText(group.title)).toBeTruthy();
      for (const entry of group.entries) {
        expect(screen.getByText(entry.name)).toBeTruthy();
      }
    }
  });

  it('shows the four honest availability states', () => {
    render(<ModelsView />);
    expect(screen.getAllByText('Shadow-live').length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText('Planned').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reference').length).toBeGreaterThanOrEqual(1);
  });

  it('links through to the Emerging Winners surface and renders the roadmap', () => {
    render(<ModelsView />);
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/emerging-winners')).toBe(true);
    expect(screen.getByText('Emerging Winner Engine roadmap')).toBeTruthy();
    expect(screen.getByText('Point-in-time dataset')).toBeTruthy();
  });

  it('keeps the research-not-advice framing on the page', () => {
    render(<ModelsView />);
    expect(screen.getByText(/nothing here recommends a trade/i)).toBeTruthy();
  });
});
