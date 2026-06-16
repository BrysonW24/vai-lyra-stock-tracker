export interface MarketQuote {
  valid: boolean;
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  exchange: string | null;
  changePercent: number | null;
  error?: string;
}

interface YahooMeta {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  shortName?: string;
  longName?: string;
}

async function lookupYahoo(symbol: string): Promise<YahooMeta | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { chart?: { result?: Array<{ meta?: YahooMeta }> } };
    const meta = json?.chart?.result?.[0]?.meta;
    return meta && meta.regularMarketPrice != null ? meta : null;
  } catch {
    return null;
  }
}

export async function lookupMarketQuote(rawSymbol: string): Promise<MarketQuote> {
  const raw = rawSymbol.toUpperCase().trim();
  if (!raw || !/^[A-Z0-9.\-]{1,12}$/.test(raw)) {
    return { valid: false, symbol: raw, name: null, price: null, currency: null, exchange: null, changePercent: null, error: 'Enter a ticker symbol.' };
  }

  let resolved = raw;
  let meta = await lookupYahoo(raw);
  if (!meta && !raw.includes('.')) {
    const ax = `${raw}.AX`;
    const axMeta = await lookupYahoo(ax);
    if (axMeta) {
      meta = axMeta;
      resolved = ax;
    }
  }

  if (!meta) {
    return { valid: false, symbol: raw, name: null, price: null, currency: null, exchange: null, changePercent: null, error: `No market data found for ${raw}.` };
  }

  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? null;
  const changePercent = price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null;

  return {
    valid: true,
    symbol: meta.symbol ?? resolved,
    name: meta.longName ?? meta.shortName ?? null,
    price,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    changePercent,
  };
}
