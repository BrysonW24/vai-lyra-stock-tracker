/**
 * Commodities space - the key raw materials, where they actually come from, and the
 * AI-buildout angle. Source countries are REAL, stable public facts. The one-line notes
 * are general/illustrative context; live prices + commodity newsflow wire in next.
 *
 * AI-native content: the records live in content/commodities.jsonl (one per line, easy
 * for an agent or human to edit) and are compiled to the imported JSON by
 * scripts/build-content.mjs (runs via predev / prebuild). Edit the JSONL, not this file.
 */
import commoditiesData from '@/lib/generated/commodities.json';

export interface Commodity {
  name: string;
  emoji: string;
  /** Top producing countries - real. */
  from: string;
  /** Tied to the AI / electrification buildout. */
  ai: boolean;
  /** Short plain-English context (illustrative until live newsflow lands). */
  note: string;
}

/** True until live prices + commodity newsflow replace the static notes. */
export const COMMODITIES_NOTES_SAMPLE = true;

export const COMMODITIES: Commodity[] = commoditiesData as Commodity[];
