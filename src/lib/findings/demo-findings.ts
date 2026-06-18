import type { Finding } from './types';

/**
 * Demo findings for Investigation System Phase 1 - just enough nested depth to prove the
 * interaction model (finding -> evidence -> source record -> entity -> connected pattern ->
 * timeline) without live wiring. BKSY and PL share the "Earth observation analytics" node so the
 * "other companies exposed to this same bottleneck" pattern is demonstrable. Every evidence item
 * carries an explicit "what it does not prove" - the honesty line is the point, not decoration.
 *
 * Numbers here are illustrative demo values, not live market data.
 */

const EARTH_OBS_NODE = {
  id: 'node:earth-observation',
  type: 'supply_chain_node' as const,
  name: 'Earth observation analytics',
  summary: 'Persistent geospatial intelligence - governments and enterprises need always-on imagery + AI analysis.',
  facts: [
    { label: 'Parent theme', value: 'Space intelligence' },
    { label: 'Bottleneck level', value: 'Medium-high (72/100)' },
    { label: 'Dependencies', value: 'Satellites, launch capacity, ground stations, AI image compute' },
    { label: 'Risks', value: 'Customer concentration, government budget cycles, competitive pressure' },
  ],
};

const SPACE_THEME = {
  id: 'theme:space-intelligence',
  type: 'theme' as const,
  name: 'Space / Defence intelligence',
  ref: 'space-intelligence',
  summary: 'Defence and enterprise demand for space-based intelligence is accelerating.',
  facts: [
    { label: 'Maturity', value: 'Early-growth' },
    { label: 'Momentum', value: '84/100 and rising' },
    { label: 'Falsifier', value: 'Defence budget cuts or a launch-cost reversal would break the thesis' },
  ],
};

export const DEMO_FINDINGS: Finding[] = [
  {
    id: 'BKSY-20260617',
    type: 'small_cap_discovery',
    title: 'BKSY entered the space-intelligence research queue',
    summary:
      'Small-cap space-intelligence company with government-linked demand, improving scanner momentum, and direct exposure to the defence / geospatial theme.',
    symbol: 'BKSY',
    themeId: 'theme:space-intelligence',
    state: 'Paper-bot research queue',
    scores: { total: 78, government: 82, technical: 68, volume: 71, themeFit: 84, riskPenalty: 24, confidence: 65 },
    whySurfaced: [
      'Evidence: a new federal award linked to geospatial intelligence appeared',
      'Market: volume crossed 2.1x its average',
      'Technical: MACD histogram improving out of the reset band',
      'Theme: space-intelligence theme score rising (84/100)',
      'Risk: liquidity acceptable, dilution risk medium - not a clean setup',
    ],
    evidence: [
      {
        id: 'ev-bksy-contract',
        sourceType: 'government_contract',
        sourceName: 'USAspending / SAM.gov',
        sourceUrl: 'https://www.usaspending.gov',
        eventDate: '2026-06-14',
        freshness: 'fresh',
        confidence: 'high',
        summary: 'New federal award linked to geospatial / earth-observation intelligence services.',
        whyItMatters: 'Shows real government demand, not just narrative - a buyer with a budget.',
        whatItDoesNotProve:
          'One award does not prove durable revenue; the amount may be immaterial relative to market cap, and contract details may be incomplete.',
        linkedEntityIds: ['BKSY', 'node:earth-observation', 'theme:space-intelligence', 'agency:dod'],
        rawPayload: {
          award_id: 'ABC-123',
          recipient: 'BlackSky Technology',
          agency: 'Department of Defense',
          amount_usd: 1850000,
          date: '2026-06-14',
        },
      },
      {
        id: 'ev-bksy-scan',
        sourceType: 'scanner_signal',
        sourceName: 'Lyra scanner',
        eventDate: '2026-06-17',
        freshness: 'fresh',
        confidence: 'medium',
        summary: 'Setup score 76, volume ratio 2.1x, MACD improving, RSI in the recovery band.',
        whyItMatters: 'Technical confirmation that buyers are showing up while the name is still beaten down.',
        whatItDoesNotProve:
          'A one-hour scanner signal is a momentum read, not a forecast; volume can fade and the setup can invalidate.',
        linkedEntityIds: ['BKSY'],
        rawPayload: { timeframe: '1h', signal_score: 76, volume_ratio: 2.1, rsi_14: 44, macd_state: 'bullish_below' },
      },
      {
        id: 'ev-bksy-theme',
        sourceType: 'theme_score',
        sourceName: 'Lyra World Radar',
        eventDate: '2026-06-16',
        freshness: 'recent',
        confidence: 'medium',
        summary: 'Earth-observation node bottleneck 72/100 inside an accelerating space-intelligence theme.',
        whyItMatters: 'Places the name on a real supply-chain bottleneck with structural demand, not a one-off.',
        whatItDoesNotProve: 'Theme exposure does not mean this specific company captures the demand - peers may win it.',
        linkedEntityIds: ['node:earth-observation', 'theme:space-intelligence'],
      },
    ],
    entities: [
      {
        id: 'BKSY',
        type: 'company',
        name: 'BlackSky Technology',
        ref: 'BKSY',
        summary: 'Small-cap earth-observation / space-intelligence provider with government exposure.',
        facts: [
          { label: 'Theme', value: 'Space / Defence intelligence' },
          { label: 'Exposure', value: 'Direct - earth observation analytics' },
          { label: 'Cap tier', value: 'Small cap (higher volatility)' },
        ],
      },
      SPACE_THEME,
      EARTH_OBS_NODE,
      { id: 'agency:dod', type: 'government_agency', name: 'Department of Defense', ref: 'DOD', summary: 'Federal buyer of geospatial intelligence.' },
      { id: 'PL', type: 'company', name: 'Planet Labs', ref: 'PL', summary: 'Peer also exposed to the earth-observation bottleneck.' },
    ],
    relationships: [
      { fromEntityId: 'BKSY', toEntityId: 'theme:space-intelligence', relationshipType: 'exposed_to', confidence: 0.9, evidenceIds: ['ev-bksy-theme'] },
      { fromEntityId: 'BKSY', toEntityId: 'node:earth-observation', relationshipType: 'supplies', confidence: 0.8, evidenceIds: ['ev-bksy-theme', 'ev-bksy-contract'] },
      { fromEntityId: 'BKSY', toEntityId: 'agency:dod', relationshipType: 'won_contract_from', confidence: 0.95, evidenceIds: ['ev-bksy-contract'] },
      { fromEntityId: 'PL', toEntityId: 'node:earth-observation', relationshipType: 'supplies', confidence: 0.7, evidenceIds: [] },
    ],
    risks: [
      { id: 'r-bksy-liq', label: 'Liquidity', severity: 'medium', detail: 'Small-cap - position sizing and slippage matter more than the score.' },
      { id: 'r-bksy-dil', label: 'Dilution', severity: 'medium', detail: 'History of capital raises; watch the share count.' },
      { id: 'r-bksy-conc', label: 'Contract concentration', severity: 'high', detail: 'Government revenue can be lumpy and budget-cycle dependent.' },
    ],
    timeline: [
      { date: '2026-05-02', label: 'Patent application detected', evidenceId: 'ev-bksy-contract' },
      { date: '2026-05-22', label: 'Volume ratio rose to 1.6x' },
      { date: '2026-05-25', label: 'Theme score upgraded', evidenceId: 'ev-bksy-theme' },
      { date: '2026-06-14', label: 'Government award detected', evidenceId: 'ev-bksy-contract' },
      { date: '2026-06-17', label: 'Setup score crossed 70', evidenceId: 'ev-bksy-scan' },
      { date: '2026-06-17', label: 'Promoted to Paper-bot research queue', stateChange: 'Paper-bot research queue' },
    ],
    actions: [
      { kind: 'research', label: 'Open research' },
      { kind: 'watch', label: 'Add to watchlist', href: '/watchlist' },
      { kind: 'compare', label: 'Compare', href: '/comparison' },
      { kind: 'ask_lyra', label: 'Ask Lyra' },
      { kind: 'paper_bot', label: 'Paper Bot review', href: '/paper-bot' },
      { kind: 'review_risk', label: 'Review risk' },
    ],
    createdAt: '2026-06-17T22:10:00Z',
  },
  {
    id: 'SOUN-20260617',
    type: 'theme_breakout',
    title: 'SOUN surfaced on AI voice-infrastructure theme fit',
    summary:
      'Volume surge plus defence/enterprise AI-voice theme fit and an improving technical setup pushed SOUN into the watchlist queue.',
    symbol: 'SOUN',
    themeId: 'theme:ai-voice',
    state: 'Watchlist candidate',
    scores: { total: 71, technical: 70, volume: 74, themeFit: 79, riskPenalty: 30, confidence: 55 },
    whySurfaced: [
      'Market: volume surge above 2x average',
      'Theme: enterprise + defence AI-voice infrastructure fit',
      'Technical: improving setup out of an oversold base',
      'Risk: crowded narrative and high volatility - medium confidence',
    ],
    evidence: [
      {
        id: 'ev-soun-scan',
        sourceType: 'scanner_signal',
        sourceName: 'Lyra scanner',
        eventDate: '2026-06-17',
        freshness: 'fresh',
        confidence: 'medium',
        summary: 'Volume 2.3x, RSI recovering from oversold, MACD histogram turning up.',
        whyItMatters: 'Buyers stepping into a beaten-down AI-voice name as the theme heats up.',
        whatItDoesNotProve: 'Momentum can be narrative-driven; a crowded AI trade can reverse hard on sentiment.',
        linkedEntityIds: ['SOUN', 'theme:ai-voice'],
        rawPayload: { timeframe: '1h', signal_score: 70, volume_ratio: 2.3, rsi_14: 41 },
      },
      {
        id: 'ev-soun-theme',
        sourceType: 'theme_score',
        sourceName: 'Lyra World Radar',
        eventDate: '2026-06-15',
        freshness: 'recent',
        confidence: 'medium',
        summary: 'AI voice-infrastructure theme momentum rising on enterprise + defence demand signals.',
        whyItMatters: 'Anchors the move to a structural theme rather than a one-day pop.',
        whatItDoesNotProve: 'Theme momentum is sentiment-weighted and can cool as fast as it warmed.',
        linkedEntityIds: ['theme:ai-voice'],
      },
    ],
    entities: [
      { id: 'SOUN', type: 'company', name: 'SoundHound AI', ref: 'SOUN', summary: 'AI voice-infrastructure company; high beta.', facts: [{ label: 'Theme', value: 'AI voice infrastructure' }, { label: 'Cap tier', value: 'Small/mid cap' }] },
      { id: 'theme:ai-voice', type: 'theme', name: 'AI voice infrastructure', ref: 'ai-voice', summary: 'Voice as an enterprise + defence AI interface layer.', facts: [{ label: 'Maturity', value: 'Early, narrative-heavy' }, { label: 'Falsifier', value: 'A dominant platform commoditising voice would compress the thesis' }] },
    ],
    relationships: [
      { fromEntityId: 'SOUN', toEntityId: 'theme:ai-voice', relationshipType: 'exposed_to', confidence: 0.85, evidenceIds: ['ev-soun-theme'] },
    ],
    risks: [
      { id: 'r-soun-crowd', label: 'Crowded narrative', severity: 'high', detail: 'AI-voice is a hot trade; sentiment reversals are sharp.' },
      { id: 'r-soun-vol', label: 'Volatility', severity: 'high', detail: 'High beta - size small.' },
    ],
    timeline: [
      { date: '2026-06-10', label: 'Theme momentum began rising', evidenceId: 'ev-soun-theme' },
      { date: '2026-06-17', label: 'Volume surge + setup score crossed 70', evidenceId: 'ev-soun-scan' },
      { date: '2026-06-17', label: 'Promoted to Watchlist candidate', stateChange: 'Watchlist candidate' },
    ],
    actions: [
      { kind: 'research', label: 'Open research' },
      { kind: 'watch', label: 'Add to watchlist', href: '/watchlist' },
      { kind: 'ask_lyra', label: 'Ask Lyra' },
      { kind: 'review_risk', label: 'Review risk' },
      { kind: 'dismiss_noise', label: 'Dismiss as noise' },
    ],
    createdAt: '2026-06-17T22:05:00Z',
  },
];

export function getDemoFinding(id: string): Finding | undefined {
  return DEMO_FINDINGS.find((f) => f.id === id);
}
