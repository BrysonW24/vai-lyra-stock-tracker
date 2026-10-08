import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { TELEGRAM_START_PREFIX } from '@/lib/subscribe';
import { telegramBotUsername } from '@/lib/subscribe-server';
import { startTelegramPairing } from '@/lib/notifications/telegram-pairing';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * "Connect Telegram" for a signed-in account: mints a one-time pairing code (hash stored in
 * channel_pairing_codes, 10-minute expiry) and returns the deep link that makes Telegram send
 * `/start p<code>` from the person's own chat. The webhook completes the pairing - see
 * src/lib/notifications/telegram-pairing.ts. The code is scoped to the caller's own user id.
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured - running in demo mode.' });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Sign in to connect Telegram.' }, { status: 401 });

    const limited = rateLimit(`user:${user.id}`, { scope: 'telegram_pair', capacity: 10, windowMs: 600_000 });
    if (!limited.allowed) return NextResponse.json({ ok: false, error: 'Too many connect attempts - wait a few minutes.' }, { status: 429 });

    const bot = telegramBotUsername();
    if (!bot || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: 'Telegram connect is not configured in this environment - enter your chat ID instead.' }, { status: 503 });
    }

    // The service client bypasses RLS; the insert is still scoped to the signed-in user's own id.
    const writer = createSupabaseServiceClient() || supabase;
    const started = await startTelegramPairing(writer, user.id);
    if ('error' in started) return NextResponse.json({ ok: false, error: started.error }, { status: 500 });

    return NextResponse.json({
      ok: true,
      url: `https://t.me/${bot}?start=${TELEGRAM_START_PREFIX.pairing}${started.code}`,
      expiresAt: started.expiresAt,
      botUsername: bot,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
