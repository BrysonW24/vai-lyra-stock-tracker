import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { lookupMarketQuote } from '@/lib/market/quote';

/**
 * Ensures a stock ticker exists in the `stock_tickers` table, using the service client to bypass RLS.
 * It first checks if the symbol exists via the service client.
 * If not, it fetches quote metadata from Yahoo Finance and inserts a new ticker record.
 */
export async function ensureTickerExists(symbol: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseServiceClient();
  if (!admin) {
    return { ok: false, error: 'Supabase service client is not configured (demo mode fallback active).' };
  }

  const cleanedSymbol = String(symbol).toUpperCase().trim();
  if (!cleanedSymbol) {
    return { ok: false, error: 'Ticker symbol cannot be empty.' };
  }

  // 1. Check if the ticker already exists
  const { data: existing, error: findError } = await admin
    .from('stock_tickers')
    .select('symbol')
    .eq('symbol', cleanedSymbol)
    .maybeSingle();

  if (findError) {
    return { ok: false, error: `Database error finding ticker: ${findError.message}` };
  }
  if (existing?.symbol) {
    return { ok: true };
  }

  // 2. Fetch market quote from Yahoo Finance to validate ticker and retrieve company information
  const quote = await lookupMarketQuote(cleanedSymbol);
  
  if (!quote.valid) {
    return { ok: false, error: quote.error || `Could not find market data for "${cleanedSymbol}". Please enter a valid stock symbol.` };
  }

  // 3. Upsert ticker into database using service-role client
  const resolvedSymbol = quote.symbol.toUpperCase();
  const { error: insertError } = await admin.from('stock_tickers').upsert(
    {
      symbol: resolvedSymbol,
      provider_symbol: quote.symbol,
      company_name: quote.name || resolvedSymbol,
      exchange: quote.exchange || 'Unknown',
      currency: quote.currency || 'USD',
      country: resolvedSymbol.endsWith('.AX') ? 'AU' : 'US',
      category: 'user_logged',
      is_active: true,
      scan_enabled: false, // Don't scan hourly by default to conserve backend resources
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'symbol' }
  );

  if (insertError) {
    return { ok: false, error: `Failed to register ticker in system: ${insertError.message}` };
  }

  return { ok: true };
}
