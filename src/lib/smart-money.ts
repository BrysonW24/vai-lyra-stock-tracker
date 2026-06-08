/**
 * Smart Money - small caps catching government / big-tech / big-AI money.
 *
 * This is a NEWS-driven signal (who is backing which small cap), not price math - so
 * unlike the rest of Lyra it can't be derived from the deterministic engine. SAMPLE
 * shape for now; the live version wires Finnhub news -> AI gateway extraction into the
 * same SmartMoneyItem contract. Entries below are ILLUSTRATIVE (see SMART_MONEY_IS_SAMPLE)
 * so the design can be reviewed without asserting unverified live backing claims.
 */

export type Backer = 'government' | 'big-tech' | 'big-ai';

export interface SmartMoneyItem {
  ticker: string;
  company: string;
  backer: Backer;
  backerName: string;
  /** Plain-English news catalyst (the "why it's here"). */
  catalyst: string;
  /** ISO date the catalyst surfaced. */
  date: string;
  source: string;
}

/** True until the live Finnhub-news -> AI-extraction pipeline replaces the sample. */
export const SMART_MONEY_IS_SAMPLE = true;

export const SMART_MONEY: SmartMoneyItem[] = [
  { ticker: 'IONQ', company: 'IonQ', backer: 'big-tech', backerName: 'Amazon', catalyst: 'Quantum cloud-access partnership widened; grouped with big-tech compute coverage.', date: '2026-06-06', source: 'Newsflow' },
  { ticker: 'SMR', company: 'NuScale Power', backer: 'government', backerName: 'US DOE', catalyst: 'Small modular reactor program tied to federal clean-energy funding in coverage.', date: '2026-06-05', source: 'Newsflow' },
  { ticker: 'BBAI', company: 'BigBear.ai', backer: 'government', backerName: 'US DoD', catalyst: 'Defense analytics work flagged across recent contract newsflow.', date: '2026-06-04', source: 'Newsflow' },
  { ticker: 'SOUN', company: 'SoundHound AI', backer: 'big-ai', backerName: 'Nvidia', catalyst: 'Grouped with Nvidia-linked AI names; voice-AI traction cited.', date: '2026-06-03', source: 'Newsflow' },
  { ticker: 'RKLB', company: 'Rocket Lab', backer: 'government', backerName: 'US Space Force', catalyst: 'Launch + national-security contracts referenced in newsflow.', date: '2026-05-30', source: 'Newsflow' },
];
