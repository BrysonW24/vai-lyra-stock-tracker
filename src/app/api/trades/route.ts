import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { lookupMarketQuote } from '@/lib/market/quote';

interface LogTradeRequest {
  side: 'buy';
  symbol: string;
  notional: number | string;
  rawText?: string;
  source?: string;
}

interface UndoTradeRequest {
  id: string;
}

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

const demoResponse = () =>
  NextResponse.json(
    {
      ok: false,
      demo: true,
      error: 'Supabase not configured - running in demo mode. Add Supabase env vars to enable trade logging.',
    },
    { status: 200 },
  );

const unauthenticated = () => NextResponse.json({ ok: false, error: 'Sign in to log trades.' }, { status: 401 });

async function ensureTicker(symbol: string, quote: Awaited<ReturnType<typeof lookupMarketQuote>>, supabase: SupabaseServerClient) {
  const { data: existing } = await supabase.from('stock_tickers').select('symbol').eq('symbol', symbol).maybeSingle();
  if (existing?.symbol) return { ok: true };

  const admin = createSupabaseServiceClient();
  if (!admin) return { ok: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY for new ticker creation.' };

  const { error } = await admin.from('stock_tickers').upsert(
    {
      symbol,
      provider_symbol: quote.symbol,
      company_name: quote.name,
      exchange: quote.exchange,
      currency: quote.currency ?? 'USD',
      country: symbol.endsWith('.AX') ? 'AU' : 'US',
      category: 'user_logged',
      is_active: true,
      scan_enabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'symbol' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as LogTradeRequest;
    if (body.side !== 'buy') return NextResponse.json({ ok: false, error: 'Only buy trade logging is enabled in this beta.' }, { status: 400 });

    const notional = Number(String(body.notional).replace(/,/g, ''));
    const rawSymbol = String(body.symbol || '').toUpperCase().trim();
    if (!rawSymbol || !Number.isFinite(notional) || notional <= 0) {
      return NextResponse.json({ ok: false, error: 'Provide a symbol and positive notional value.' }, { status: 400 });
    }

    const quote = await lookupMarketQuote(rawSymbol);
    if (!quote.valid || !quote.symbol || !quote.price || quote.price <= 0) {
      return NextResponse.json({ ok: false, error: quote.error || `No market price found for ${rawSymbol}.` }, { status: 400 });
    }
    const symbol = quote.symbol.toUpperCase();

    const ticker = await ensureTicker(symbol, quote, supabase);
    if (!ticker.ok) return NextResponse.json({ ok: false, error: ticker.error }, { status: 400 });

    const quantity = round6(notional / quote.price);

    const { data, error } = await supabase.rpc('log_buy_trade', {
      p_symbol: symbol,
      p_notional: round4(notional),
      p_quantity_delta: quantity,
      p_fill_price: round4(quote.price),
      p_source: body.source || 'chat',
      p_raw_text: body.rawText || null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as UndoTradeRequest;
    if (!body.id) return NextResponse.json({ ok: false, error: 'Missing trade log id.' }, { status: 400 });

    const { data, error } = await supabase.rpc('undo_trade_log', { p_log_id: body.id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
