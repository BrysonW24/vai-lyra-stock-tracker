import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureTickerExists } from '@/lib/supabase/ticker';
import { stateAtAdd } from '@/lib/twin/state-at-add';

/**
 * Watchlist write API. Uses the cookie-aware (RLS-enforced) Supabase client and the
 * signed-in user - NOT the service role - so a user can only write/delete their own
 * rows. Every insert is stamped with user_id = auth.uid(). Demo response when Supabase
 * isn't configured.
 */

interface AddWatchlistRequest {
  symbol: string;
  targetPrice?: number | string;
  targetSignalScore?: number | string;
  rsiMin?: number | string;
  rsiMax?: number | string;
  requireMacdHistogramRising?: boolean;
  requireVolumeRatio?: number | string;
  referencePrice?: number | string;
  movementAlertPcts?: number[];
  notes?: string;
}

interface DeleteWatchlistRequest {
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
  NextResponse.json({ ok: false, error: 'Sign in to save your watchlist.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as AddWatchlistRequest;

    if (!body.symbol) {
      return NextResponse.json({ ok: false, error: 'Missing required field: symbol' }, { status: 400 });
    }

    const symbol = String(body.symbol).toUpperCase().trim();
    if (!symbol) {
      return NextResponse.json({ ok: false, error: 'symbol cannot be empty' }, { status: 400 });
    }

    const targetPrice = body.targetPrice ? parseFloat(String(body.targetPrice)) : null;
    const targetSignalScore = body.targetSignalScore !== undefined ? parseFloat(String(body.targetSignalScore)) : 0;
    const rsiMin = body.rsiMin !== undefined ? parseFloat(String(body.rsiMin)) : 0;
    const rsiMax = body.rsiMax !== undefined ? parseFloat(String(body.rsiMax)) : 100;
    const requireVolumeRatio = body.requireVolumeRatio !== undefined ? parseFloat(String(body.requireVolumeRatio)) : 0.0;
    const referencePrice = body.referencePrice ? parseFloat(String(body.referencePrice)) : null;
    const movementAlertPcts = Array.isArray(body.movementAlertPcts)
      ? Array.from(new Set(body.movementAlertPcts.map((value) => Math.trunc(Number(value))).filter((value) => value !== 0 && Math.abs(value) <= 100))).sort((a, b) => a - b)
      : [-10, -5, 5, 10];

    if (targetPrice !== null && (isNaN(targetPrice) || targetPrice <= 0)) {
      return NextResponse.json({ ok: false, error: 'targetPrice must be a positive number' }, { status: 400 });
    }
    if (isNaN(targetSignalScore) || targetSignalScore < 0 || targetSignalScore > 100) {
      return NextResponse.json({ ok: false, error: 'targetSignalScore must be between 0 and 100' }, { status: 400 });
    }
    if (isNaN(rsiMin) || rsiMin < 0 || rsiMin > 100) {
      return NextResponse.json({ ok: false, error: 'rsiMin must be between 0 and 100' }, { status: 400 });
    }
    if (isNaN(rsiMax) || rsiMax < 0 || rsiMax > 100) {
      return NextResponse.json({ ok: false, error: 'rsiMax must be between 0 and 100' }, { status: 400 });
    }
    if (rsiMin >= rsiMax) {
      return NextResponse.json({ ok: false, error: 'rsiMin must be less than rsiMax' }, { status: 400 });
    }
    if (isNaN(requireVolumeRatio) || requireVolumeRatio < 0) {
      return NextResponse.json({ ok: false, error: 'requireVolumeRatio must be a non-negative number' }, { status: 400 });
    }
    if (referencePrice !== null && (isNaN(referencePrice) || referencePrice <= 0)) {
      return NextResponse.json({ ok: false, error: 'referencePrice must be a positive number' }, { status: 400 });
    }

    // Ensure ticker exists in the system universe (auto-registers if valid, returns error if not)
    const tickerResult = await ensureTickerExists(symbol);
    if (!tickerResult.ok) {
      return NextResponse.json({ ok: false, error: tickerResult.error || 'Failed to register stock ticker.' }, { status: 400 });
    }

    // Freeze "the state a name was in when you added it" for the trading twin (migration 034).
    // Best-effort: a miss leaves the columns null, which the twin model tolerates.
    const snapshot = await stateAtAdd(symbol);

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert([
        {
          user_id: user.id,
          symbol,
          target_price: targetPrice,
          target_signal_score: targetSignalScore,
          rsi_min: rsiMin,
          rsi_max: rsiMax,
          require_macd_histogram_rising: body.requireMacdHistogramRising === true,
          require_volume_ratio: requireVolumeRatio,
          reference_price: referencePrice,
          movement_alert_pcts: movementAlertPcts,
          notes: body.notes || null,
          is_active: true,
          signal_score_at_add: snapshot.signalScore,
          lifecycle_stage_at_add: snapshot.lifecycleStage,
          backing_strength_at_add: snapshot.backingStrength,
        },
      ])
      .select()
      .single();

    if (error) {
      let friendlyError = error.message || 'Failed to add watchlist item';
      if (error.message?.includes('unique') || error.code === '23505') {
        friendlyError = `Ticker "${symbol}" is already in your watchlist.`;
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as DeleteWatchlistRequest;
    if (!body.id) {
      return NextResponse.json({ ok: false, error: 'Missing required field: id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('watchlist_items')
      .update({ is_active: false })
      .eq('id', body.id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to remove watchlist item' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
