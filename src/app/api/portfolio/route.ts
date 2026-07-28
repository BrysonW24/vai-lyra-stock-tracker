import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureTickerExists } from '@/lib/supabase/ticker';

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

interface ReplacePortfolioRequest {
  holdings: Array<{
    symbol: string;
    quantity: number | string;
    averageBuyPrice: number | string;
    brokerageFee?: number | string;
    purchaseDate?: string;
    notes?: string;
  }>;
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

    // Ensure ticker exists in the system universe (auto-registers if valid, returns error if not)
    const tickerResult = await ensureTickerExists(symbol);
    if (!tickerResult.ok) {
      return NextResponse.json({ ok: false, error: tickerResult.error || 'Failed to register stock ticker.' }, { status: 400 });
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
      let friendlyError = error.message || 'Failed to add position';
      if (error.message?.includes('unique') || error.code === '23505') {
        friendlyError = `Ticker "${symbol}" is already in your portfolio.`;
      } else if (error.message?.includes('foreign key') || error.code === '23503') {
        friendlyError = `Ticker "${symbol}" is not supported or could not be initialised.`;
      }
      return NextResponse.json({ ok: false, error: friendlyError }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

/**
 * PUT /api/portfolio — Replace the user's entire active portfolio in a single atomic operation.
 * Used by onboarding to ensure the submitted holdings fully replace any previously seeded or
 * entered holdings. Steps:
 *   1. Soft-delete all currently active rows for this user (is_active = false).
 *   2. Insert the new holdings array as active rows.
 * Holdings with quantity <= 0 or averageBuyPrice <= 0 are skipped (not rejected) so that
 * a partial save never silently drops the whole batch.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as ReplacePortfolioRequest;

    if (!Array.isArray(body.holdings)) {
      return NextResponse.json({ ok: false, error: 'Missing required field: holdings (array)' }, { status: 400 });
    }

    // Step 0: remember which rows are active NOW, so a failed re-insert can be rolled back rather
    // than leaving the user with an empty book (audit V4 fix: the replace is not a real DB
    // transaction, so we snapshot + best-effort restore instead).
    const { data: activeRows } = await supabase
      .from('portfolio_positions')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true);
    const previouslyActiveIds = (activeRows ?? []).map((r) => r.id as string);

    // Step 1: deactivate all existing active positions for this user.
    const { error: deactivateError } = await supabase
      .from('portfolio_positions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (deactivateError) {
      return NextResponse.json(
        { ok: false, error: `Failed to clear existing portfolio: ${deactivateError.message}` },
        { status: 400 },
      );
    }

    // Step 2: resolve tickers and build new holding rows.
    const distinctSymbols = Array.from(
      new Set(
        body.holdings
          .map((h) => String(h.symbol ?? '').toUpperCase().trim())
          .filter(Boolean)
      )
    );

    const resolvedSymbols = new Set<string>();
    const skipped: string[] = [];

    for (const sym of distinctSymbols) {
      const res = await ensureTickerExists(sym);
      if (res.ok) {
        resolvedSymbols.add(sym);
      } else {
        skipped.push(sym);
      }
    }

    const rows = body.holdings
      .map((h) => {
        const symbol = String(h.symbol ?? '').toUpperCase().trim();
        const quantity = parseFloat(String(h.quantity ?? 0));
        const averageBuyPrice = parseFloat(String(h.averageBuyPrice ?? 0));
        if (!symbol || !resolvedSymbols.has(symbol) || quantity <= 0 || averageBuyPrice <= 0) {
          if (symbol && !skipped.includes(symbol)) skipped.push(symbol);
          return null;
        }
        const brokerageFee = h.brokerageFee !== undefined ? parseFloat(String(h.brokerageFee)) : 0;
        return {
          user_id: user.id,
          symbol,
          quantity,
          average_buy_price: averageBuyPrice,
          brokerage_fee: Number.isFinite(brokerageFee) && brokerageFee > 0 ? brokerageFee : 0,
          purchase_date: h.purchaseDate || null,
          notes: h.notes || null,
          is_active: true,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      // All holdings were invalid or the list was empty. Old rows have been deactivated.
      return NextResponse.json({ ok: true, inserted: 0, skipped, replaced: true });
    }

    const { data, error: insertError } = await supabase.from('portfolio_positions').insert(rows).select();

    if (insertError) {
      // Roll back the deactivation so a transient insert failure does not leave an empty book.
      // Best-effort: if the restore itself fails we say so, but we never silently drop the user's
      // holdings on a retryable error.
      let restored = false;
      if (previouslyActiveIds.length > 0) {
        const { error: restoreError } = await supabase
          .from('portfolio_positions')
          .update({ is_active: true })
          .in('id', previouslyActiveIds)
          .eq('user_id', user.id);
        restored = !restoreError;
      } else {
        restored = true; // nothing was active to restore
      }
      return NextResponse.json(
        {
          ok: false,
          restored,
          error: restored
            ? `Could not save the new holdings (${insertError.message}). Your previous portfolio was restored - please try again.`
            : `Could not save the new holdings and the previous portfolio could not be restored (${insertError.message}). Reload and check your positions.`,
        },
        { status: restored ? 400 : 500 },
      );
    }

    return NextResponse.json({ ok: true, inserted: data?.length ?? 0, skipped, replaced: true });
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
