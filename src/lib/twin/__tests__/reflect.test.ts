import { describe, it, expect } from 'vitest';
import { computeTwinProfile, type TwinInputs } from '@/lib/twin/model';
import { buildReflection, renderReflectionText } from '@/lib/twin/reflect';

const NOW = Date.parse('2026-07-16T00:00:00Z');
const NO_ADVICE = /\b(should|must|buy now|sell|recommend|we advise|you ought)\b/i;

const FIXTURE: TwinInputs = {
  capital: 10000,
  trades: [
    { symbol: 'rklb', theme: 'Space & Defence', signalKinds: ['gov-award'], stage: 'funded', openedAt: '2026-07-10', closedAt: '2026-07-12', notional: 1000, realisedPnl: -50 },
    { symbol: 'lmt', theme: 'Space & Defence', signalKinds: ['gov-award'], stage: 'scaling', openedAt: '2026-07-13', notional: 1600, realisedPnl: null },
    { symbol: 'nvda', theme: 'AI', signalKinds: ['momentum'], stage: 'crowded', openedAt: '2026-07-05', closedAt: '2026-07-06', notional: 900, realisedPnl: 120 },
    { symbol: 'pltr', theme: 'AI', signalKinds: ['institutional'], stage: 'scaling', openedAt: '2026-07-08', notional: 800, realisedPnl: null },
  ],
  watches: [
    { symbol: 'rklb', theme: 'Space & Defence', stage: 'funded', addedAt: '2026-07-14' },
    { symbol: 'asts', theme: 'Space & Defence', stage: 'concept', addedAt: '2026-07-15' },
  ],
};

describe('twin · reflection presenter', () => {
  const reflection = buildReflection(computeTwinProfile(FIXTURE, NOW), {
    riskComfort: 'conservative',
    maxPositionSizePct: 10,
  });

  it('reflects a populated twin with neutral, non-advice observations', () => {
    expect(reflection.hasEnoughData).toBe(true);
    expect(reflection.observations.length).toBeGreaterThanOrEqual(2);
    expect(reflection.observations.length).toBeLessThanOrEqual(4);
    for (const o of reflection.observations) expect(o).not.toMatch(NO_ADVICE);
    expect(reflection.topThemes[0].key).toBe('Space & Defence');
  });

  it('renders citable text for the AI tool', () => {
    const text = renderReflectionText(reflection);
    expect(text).toMatch(/TRADING TWIN/);
    expect(text).not.toMatch(NO_ADVICE);
  });

  it('degrades to a learning state with no data', () => {
    const empty = buildReflection(computeTwinProfile({ trades: [], watches: [] }, NOW), null);
    expect(empty.hasEnoughData).toBe(false);
    expect(empty.headline).toMatch(/still learning/i);
    expect(renderReflectionText(empty)).toMatch(/not have enough history/i);
  });
});
