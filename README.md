# 📈 Lyra - Stock Momentum Radar

> An hourly tech-stock momentum scanner that spots recovery setups before they're obvious - and explains them in plain English. **Research, not advice.**

Lyra watches the market on an hourly cadence and scores each stock on momentum recovery: RSI lift, MACD histogram turning up, price location, trend context, and volume participation. A deterministic engine owns every number; an optional AI layer just phrases it for you. Runs on **built-in demo data with zero setup**, and scales up to a live, alerting, AI-explained console when you want it.

```bash
git clone https://github.com/BrysonW24/vai-lyra-stock-tracker.git
cd vai-lyra-stock-tracker
npm install && npm run dev -- -p 3042      # ✨ runs on demo data, no keys needed
```

Open http://localhost:3042 and you're in. 🎉

## 🧭 Make it yours - clone, set up, deploy, all guided

This repo is built to be **shared as a link and replicated end to end**. Four things get you from clone to your own live console:

1. **Setup instructions** - agent-paced or human-paced, your pick:
   - **Have [Claude Code](https://claude.com/claude-code)?** Open it in the clone and run **`/setup`** - the repo ships an agent playbook ([`.claude/commands/setup.md`](./.claude/commands/setup.md)) that sets everything up for you, stage by stage, with a verification gate at every step.
   - **Prefer to drive?** Follow the [walkthroughs](./docs/walkthroughs/README.md): [what Lyra is](./docs/walkthroughs/01-what-is-lyra.md) -> [run it in 5 minutes](./docs/walkthroughs/02-run-it-yourself.md) -> [go live with your own Supabase](./docs/walkthroughs/03-go-live-supabase.md) -> [put it online](./docs/walkthroughs/04-deploy-your-own.md) -> [understand the score](./docs/walkthroughs/05-understand-the-score.md).
2. **An AI key (optional)** - set `OPENAI_API_KEY` server-side for hosted explanations, or paste any provider's key in **Settings -> AI** (BYOK, stays in your browser). The console is fully usable with no AI key at all.
3. **Hosting (optional)** - free on Vercel, or your own server with **Coolify** using the included [`Dockerfile`](./Dockerfile): [deploy walkthrough](./docs/walkthroughs/04-deploy-your-own.md) + [Coolify runbook](./docs/runbooks/coolify-deploy.md).
4. **Alerts on your phone** - urgent setups and hourly summaries pushed to you: web push with zero accounts, Telegram in ~10 minutes, WhatsApp honestly scoped: [alerts walkthrough](./docs/walkthroughs/06-alerts-on-your-phone.md).
5. **Costs, fully itemised** - every service in the stack priced in [`COSTS.md`](./COSTS.md). Demo mode is $0; a fully live, always-on setup can run on free tiers.

## 0 - How to Access Lyra

<p align="center">
  <img src="image-2.png" width="30%"
  alt="Three Dots - Share Button" />
  <img src="image-1.png" width="30%"
  alt="Add to Home Screen" />
  <img src="image.png" width="30%"
  alt="Adding to Home Screen" />
</p>

## 1 - Lyra Notifcations

<!-- <p align="center">
  <img src="image-2.png" width="30%"
  alt="Three Dots - Share Button" />
  <img src="image-1.png" width="30%"
  alt="Add to Home Screen" />
  <img src="image.png" width="30%"
  alt="Adding to Home Screen" />
</p> -->

## 1 - Landing Page

<p align="center">
  <img src="assets/image-3.png" width="30%" alt="Landing - hero" />
  <img src="assets/image-12.png" width="30%" alt="Landing - value props" />
  <img src="assets/image-4.png" width="30%" alt="Landing - momentum engine" />
</p>

## 2 - Onboarding

<p align="center">
  <img src="assets/image-5.png" width="30%" alt="Onboarding - reveal" />
  <img src="assets/image-13.png" width="30%" alt="Onboarding - primer" />
  <img src="assets/image-6.png" width="30%" alt="Onboarding - questionnaire" />
</p>
<p align="center">
  <img src="assets/image-14.png" width="30%" alt="Onboarding - capital" />
  <img src="assets/image-7.png" width="30%" alt="Onboarding - watchlist" />
  <img src="assets/image-9.png" width="30%" alt="Onboarding - alerts" />
</p>
<p align="center">
  <img src="assets/image-8.png" width="30%" alt="Onboarding - all set" />
</p>

## 3 - Command Centre

<p align="center">
  <img src="assets/image-1.png" width="30%" alt="Command centre - portfolio" />
  <img src="assets/image-15.png" width="30%" alt="Command centre" />
  <img src="assets/image-16.png" width="30%" alt="Command centre" />
</p>
<p align="center">
  <img src="assets/image-17.png" width="30%" alt="Command centre" />
  <img src="assets/image-18.png" width="30%" alt="Command centre" />
  <img src="assets/image-19.png" width="30%" alt="Command centre" />
</p>
<p align="center">
  <img src="assets/image-20.png" width="30%" alt="Command centre" />
</p>


---

## ✨ What you get

- 🛰️ **Momentum radar** - every tracked stock scored 0-100 with a clear signal state (strong setup / building / near trigger / invalidated)
- 🧮 **Deterministic engine** - RSI, MACD, trend, volume and score are computed in code, never guessed by an AI
- 📊 **Dense command center** - overview, signal radar, per-ticker detail, alerts, and settings
- 💼 **Portfolio + watchlist overlays** - on-the-spot valuation and price-alert thresholds (-10 / -5 / +5 / +10%)
- 🔔 **Telegram alerts** - strong setups and invalidations pushed to your phone (opt-in)
- 🤖 **Optional AI co-pilot** - plain-English briefs and explanations, grounded strictly in the engine's numbers
- 🧪 **Demo-safe everywhere** - no backend? It runs on realistic sample data so you can explore instantly

---

## 🔑 Hosted OpenAI beta. Optional BYOK.

The beta AI layer is wired for a server-side hosted OpenAI key so friends can test Lyra without pasting provider credentials. User keys are still supported and override the hosted key.

- **Hosted default** - set server-side `OPENAI_API_KEY` and new users default to OpenAI (`gpt-5.5`, configurable with `LYRA_HOSTED_OPENAI_MODEL`).
- **Bring your own key (BYOK)** - paste your own API key in **Settings -> AI**. It stays in this browser and is never stored by Lyra.
- **Bring your own model (BYOM)** - pick the exact model you want. Leave it blank for the provider default, or name any model your key can access.
- **Provider-agnostic gateway** - OpenAI, Anthropic, OpenRouter, Gemini, and xAI all route through one server-side gateway.

> The AI **explains**; the deterministic engine **decides**. The model is only ever given facts the engine already computed - it never invents a number and never gives buy/sell advice.

Every brief and explanation has a deterministic fallback, so the app still works if a model call fails.

---

## 🛠️ Three modes - use as much as you want

| Mode | What you need | What you get |
|------|---------------|--------------|
| 🎮 **Demo** | nothing | The full console on built-in sample data. Just `npm run dev`. |
| 📡 **Live** | Supabase + a market-data source | Real hourly scanning, your own tickers, portfolio + watchlist overlays. |
| 🤖 **AI** | `OPENAI_API_KEY` server-side, or a user's BYOK | Hosted beta chat/briefs plus optional user-selected models. |

Run **`npm run doctor`** anytime to see exactly what's configured, what's missing, and which mode you're in. 🩺

Copy [`.env.example`](./.env.example) to `.env.local` and fill in only what you need. See [`QUICKSTART.md`](./QUICKSTART.md) for the friendly walkthrough and [`SECURITY.md`](./SECURITY.md) for key-handling rules (never put a secret in a `NEXT_PUBLIC_*` variable).

---

## 📡 Going live (optional)

1. **Supabase** - apply the migrations in [`supabase/migrations/`](./supabase/migrations/) in numeric order (the canonical schema - auth, RLS, scanner, trades), then run [`sql/_apply_all_scanner_schema.sql`](./sql/_apply_all_scanner_schema.sql) once (idempotent worker-schema reconciliation). Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read-only, frontend) and `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (worker only). Full guide: [go live with your own Supabase](./docs/walkthroughs/03-go-live-supabase.md).
2. **Scan** - `npm run worker:scan` runs the Python scanner once. The included GitHub Actions workflow at [`.github/workflows/hourly-stock-scanner.yml`](./.github/workflows/hourly-stock-scanner.yml) runs it hourly (add your secrets in the repo settings).
3. **Alerts** - add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` to receive pushes.
4. **Host it** - free on Vercel, or self-host with Docker/Coolify: [deploy walkthrough](./docs/walkthroughs/04-deploy-your-own.md) + [Coolify runbook](./docs/runbooks/coolify-deploy.md). Verify any deploy with `/api/health` (returns the running version + mode). Costs: [`COSTS.md`](./COSTS.md).

---

## 🧱 Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Worker:** Python (pandas, yfinance, `ta`, Supabase client) + pytest
- **Data:** Supabase (Postgres) with row-level security; read-only on the frontend
- **AI:** provider/model-agnostic gateway in [`src/lib/ai/gateway.ts`](./src/lib/ai/gateway.ts)
- **Scheduler:** GitHub Actions (hourly)
- **Alerts:** Telegram Bot API

## 📁 Project structure

```
src/app/                  Next.js pages (overview, radar, ticker, alerts, settings)
src/components/           Dashboard + analytics components
src/lib/                  Fetch helpers, demo data, env validation, AI gateway, Pine export
contracts/notifications/  JSON contracts for the AI notification layer
workers/stock_scanner/    Python scanner (indicators, scoring, overlays, alerts)
sql/                      Supabase schema + seed
tests/                    Worker tests
docs/walkthroughs/        Clone-to-live walkthroughs (start here to replicate)
docs/runbooks/            Deploy + operations runbooks (Coolify, kill switch, ...)
docs/                     Architecture, AI engine plan, production hardening
.claude/commands/         /setup - agent playbook for Claude Code users
Dockerfile                Self-hosting image (Coolify/Docker); Vercel ignores it
COSTS.md                  Every service in the stack, priced
```

---

## More from Lyra

<p align="center">
  <img src="assets/image-10.png" width="30%" alt="AI support" />
</p>

<p align="center"><sub><b>Notification management</b> &nbsp;·&nbsp; <b>AI support</b></sub></p>

---

## ⚠️ Disclaimer

Lyra is **research software, not financial advice**. It surfaces and explains technical signals; it does not tell you what to buy or sell. Markets are risky - do your own research and never invest more than you can afford to lose.

## 📄 License

[MIT](./LICENSE) - free to use, fork, and learn from. Built with ❤️ by [Vivacity.ai](https://vivacity.ai).
