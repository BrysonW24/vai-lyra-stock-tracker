/**
 * The contract between the app and the writer: the facts the app serves are read by the worker's
 * `build_facts` unchanged. This test writes what the app would serve for a known set of sessions to
 * contracts/updates/facts-fixture.json (a file snapshot - `vitest -u` to regenerate on purpose), and
 * tests/test_app_client.py reads that same file with the real Python and checks the figures it
 * derives. Change one side and the other notices.
 */
import { describe, expect, it } from 'vitest';
import type { LiveSession } from '@/lib/live-signals';
import { assembleFacts } from '../facts';

const SESSION_TIME = '2026-11-05T14:30:00.000Z'; // the 5 Nov 2026 session's daily bar, stamped at the New York open
const PRIOR_TIME = '2026-11-04T14:30:00.000Z';
const COMPUTED_AT = '2026-11-06T09:05:00.000Z';

type Status = LiveSession['session']['status'];
interface Name {
  symbol: string;
  category: string;
  close: number;
  prior: number;
  score: number;
  priorScore: number;
  status: Status;
  priorStatus: Status;
  volume: number | null;
}

/** Eight names the engine scored, chosen so every kind of line the read can carry appears once. */
export const CONTRACT_NAMES: Name[] = [
  { symbol: 'NVDA', category: 'ai_infrastructure', close: 186.4, prior: 180.0, score: 71.5, priorScore: 58.0, status: 'watchlist_setup', priorStatus: 'no_signal', volume: 1.8 }, // newly on the watchlist
  { symbol: 'AMD', category: 'ai_infrastructure', close: 142.1, prior: 147.9, score: 78.2, priorScore: 66.0, status: 'strong_setup', priorStatus: 'watchlist_setup', volume: 2.1 }, // newly strong
  { symbol: 'AVGO', category: 'ai_infrastructure', close: 251.3, prior: 249.8, score: 44.0, priorScore: 47.5, status: 'no_signal', priorStatus: 'no_signal', volume: 0.9 },
  { symbol: 'CRM', category: 'software', close: 230.55, prior: 236.2, score: 62.3, priorScore: 76.1, status: 'invalidated', priorStatus: 'strong_setup', volume: 1.4 }, // a strong setup failed
  { symbol: 'NOW', category: 'software', close: 812.9, prior: 801.2, score: 39.9, priorScore: 41.2, status: 'no_signal', priorStatus: 'no_signal', volume: 1.0 },
  { symbol: 'ADBE', category: 'software', close: 388.7, prior: 391.0, score: 64.8, priorScore: 61.9, status: 'watchlist_setup', priorStatus: 'watchlist_setup', volume: 1.2 },
  { symbol: 'CRWD', category: 'cybersecurity', close: 318.0, prior: 309.4, score: 55.0, priorScore: 63.5, status: 'weakening', priorStatus: 'watchlist_setup', volume: 0.8 },
  { symbol: 'PANW', category: 'cybersecurity', close: 176.25, prior: 178.9, score: 80.5, priorScore: 79.0, status: 'strong_setup', priorStatus: 'strong_setup', volume: null },
];
/** Two more names are listed but had no prices this run: they have no row, and count against coverage. */
const UNPRICED = [
  { symbol: 'ZS', category: 'cybersecurity' },
  { symbol: 'NET', category: 'cloud_data' },
];

function liveFor(name: Name): LiveSession {
  return {
    symbol: name.symbol,
    session: { time: SESSION_TIME, close: name.close, score: name.score, status: name.status, volumeRatio: name.volume },
    prior: { time: PRIOR_TIME, close: name.prior, score: name.priorScore, status: name.priorStatus, volumeRatio: 1.0 },
  };
}

export function contractFacts() {
  const computed = [
    ...CONTRACT_NAMES.map((name) => ({ name: { symbol: name.symbol, category: name.category }, live: liveFor(name) })),
    ...UNPRICED.map((name) => ({ name, live: null })),
  ];
  const result = assembleFacts(computed, COMPUTED_AT);
  if (!result.ok) throw new Error(`contract facts did not assemble: ${result.reason}`);
  return result.facts;
}

describe('the facts contract', () => {
  it('is what the app serves for the contract names, as the worker reads it', async () => {
    const facts = contractFacts();
    expect(facts.session).toBe('2026-11-05');
    expect(facts.listed).toBe(10);
    expect(facts.rows).toHaveLength(8);
    await expect(JSON.stringify(facts, null, 2) + '\n').toMatchFileSnapshot('../../../../contracts/updates/facts-fixture.json');
  });

  it('hashes the rows as compact JSON, so the worker can check the hash it quotes', async () => {
    const { createHash } = await import('node:crypto');
    const facts = contractFacts();
    expect(facts.hash).toBe(createHash('sha256').update(JSON.stringify(facts.rows)).digest('hex'));
  });
});
