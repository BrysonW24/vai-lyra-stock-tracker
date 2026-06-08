/**
 * Commodities space - the key raw materials, where they actually come from, and the
 * AI-buildout angle. Source countries are REAL, stable public facts. The one-line notes
 * are general/illustrative context; live prices + commodity newsflow wire in next.
 */

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

export const COMMODITIES: Commodity[] = [
  { name: 'Gold', emoji: '🥇', from: 'China · Australia · Russia', ai: false, note: 'Classic haven; bid when real yields fall or risk spikes.' },
  { name: 'Silver', emoji: '🥈', from: 'Mexico · China · Peru', ai: true, note: 'Haven plus heavy solar + electronics demand - rides the buildout.' },
  { name: 'Copper', emoji: '🔌', from: 'Chile · Peru · DR Congo', ai: true, note: '"Dr. Copper" - grids + data centres make it the core AI metal.' },
  { name: 'Lithium', emoji: '🔋', from: 'Australia · Chile · China', ai: true, note: 'Battery cornerstone; price cyclical on EV + grid-storage demand.' },
  { name: 'Crude oil', emoji: '🛢️', from: 'USA · Saudi Arabia · Russia', ai: false, note: 'Global growth + OPEC+ supply discipline set the tone.' },
  { name: 'Natural gas', emoji: '🔥', from: 'USA · Russia · Iran', ai: true, note: 'Bridge fuel increasingly powering data-centre electricity demand.' },
  { name: 'Uranium', emoji: '☢️', from: 'Kazakhstan · Canada · Namibia', ai: true, note: 'Nuclear restart for clean baseload to feed AI compute.' },
  { name: 'Nickel', emoji: '⚙️', from: 'Indonesia · Philippines · Russia', ai: true, note: 'High-density battery cathodes; Indonesia dominates new supply.' },
  { name: 'Rare earths', emoji: '🧲', from: 'China · USA · Myanmar', ai: true, note: 'Magnets for motors + robotics; China controls processing.' },
  { name: 'Platinum', emoji: '⚪', from: 'South Africa · Russia', ai: false, note: 'Autocatalysts + hydrogen; concentrated supply means volatility.' },
];
