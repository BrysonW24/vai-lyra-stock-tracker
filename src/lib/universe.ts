/**
 * The names Lyra actively scans (its universe). Used to power type-ahead in the
 * ticker lookup: as the user types, we suggest matches from this list so the
 * common picks are one tap. A symbol NOT in the latest scan resolves to the ticker
 * page's honest "not scanned yet" state - Lyra scans a focused universe and does not
 * fabricate a score for a name it did not measure (there is no on-demand single-ticker
 * fetch; coverage comes from the scheduled scan of this set).
 */
export interface UniverseTicker {
  symbol: string;
  name: string;
}

export const UNIVERSE_TICKERS: UniverseTicker[] = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'ABB', name: 'ABB Ltd' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'ARM', name: 'Arm Holdings' },
  { symbol: 'ASML', name: 'ASML Holding' },
  { symbol: 'AVGO', name: 'Broadcom' },
  { symbol: 'AXP', name: 'American Express' },
  { symbol: 'BILL', name: 'BILL Holdings' },
  { symbol: 'CHKP', name: 'Check Point Software' },
  { symbol: 'CLSK', name: 'CleanSpark' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'CRM', name: 'Salesforce' },
  { symbol: 'CRWD', name: 'CrowdStrike' },
  { symbol: 'DBX', name: 'Dropbox' },
  { symbol: 'DDOG', name: 'Datadog' },
  { symbol: 'DT', name: 'Dynatrace' },
  { symbol: 'EBAY', name: 'eBay' },
  { symbol: 'FTNT', name: 'Fortinet' },
  { symbol: 'GOOG', name: 'Alphabet (Class C)' },
  { symbol: 'GOOGL', name: 'Alphabet (Class A)' },
  { symbol: 'ISRG', name: 'Intuitive Surgical' },
  { symbol: 'LRCX', name: 'Lam Research' },
  { symbol: 'MELI', name: 'MercadoLibre' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'MRCY', name: 'Mercury Systems' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'MU', name: 'Micron Technology' },
  { symbol: 'NET', name: 'Cloudflare' },
  { symbol: 'NOW', name: 'ServiceNow' },
  { symbol: 'NUWE', name: 'Nuwellis' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'PANW', name: 'Palo Alto Networks' },
  { symbol: 'PLTR', name: 'Palantir' },
  { symbol: 'PYPL', name: 'PayPal' },
  { symbol: 'QCOM', name: 'Qualcomm' },
  { symbol: 'SE', name: 'Sea Limited' },
  { symbol: 'SHOP', name: 'Shopify' },
  { symbol: 'SMCI', name: 'Super Micro Computer' },
  { symbol: 'SNOW', name: 'Snowflake' },
  { symbol: 'SOFI', name: 'SoFi Technologies' },
  { symbol: 'SQ', name: 'Block' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor' },
  { symbol: 'UBER', name: 'Uber Technologies' },
  { symbol: 'UPST', name: 'Upstart' },
  { symbol: 'WISH', name: 'ContextLogic (Wish)' },
  { symbol: 'ZS', name: 'Zscaler' },
];

/**
 * Type-ahead search, relevance-ranked so the obvious pick is first:
 *   exact symbol > symbol prefix (shorter wins) > name starts > name word-start > symbol/name contains.
 * Strips a leading "$" and any exchange suffix (e.g. .AX) the user might type, and is case-insensitive.
 * E.g. "s" -> SQ/SE/SHOP..., "sales" -> Salesforce, "micro" -> Micron / Super Micro / Microsoft.
 */
export function searchUniverse(query: string, limit = 7): UniverseTicker[] {
  const q = query
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\.(AX|US|NYSE|NASDAQ)$/i, '');
  if (!q) return [];
  const scored = UNIVERSE_TICKERS.map((t) => {
    const sym = t.symbol.toUpperCase();
    const name = t.name.toUpperCase();
    const nameWords = name.split(/[^A-Z0-9]+/).filter(Boolean);
    let score = -1;
    if (sym === q) score = 1000;
    else if (sym.startsWith(q)) score = 800 - sym.length; // shorter prefix match ranks higher
    else if (name.startsWith(q)) score = 600;
    else if (nameWords.some((w) => w.startsWith(q))) score = 500;
    else if (sym.includes(q)) score = 300;
    else if (name.includes(q)) score = 200;
    return { t, score };
  })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.t.symbol.localeCompare(b.t.symbol));
  return scored.slice(0, limit).map((x) => x.t);
}
