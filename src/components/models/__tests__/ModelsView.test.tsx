// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ModelsView } from '../ModelsView';
import { MODEL_GROUPS } from '@/lib/models/registry';
import type { DashboardData } from '@/types/scanner';
import type { EmergingWinnerQueue } from '@/lib/emerging-winner/types';

/**
 * The /models page is Lyra's public honesty statement about its model stack - so the render is
 * pinned: every registered model appears, stages render as chips, and the shadow-live framing is
 * visible. A registry entry silently dropped by the view would ship a lie of omission. The Run
 * panel at the top is pinned to the same bar: it must offer every outcome with its true stage and
 * must refuse to "run" a model that cannot honestly score a ticker.
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
    jobName: 'test',
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

const EW: EmergingWinnerQueue = {
  queue: [],
  generated_at: null,
  engine_version: 'test',
  demo: true,
  note: '',
};

function renderView() {
  return render(<ModelsView data={DATA} ew={EW} />);
}

describe('ModelsView', () => {
  it('renders every group and every registered model', () => {
    renderView();
    for (const group of MODEL_GROUPS) {
      expect(screen.getByText(group.title)).toBeTruthy();
      for (const entry of group.entries) {
        expect(screen.getByText(entry.name)).toBeTruthy();
      }
    }
  });

  it('shows honest stage chips including shadow-live and designed', () => {
    renderView();
    expect(screen.getAllByText('Shadow-live').length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText('Designed').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(1);
  });

  it('links through to the Emerging Winners surface and renders the roadmap', () => {
    renderView();
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/emerging-winners')).toBe(true);
    expect(screen.getByText('Emerging Winner Engine roadmap')).toBeTruthy();
    expect(screen.getByText('Point-in-time dataset')).toBeTruthy();
  });

  it('keeps the research-not-advice framing on the page', () => {
    renderView();
    expect(screen.getByText(/nothing here recommends a trade/i)).toBeTruthy();
  });
});

describe('RunModelPanel (top of /models)', () => {
  it('offers all four outcomes with their true stage, and frames itself as tracked-universe only', () => {
    renderView();
    expect(screen.getByText('Run a model')).toBeTruthy();
    expect(screen.getByText(/ranks lyra's tracked universe/i)).toBeTruthy();
    for (const label of [
      'Oversold-recovery score',
      'Emerging-winner resemblance',
      'Recovery probability',
      '+20% event forecast',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('refuses to run a designed model and says so honestly instead of fabricating', () => {
    renderView();
    fireEvent.click(screen.getByText('+20% event forecast'));
    // The Run button is disabled for a non-runnable stage, and the panel states the honest reason.
    const runButton = screen.getByRole('button', { name: /run model/i }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
    expect(screen.getByText(/designed, not built - nothing runs/i)).toBeTruthy();
  });

  it('lets the live oversold-recovery model run over the tracked universe', () => {
    renderView();
    fireEvent.click(screen.getByText('Oversold-recovery score'));
    const runButton = screen.getByRole('button', { name: /run model/i }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(false);
    fireEvent.click(runButton);
    // Empty demo universe -> honest empty state, never an invented row.
    expect(screen.getByText(/no tracked names match this run/i)).toBeTruthy();
  });
});
