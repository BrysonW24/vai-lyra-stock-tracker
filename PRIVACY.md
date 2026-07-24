# Privacy Policy

_Last updated 8 June 2026_

Lyra (Stock Momentum Radar) is research software for tracking US technology-stock momentum.
It is **not a broker**, does not hold funds, and never places trades. This policy explains
what the app collects, why, and the control you have over it. It mirrors the in-app privacy
page at `/privacy`.

> **Demo mode collects nothing.** Run Lyra without a Supabase backend and there are no
> accounts and no server: your onboarding answers, watchlist, and holdings stay in your
> own browser's local storage, on your own device. Everything below applies only to a
> configured **live** deployment.

## What we collect (live mode)

- **Account details** you provide at sign-up: email address and display name.
- **Preferences** you set: profile/onboarding answers, base currency, dashboard settings,
  and any optional community membership flag.
- **Data you enter:** your portfolio holdings and watchlist items.
- **Delivery destination, only if you set up alerts:** a Telegram chat ID or WhatsApp
  number. This is where alerts are sent and is visible only to you.
- **Anonymous, aggregate usage analytics** (via Vercel Web Analytics): page views and
  interaction counts. No cookies, and no profiling of individuals.
- **Community board participation, if you use it:** ideas you post are public by design
  (title and description only - never your identity). Voting without an account stores a
  random participant key (issued by the server, kept in your browser) purely to count
  each device's vote once; it is not linked to your name, email, account, or anything
  else, and clearing site data forgets it.

## What we never collect

We do not collect bank, brokerage, or payment credentials. We do not access your trading
accounts. We do not sell your data or use it for advertising.

## Where your data lives

Your private data is stored in a Postgres database (Supabase) protected by **Row Level
Security**, which means each row is scoped to your account - other users cannot read or
write your portfolio, watchlist, alerts, or settings. Server-side secrets (bot tokens,
service keys) are never exposed to the browser. Market data (candles, indicators, signals)
is shared, anonymous, and not linked to any user.

## How we use it

To provide the service: personalise signals to what you own and watch, generate your daily
brief, and deliver the alerts you opt into. **We do not send your portfolio to any AI
provider unless you explicitly enable AI assistance.**

## Your controls

You can access and correct your information at any time in the app. You can delete your
account, which cascades to remove your associated data (portfolio, watchlist, alerts,
settings, and analytics references).

## Changes

We may update this policy as the product evolves; material changes will be reflected here
and on the in-app `/privacy` page.

## Contact

Questions about your data can be raised through the app, by opening an issue, or by
contacting the maintainer on GitHub ([@BrysonW24](https://github.com/BrysonW24)). For
anything sensitive, use the repository's private security advisory (see `SECURITY.md`).
