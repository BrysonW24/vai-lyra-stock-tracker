// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ModelLab } from '../ModelLab';
import type { DashboardData } from '@/types/scanner';
import type { EmergingWinnerQueue } from '@/lib/emerging-winner/types';

/**
 * The Model Lab is the product experience over the honest engine. Pinned: the four runnable models
 * appear with true availability, a Planned outcome can never arm a run, pressing Run transitions
 * into the honest execution view (which states plainly it is not trained on real winners), and the
 * technical catalogue is reachable behind Models & methods rather than being the front door.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const DATA: DashboardData = {
  generatedFrom: 'demo',
  mode: 'demo',
  latestRun: {
    jobName: 't',
    timeframe: '1h',
    status: 'success',
    startedAt: '',
    finishedAt: '',
    tickersScanned: 0,
    candlesSaved: 0,
    indicatorsSaved: 0,
    signalsCreated: 0,
    portfolioOverlaysCreated: 0,
    watchlistOverlaysCreated: 0,
    alertsSent: 0,
  },
  signals: [],
  alerts: [],
  tickers: [],
  portfolio: [],
  watchlist: [],
  signalChanges: [],
  scoreHistory: [],
  thresholds: { alert: 70, watchlist: 50, signalChange: 5 },
};

const EW: EmergingWinnerQueue = { queue: [], generated_at: null, engine_version: 'reference-v1', demo: true, note: '' };

function renderLab() {
  return render(<ModelLab data={DATA} ew={EW} />);
}

describe('ModelLab', () => {
  it('renders the Lab header and three tabs', () => {
    renderLab();
    expect(screen.getByText('Model Lab')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous runs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Models & methods' })).toBeTruthy();
  });

  it('offers the four runnable models with their true availability via the Model selector', () => {
    renderLab();
    // Model is a compact dropdown; open it to reveal all four options.
    fireEvent.click(screen.getByRole('button', { name: 'Model' }));
    for (const name of ['Oversold Recovery', 'Emerging Winner', 'Historical Analogue', 'Risk Gate Review']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Shadow-live').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(1);
  });

  it('shows a Planned outcome but never lets it arm a run', () => {
    renderLab();
    // Switch to Oversold Recovery via the Model dropdown.
    fireEvent.click(screen.getByRole('button', { name: 'Model' }));
    fireEvent.click(screen.getByText('Oversold Recovery'));
    // Open the Outcome dropdown and find the Planned option.
    fireEvent.click(screen.getByRole('button', { name: 'Outcome' }));
    const planned = screen.getByRole('option', { name: /\+20% before -10%/ }) as HTMLButtonElement;
    expect(planned.disabled).toBe(true);
  });

  it('pressing Run enters the honest execution view', () => {
    renderLab();
    // Default model is Emerging Winner (recommended first run).
    fireEvent.click(screen.getByRole('button', { name: /Run Emerging Winner/ }));
    expect(screen.getByText(/Emerging Winner running/i)).toBeTruthy();
    expect(screen.getByText(/not trained on real winners yet/i)).toBeTruthy();
  });

  it('keeps the technical catalogue behind Models & methods', () => {
    renderLab();
    // Not shown on the Run tab by default...
    expect(screen.queryByText('Emerging Winner Engine roadmap')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Models & methods' }));
    expect(screen.getByText('Emerging Winner Engine roadmap')).toBeTruthy();
  });
});
