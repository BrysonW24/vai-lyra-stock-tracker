import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
    const targetSignalScore = body.targetSignalScore ? parseFloat(String(body.targetSignalScore)) : 75;
    const rsiMin = body.rsiMin ? parseFloat(String(body.rsiMin)) : 35;
    const rsiMax = body.rsiMax ? parseFloat(String(body.rsiMax)) : 50;
    const requireVolumeRatio = body.requireVolumeRatio ? parseFloat(String(body.requireVolumeRatio)) : 0.8;
    const referencePrice = body.referencePrice ? parseFloat(String(body.referencePrice)) : null;
    const movementAlertPcts = Array.isArray(body.movementAlertPcts)
      ? Array.from(new Set(body.movementAlertPcts.map((value) => Math.trunc(Number(value))).filter((value) => value !== 0 && Math.abs(value) <= 100))).sort((a, b) => a - b)
      : [-15, -10, -5, 5, 10, 15];

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
    if (isNaN(requireVolumeRatio) || requireVolumeRatio <= 0) {
      return NextResponse.json({ ok: false, error: 'requireVolumeRatio must be a positive number' }, { status: 400 });
    }
    if (referencePrice !== null && (isNaN(referencePrice) || referencePrice <= 0)) {
      return NextResponse.json({ ok: false, error: 'referencePrice must be a positive number' }, { status: 400 });
    }

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
          require_macd_histogram_rising: body.requireMacdHistogramRising !== false,
          require_volume_ratio: requireVolumeRatio,
          reference_price: referencePrice,
          movement_alert_pcts: movementAlertPcts,
          notes: body.notes || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to add watchlist item' }, { status: 400 });
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
