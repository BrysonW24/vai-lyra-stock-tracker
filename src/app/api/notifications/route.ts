import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Notification-channel write API. Saves where a user wants alerts delivered (Telegram
 * chat id or WhatsApp number) into notification_channels, scoped to the signed-in user
 * via RLS so the destination is only ever visible to that user. The Telegram bot token /
 * WhatsApp Business credentials live server-side in the worker, never here.
 */

type ChannelType = 'telegram' | 'whatsapp';

interface SaveChannelRequest {
  channelType: ChannelType;
  destination: string;
  label?: string;
}

const demoResponse = () =>
  NextResponse.json(
    { ok: false, demo: true, error: 'Supabase not configured - running in demo mode.' },
    { status: 200 },
  );

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to set up notifications.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as SaveChannelRequest;
    const channelType = body.channelType;
    if (channelType !== 'telegram' && channelType !== 'whatsapp') {
      return NextResponse.json({ ok: false, error: 'channelType must be telegram or whatsapp' }, { status: 400 });
    }

    const destination = (body.destination || '').trim();
    if (!destination) {
      return NextResponse.json({ ok: false, error: 'A destination is required' }, { status: 400 });
    }
    if (channelType === 'whatsapp') {
      const cleaned = destination.replace(/[^\d+]/g, '');
      if (!/^\+?\d{7,15}$/.test(cleaned)) {
        return NextResponse.json({ ok: false, error: 'Enter a valid phone number in international format, e.g. +61400000000' }, { status: 400 });
      }
    }

    // One active channel per type: deactivate existing, then upsert the chosen one.
    await supabase.from('notification_channels').update({ is_active: false }).eq('user_id', user.id).eq('channel_type', channelType);

    const { data, error } = await supabase
      .from('notification_channels')
      .upsert(
        {
          user_id: user.id,
          channel_type: channelType,
          destination,
          channel_label: body.label ?? null,
          is_active: true,
        },
        { onConflict: 'user_id,channel_type,destination' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to save channel' }, { status: 400 });
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

    const body = (await request.json()) as { channelType: ChannelType };
    if (body.channelType !== 'telegram' && body.channelType !== 'whatsapp') {
      return NextResponse.json({ ok: false, error: 'channelType must be telegram or whatsapp' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notification_channels')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('channel_type', body.channelType);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to remove channel' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
