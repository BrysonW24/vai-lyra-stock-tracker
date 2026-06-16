# Quickstart - Lyra (Stock Momentum Radar)

Get it running in a few minutes. Research software, **not financial advice**.

## TL;DR

```bash
git clone <repo-url>
cd vai-lyra-stock-tracker
npm install
cp .env.example .env.local      # optional - works without it in demo mode
npm run doctor                  # checks your setup and tells you what's missing
npm run dev -- -p 3042
```

Open http://localhost:3042 and walk through `/onboarding`.

---

## Three modes - pick how far you want to go

### 1. Demo mode (zero keys)
Just `npm install` then `npm run dev`. The whole console runs on built-in demo data - explore the dashboard, onboarding, IPO radar, calendar, education, and charts with nothing to configure.

> Keep `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true` (the default) so the app falls back to demo data whenever Supabase isn't set.

### 2. Live mode (real scanning)
To scan real stocks and store results you need **Supabase** and a **market-data source**:

1. Create a Supabase project. Run the SQL in `sql/` (in order) in the Supabase SQL editor.
2. Put the **read-only** keys in the frontend vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Put the **server** keys in the worker-only vars (never `NEXT_PUBLIC_*`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Market data uses `yfinance` by default (no key). Run the worker:
   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   npm run worker:scan
   ```

### 3. Alerts (optional)
To receive Telegram alerts, add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. See `TELEGRAM_SETUP.md` (pairing flow). Alert behaviour (mode, mute, quiet hours, scope) is controlled from the top bar of the Command Centre.

### 4. AI mode (optional)
Add server-side `OPENAI_API_KEY` to unlock the hosted beta default for keyless users. Optional:
- `LYRA_HOSTED_OPENAI_MODEL=gpt-5.5`
- `LYRA_OPENAI_REASONING_EFFORT=low`
- `GOOGLE_AI_KEY` for the older shared Gemini fallback

Users can still paste their own provider key in Settings -> AI; browser keys override the hosted key for that user.

---

## What needs which key

| You want to... | Keys needed |
|---|---|
| Explore the UI | none (demo mode) |
| Scan real stocks | Supabase + market data |
| Receive alerts | + Telegram bot token & chat id |
| Hosted AI beta | + OpenAI key |

Run `npm run doctor` anytime to see exactly what's configured and what's missing.

## Safety
Never expose server secrets in `NEXT_PUBLIC_*` vars and never commit `.env.local`. See `SECURITY.md`.
