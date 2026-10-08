# COSTS.md - what Lyra costs to run, fully itemised

Every service in the stack, priced. All prices are **USD, verified on the provider's own
pricing page on 2026-07-16** unless marked otherwise. Prices drift - if this file is more
than a few months old, spot-check the sources before budgeting.

Companion file: [`DATA-ECONOMICS.md`](./DATA-ECONOMICS.md) - what the live deployment actually
consumes (measured call volumes, table growth, free-tier runway). Prices live here; usage lives there.

## TL;DR - four cost scenarios

| Scenario | What you get | Monthly cost |
|---|---|---|
| **Demo** | The full console on your machine, built-in data | **$0** |
| **Live, free-tier** | Your own Supabase + hourly scanner (GitHub Actions) + Vercel Hobby hosting + Telegram alerts | **$0** (+ ~US$11/yr if you want a domain) |
| **Self-hosted 24/7** | Same, but the web app on your own server (Coolify on a 2GB droplet) | **~US$13/mo** (US$12 droplet + domain amortised) |
| **First paid upgrades** | Supabase Pro when the DB passes 500MB or egress passes 5GB; Vercel Pro only if you commercialise while staying on Vercel | +US$25/mo and/or +US$20/mo |

AI explanations add roughly **US$0.50/mo at hobby volume** (see the AI section) and are
entirely optional - the deterministic engine works without any AI key.

## Full price table

### Hosting the web app (pick ONE path)

| Service | Tier | Price | What you get / limits |
|---|---|---|---|
| Vercel | Hobby | **$0** | 100GB transfer/mo, 1M function invocations/mo. **Personal, non-commercial use only** (their FAQ) - fine for a free beta, not once it charges users |
| Vercel | Pro | US$20/user/mo | Commercial use allowed, usage billing beyond quotas |
| Coolify (self-hosted) | Open source | **$0** forever | The PaaS layer itself: deploys, SSL, cron, services. You pay only for the server under it |
| Coolify Cloud | Managed | US$5/mo (+US$3/server after 2) | They host the Coolify dashboard only - the server is still yours to pay for |
| DigitalOcean droplet | 1GB Basic | US$6/mo | Too tight: Coolify recommends 2GB minimum; 1GB OOMs during Docker builds unless you add swap |
| DigitalOcean droplet | **2GB Basic (realistic floor)** | **US$12/mo** | 1 vCPU / 2GB / 50GiB SSD, 2,000 GiB outbound (overage US$0.01/GiB, inbound free) |
| DigitalOcean droplet | 4GB Basic | US$24/mo | Comfortable: app + side services with headroom |

### Data + backend

| Service | Tier | Price | What you get / limits |
|---|---|---|---|
| Supabase | Free | **$0** | 500MB DB, 50k MAUs, 5GB egress + 5GB cached/mo, 2 active projects. **Pauses after 1 week of inactivity**; no paid overage - exceeding limits restricts the project |
| Supabase | Pro | from US$25/mo | 8GB disk (then $0.125/GB), 100k MAUs, 250GB egress (then $0.09/GB), no pausing |
| GitHub Actions | Public repo | **$0** | Standard GitHub-hosted runners are unconditionally free in public repos (the hourly scanner is genuinely $0). See gotchas below |
| Upstash Redis | Free | **$0** | Optional cache (quotes + hot reads) over serverless REST; the Vercel marketplace integration injects the env vars. Free tier is command-metered; without it Lyra falls back to a built-in in-process cache at no cost. Pricing page not re-verified line-by-line on 2026-07-16 - treat limits as indicative |
| yfinance | Open-source library | **$0** | Unofficial Yahoo Finance access, personal use only, no SLA - Yahoo intermittently rate-limits or breaks it. Fine for a hobby scanner, never a commercial data source |
| Finnhub | Free | **$0** | Free API key; hard 30 calls/sec global cap (verified on provider docs). The commonly cited 60 calls/min free limit + US$12-100/mo paid bundles could not be re-confirmed on their JS-rendered pricing page on 2026-07-16 - treat as indicative. Personal use, no redistribution |
| Firecrawl | Free / Hobby | **$0** / ~US$16/mo | OPTIONAL - activates the scout's ~22 registered crawl targets (pages with no RSS, e.g. DoD daily contracts). Free tier ~500 one-time credits; Hobby ~3,000 credits/mo (indicative, from their pricing page 2026-07-17 - re-verify before paying). Scout runs fine without it on the open RSS + Finnhub layers |

### Notifications

| Service | Tier | Price | What you get / limits |
|---|---|---|---|
| Telegram Bot API | Standard | **$0** | "Bots are able to message their users at no cost" (their FAQ). ~1 msg/sec per chat; the paid broadcast tier only exists above 30 msg/sec AND 100k+ MAU - irrelevant here |
| Web Push (VAPID) | W3C standard | **$0** | Browser-native push, self-generated keypair, no vendor account. Free by design of the standard (no pricing page exists to verify) |
| WhatsApp Cloud API | Meta | not costed | Lyra's WhatsApp layer is architecture-only today (see `docs/walkthroughs/06-alerts-on-your-phone.md`); Meta conversation pricing applies if you ever wire it |

### Native app distribution (optional iOS beta)

| Service | Tier | Price | What you get / limits |
|---|---|---|---|
| Apple Developer Program | Membership | **US$99/yr** | Required for TestFlight + App Store distribution of the iOS shell (`ios/`). Standard published membership fee (founder enrolled 2026-07-18; page not re-verified line-by-line). The shell adds zero runtime cost - it is a remote WKWebView loading the same production web app |

### AI (optional)

| Service | Tier | Price per 1M tokens | Notes |
|---|---|---|---|
| OpenAI gpt-5.4-nano | Standard | US$0.20 in / US$1.25 out | Cheapest text tier; cached input US$0.02 |
| OpenAI gpt-5.4-mini | Standard | US$0.75 in / US$4.50 out | The sensible hosted-beta default; cached input US$0.075 |
| OpenAI gpt-5.6-sol (flagship, for reference) | Standard | US$5.00 in / US$30.00 out | Overkill for chat briefs |

Worked example at hobby volume: 50 chats/day at ~3k input + 500 output tokens each on
gpt-5.4-mini is roughly **US$0.45/mo**. Prompt caching (10% of input price) makes the static
system prompt nearly free. BYOK users pay on their own key; with no key at all, every surface
falls back to deterministic text.

If you set a hosted `OPENAI_API_KEY` so signed-in users get AI without their own key, your spend
is bounded by design: the hosted key is only reachable by an **authenticated** session, is
**rate-limited per user**, and the **model is server-pinned** (a caller cannot select a pricier
model on your key). An anonymous visitor can never spend it. Leave the env var unset to stay
strictly bring-your-own-key.

> Note: Lyra's hosted default `gpt-5.5` still resolves on the OpenAI API (verified against
> the live models endpoint 2026-07-16) but no longer appears on the current pricing page,
> whose lineup is gpt-5.4-mini / gpt-5.4-nano / gpt-5.6-sol. Its per-token price is therefore
> not listed above; if it is ever retired, switch with `LYRA_HOSTED_OPENAI_MODEL`.

#### The daily read (operator's Telegram, Claude on the repo's own key)

| Service | Model | Price per 1M tokens | Measured per read | Projected per month |
|---|---|---|---|---|
| Anthropic Claude API | `claude-opus-5-5` at `high` effort (thinking always on, billed as output) | US$4.00 in / US$20.00 out (list, read 2026-10-05) | **US$0.030-0.046** (5 real reads on 2026-10-06/07: ~2,000 input, 1,100-1,900 output tokens, 12-20 s) | **~US$0.70-1.00** at one read per US session (~22 a month) |

Bounded by code, not by hope: `SUMMARY_MONTHLY_BUDGET_USD` (default **US$10**) is checked against
the ledger before every call; when the measured cost at the configured effort would not last the
month the next read runs one effort level lower, and once the budget is spent the figures go out
with no model call. Set `SUMMARY_MODEL` / `SUMMARY_EFFORT` as repository variables to change the
trade; an unknown model is priced at the dearest row so the ceiling still holds. (It ran hourly
for one day, 2026-10-06, at ~US$5-7 a month before the founder chose once a day.)

#### The AI briefing (every account through the router + the operator's Telegram, Claude with web search on the repo's own key)

| Service | Model and tools | Price | Measured per briefing | Projected per month |
|---|---|---|---|---|
| Anthropic Claude API | `claude-opus-5-5` at `high` effort with `web_search_20260209` + `web_fetch_20260209` | US$4.00 in / US$20.00 out per 1M tokens (cache reads US$0.40, cache writes US$5.00); **US$10 per 1,000 searches**; fetches cost tokens only (list, read 2026-10-07) | **US$2.24** on the one complete real run (2026-10-07: 14 searches, 10 pages opened, 493k input tokens, 6.7k output, 167 s) - every input token priced at the full rate because that run predates the cache split now on the ledger, so the true bill is lower by whatever the API served from cache | **~US$30-50** at one briefing per US business day (~22 a month) before tuning; the ceiling `BRIEFING_MONTHLY_BUDGET_USD` (default **US$40**) holds regardless |

Where the money goes: not the searches (14 cents) but the input tokens - a server-side tool loop
re-reads its whole context on every search iteration, so one long turn with large fetched pages
costs forty to fifty daily reads. The levers, in order: `BRIEFING_MAX_FETCHES` and the per-page cap
(`FETCH_CONTENT_TOKENS`, 6,000 tokens in code), `BRIEFING_MAX_SEARCHES`, `BRIEFING_EFFORT`, and
`BRIEFING_MODEL=claude-sonnet-5-5` at half the token price. Bounded like the read: the month's
spend is read from the ledger before every run, effort steps down when the measured cost would not
last the month, a briefing that was researched but not delivered is resent from the ledger rather
than researched twice, and once the ceiling is reached the evening gets a one-line note instead.
The two runs meant to measure the tuned prompt on 2026-10-07 did not complete: the Anthropic
account's prepaid credit ran out mid-turn (the API answers 400 "credit balance is too low"), which
also stops the daily read's prose until the balance is topped up - both jobs now say so in their
message rather than "error 400".

#### The subscribe-by-link audience (v0.134.0: /subscribe, Telegram through the app's bot, email through Resend)

| Service | What it carries | Price | Notes |
|---|---|---|---|
| Telegram Bot API | Subscriber briefings + the /start and STOP replies | Free | The app's own bot (`TELEGRAM_BOT_TOKEN`), one HTML message per subscriber per evening (split only when long) |
| Resend | The confirmation email (app) + the briefing emails (worker) | Free tier: 3,000 emails/month, 100/day, 3 domains; Pro US$20/month for 50,000 (no daily cap) (list, read 2026-10-08) | ~22 briefings a month per email subscriber, so the free tier carries roughly 130 email subscribers; the daily cap (100) is the first ceiling to watch - past it, sends fail with a 4xx that lands on the row's `last_error` |
| Anthropic | Nothing extra | US$0 | Personalisation is a deterministic reorder of the one shared research run - the per-subscriber cost is a Telegram call or an email, never a model call |

### Domain (optional)

| Service | Price | Notes |
|---|---|---|
| .com (Porkbun) | US$11.08/yr | Registration = renewal; mainstream registrars cluster at US$10-15/yr. Avoid cheap-year-1 / expensive-renewal registrars |
| .com.au (Porkbun) | US$13.70/yr (promo US$7.67 on 2026-07-16) | Requires an Australian presence (ABN/ACN). Budget the regular price |

## The gotchas that actually bite a 24/7 hobby deployment

1. **Supabase free tier pauses after 7 days of inactivity.** The hourly scanner's writes
   normally keep it alive - which couples your app's availability to scanner health. If the
   GitHub Action silently fails for a week, the database (and the whole app) goes down until
   manually restored.
2. **GitHub scheduled workflows auto-disable after 60 days without repository activity.**
   A set-and-forget scanner WILL stop. Commit occasionally or add a keepalive. Also: cron
   fires are delayed at the top of the hour under load - schedule at an odd minute (e.g. 17 past).
3. **Vercel Hobby is non-commercial.** The moment Lyra charges users or promotes a business,
   you need Pro (US$20/user/mo) - or sidestep it entirely by self-hosting on the Coolify box.
4. **RAM, not bandwidth, is the droplet constraint.** 1,000-4,000 GiB outbound is far beyond
   this app's needs and overage is only $0.01/GiB. The US$12 2GB droplet is the realistic
   floor; 1GB OOMs during Docker builds.
5. **Free market data is contractually gray.** yfinance rides Yahoo's personal-use endpoints
   with no SLA; pin versions, add retry/backoff, keep Finnhub as fallback, and never build a
   paid product on it as the sole source.

## Sources

DigitalOcean pricing + bandwidth docs, coolify.io/pricing, supabase.com/pricing,
vercel.com/pricing, GitHub Actions billing docs, pypi.org/project/yfinance,
finnhub.io/docs/api/rate-limit, developers.openai.com/api/docs/pricing,
core.telegram.org/bots/faq, porkbun.com/products/domains - all fetched 2026-07-16.

Lyra is research software, not financial advice - and this file is cost research, not tax
or accounting advice.
