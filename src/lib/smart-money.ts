/**
 * Smart Money - small caps catching government / big-tech / big-AI money.
 *
 * This is a NEWS-driven signal (who is backing which small cap), not price math - so
 * unlike the rest of Lyra it can't be derived from the deterministic engine. SAMPLE
 * shape for now; the live version wires Finnhub news -> AI gateway extraction into the
 * same SmartMoneyItem contract. Entries below are ILLUSTRATIVE (see SMART_MONEY_IS_SAMPLE)
 * so the design can be reviewed without asserting unverified live backing claims.
 */

// The editorial data now lives in content/smart-money.jsonl and is compiled into
// src/lib/generated/smart-money.json by scripts/build-content.mjs. Edit the JSONL,
// not this file, to change the smart-money entries.
import smartMoneyData from '@/lib/generated/smart-money.json';

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

export const SMART_MONEY: SmartMoneyItem[] = smartMoneyData as SmartMoneyItem[];
