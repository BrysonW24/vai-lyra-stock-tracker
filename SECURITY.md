# Security

Lyra (Stock Momentum Radar) is research software. Treat keys and tokens carefully.

## Golden rules

1. **Never put secrets in `NEXT_PUBLIC_*` variables.** Anything prefixed `NEXT_PUBLIC_` is bundled into the browser and visible to everyone. Only the read-only Supabase anon URL/key belong there.
2. **Server secrets stay server-side.** `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY`, and `FINNHUB_API_KEY` must only ever be set as unprefixed (worker/server) variables - never exposed to the frontend.
3. **Never commit `.env.local`** (or any real `.env`). Only `.env.example` (placeholders) is committed. `.gitignore` should cover `.env*` except `.env.example`.
4. **Rotate anything that leaks.** If a key is committed or shared by accident, rotate it in the provider immediately.

## Supabase

- The frontend uses the **anon / publishable** key with **Row Level Security** enforced. Do not rely on hiding data in the client.
- The **service-role / secret** key bypasses RLS - it belongs only to the Python worker and server routes, never the browser bundle.
- Apply least-privilege RLS policies before pointing real data at a shared deployment.

## Telegram

- The bot token can post to any chat the bot is in - keep it server-side only.
- Store the resolved `chat_id` per user; do not log tokens.

## Demo mode is the safe default

With no keys configured the app runs entirely on built-in demo data and makes no privileged calls. This is the recommended way to share the UI with friends before anyone wires up live keys.

## Reporting

Found a vulnerability? Open a private issue or contact the maintainer directly rather than filing a public issue with details.
