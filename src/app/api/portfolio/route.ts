import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Portfolio write API. Uses the cookie-aware (RLS-enforced) Supabase client and the
 * signed-in user - NOT the service role - so a user can only ever write/delete their
 * own rows. Every insert is stamped with user_id = auth.uid(), which the RLS insert
 * policy (`auth.uid() = user_id`) requires. Falls back to a demo response when Supabase
 * isn't configured.
 */

interface AddPortfolioRequest {
  symbol: string;
  quantity: number | string;
  averageBuyPrice: number | string;
  brokerageFee?: number | string;
  purchaseDate?: string;
  notes?: string;
}

interface DeletePortfolioRequest {
  id: string;
}

const demoResponse = () =>
  NextResponse.json(
    {
      ok: false,
      demo: true,
      error: 'Supabase not configured - running in demo mode. Add NEXT_PUBLIC_SUPABASE_URL + anon key to enable persistence.',
    },
    { status: 200 },
  );

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to save your portfolio.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as AddPortfolioRequest;

    if (!body.symbol || body.quantity === undefined || body.averageBuyPrice === undefined) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: symbol, quantity, averageBuyPrice' },
        { status: 400 },
      );
    }

    const quantity = parseFloat(String(body.quantity));
    const averageBuyPrice = parseFloat(String(body.averageBuyPrice));
    const brokerageFee = body.brokerageFee ? parseFloat(String(body.brokerageFee)) : 0;

    if (isNaN(quantity) || isNaN(averageBuyPrice)) {
      return NextResponse.json({ ok: false, error: 'quantity and averageBuyPrice must be valid numbers' }, { status: 400 });
    }
    if (quantity <= 0) {
      return NextResponse.json({ ok: false, error: 'quantity must be greater than 0' }, { status: 400 });
    }
    if (averageBuyPrice <= 0) {
      return NextResponse.json({ ok: false, error: 'averageBuyPrice must be greater than 0' }, { status: 400 });
    }

    const symbol = String(body.symbol).toUpperCase().trim();
    if (!symbol) {
      return NextResponse.json({ ok: false, error: 'symbol cannot be empty' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('portfolio_positions')
      .insert([
        {
          user_id: user.id,
          symbol,
          quantity,
          average_buy_price: averageBuyPrice,
          brokerage_fee: brokerageFee,
          purchase_date: body.purchaseDate || null,
          notes: body.notes || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to add position' }, { status: 400 });
    }

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

    const body = (await request.json()) as DeletePortfolioRequest;
    if (!body.id) {
      return NextResponse.json({ ok: false, error: 'Missing required field: id' }, { status: 400 });
    }

    // RLS limits this to the user's own rows; the explicit user_id filter is belt-and-braces.
    const { error } = await supabase
      .from('portfolio_positions')
      .update({ is_active: false })
      .eq('id', body.id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to remove position' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
