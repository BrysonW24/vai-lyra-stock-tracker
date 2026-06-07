/**
 * The names Lyra actively scans (its universe). Used to power type-ahead in the
 * ticker lookup: as the user types, we suggest matches from this list so the
 * common picks are one tap. Anything NOT here can still be added - the user types
 * the exact ticker and the on-demand API fetches it live.
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

/** Type-ahead search: symbol-prefix matches first, then symbol/name contains. */
export function searchUniverse(query: string, limit = 6): UniverseTicker[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const starts = UNIVERSE_TICKERS.filter((t) => t.symbol.startsWith(q));
  const contains = UNIVERSE_TICKERS.filter(
    (t) => !t.symbol.startsWith(q) && (t.symbol.includes(q) || t.name.toUpperCase().includes(q)),
  );
  return [...starts, ...contains].slice(0, limit);
}
