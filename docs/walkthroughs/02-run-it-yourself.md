# Run Lyra yourself in 5 minutes (demo mode, zero keys)

Lyra is a stock momentum research console - a Next.js web app plus a Python scanner that scores tech stocks on momentum recovery. This walkthrough gets the web app running on your own machine in **demo mode**: no API keys, no database, no accounts. You get the full UI on built-in demo data.

Lyra is research tooling, not financial advice. Nothing it shows is a recommendation to buy or sell anything.

Other walkthroughs in this series live in [the index](./README.md) - go there next when you want live scanning, alerts, or the AI layer.

## What "demo mode" means

The app checks two environment variables at startup: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase is the hosted Postgres database Lyra uses in live mode). If either is missing, the app automatically runs on demo data. There is no flag to flip - absence of keys IS demo mode. Since you will not set any environment variables in this walkthrough, you get demo mode by default.

## Prerequisites

| Requirement | Version | Why |
|---|---|---|
| Node.js | >= 20 | Enforced by the `engines` field in `package.json` (`node >= 20.0.0`) |
| npm | >= 10 | Also enforced by `engines` (`npm >= 10.0.0`); ships with current Node 20 LTS releases (Node 20.9+). Very early Node 20.x carried npm 9 - if `npm -v` shows 9.x, update Node to the latest 20.x or run `npm install -g npm@10` |
| git | any recent | To clone the repo |

Check what you have:

```bash
node -v
npm -v
git --version
```

**You know it worked when:** `node -v` prints `v20.x.x` or higher and `npm -v` prints `10.x.x` or higher. If Node is older than 20, see [Troubleshooting](#troubleshooting) below.

You do NOT need Python for this walkthrough. Python is only for the scanner worker (`workers/stock_scanner/`), which needs a database to write to and therefore does nothing useful in demo mode.

## Step 1 - Clone the repo

```bash
git clone https://github.com/BrysonW24/vai-lyra-stock-tracker.git
cd vai-lyra-stock-tracker
```

**You know it worked when:** `ls` shows `package.json`, `src/`, `workers/`, and `content/` in the new directory.

## Step 2 - Install dependencies

```bash
npm install
```

This installs the JavaScript dependencies (Next.js 15, React 19, the Supabase client, Tailwind, Vitest, and friends). It also runs a `prepare` script that points git at the repo's `.githooks/` directory - that installs a pre-push guard which blocks pushes that ship code without a version bump. Harmless for you; it only matters if you ever push commits.

**You know it worked when:** the command exits without errors and a `node_modules/` directory exists. Warnings about deprecated transitive packages are normal.

## Step 3 - Start the dev server

```bash
npm run dev
```

Two things happen, in order:

1. **The content pipeline runs first.** The `predev` hook runs `scripts/build-content.mjs`, which compiles the editable JSONL files in `content/` (IPO facts, market themes, supply-chain nodes, finance-education facts, and so on - one JSON record per line) into importable JSON under `src/lib/generated/`. Client components cannot read the filesystem at runtime, so this bake step is how curated content reaches the UI. You will see one line per domain, like `content: ipos -> 51 records`, ending with a summary such as `content: 9 domain(s), 326 record(s) compiled`.
2. **Next.js starts.** You will see `▲ Next.js 15.x.x` and `- Local: http://localhost:3000`.

### Which port? (3000 vs 3042 - the honest answer)

The `dev` script in `package.json` is plain `next dev`, and Next.js defaults to **port 3000**. So a bare `npm run dev` serves at `http://localhost:3000`.

However, the project's own convention is port **3042**: the README's quickstart already uses `npm run dev -- -p 3042` and opens `http://localhost:3042`, `QUICKSTART.md` and `npm run doctor` tell you the same, and `.env.example` sets `NEXT_PUBLIC_APP_URL=http://localhost:3042`.

Either port works fine for demo mode. To follow the project convention:

```bash
npm run dev -- -p 3042
```

| Choice | Command | Open in browser |
|---|---|---|
| Next.js default | `npm run dev` | http://localhost:3000 |
| Project convention | `npm run dev -- -p 3042` | http://localhost:3042 |

**You know it worked when:** the terminal shows `✓ Ready in ...` with a `Local:` URL, and opening that URL in a browser loads a page (the first compile after opening can take a few seconds - that is Next.js compiling routes on demand in dev mode).

## Step 4 - What you will see first: /welcome and onboarding

In demo mode there are no user accounts, but the app still has a front door. The middleware (`src/middleware.ts`) checks for a browser cookie named `lyra_onboarded`:

- **First visit** (no cookie): you are redirected to `/welcome`, a public landing page. Its "Set up my console" call-to-action leads into `/onboarding`.
- **Onboarding** is a short guided setup (risk framing, picking what you care about). When you finish it, the app sets `lyra_onboarded=1` as a cookie valid for one year.
- **Every visit after that:** you land straight in the app.

Onboarding is mandatory - until the cookie is set, any page outside the public funnel (`/welcome`, `/onboarding`, `/auth`, `/privacy`, and `/api` routes) redirects you back to `/welcome`. If you ever want to see the first-run flow again, delete the `lyra_onboarded` cookie in your browser dev tools (or use a private window).

**You know it worked when:** visiting `http://localhost:3000/` redirects you to `/welcome` on first visit, and after completing onboarding the same URL shows the Command Centre dashboard instead.

## Step 5 - Confirm your mode with the doctor

In a second terminal (leave the dev server running):

```bash
npm run doctor
```

This is a dependency-free script (`scripts/doctor.mjs`) that reads your environment and reports what is configured. With zero keys you will see mostly yellow `•` warnings - that is expected and correct for demo mode:

```
✓ Node 20.x.x
• Frontend Supabase not set - dashboard runs on demo data
• Worker Supabase not set - the scanner cannot persist results
• Telegram not configured - alerts are off (optional)
...
Mode: Demo mode (no keys) - exploring the UI on demo data
```

**You know it worked when:** the last section prints `Mode: Demo mode (no keys) - exploring the UI on demo data`.

You can also hit the health endpoint (`src/app/api/health/route.ts`), which hosting platforms use as a liveness probe:

```bash
curl http://localhost:3000/api/health
```

**You know it worked when:** you get JSON shaped like `{"ok":true,"version":"0.6.0","versionDate":"...","mode":"demo"}`. The `version` comes from `src/lib/version.ts` and `mode` is `"demo"` because the Supabase vars are absent.

## What works in demo mode - and what does not

### Works

| Area | What you get |
|---|---|
| Command Centre (`/`) | The main dashboard: scored signals, score breakdowns, portfolio and watchlist panels, recent signal changes |
| Signal scores | Real math, not canned numbers: the server computes the deterministic momentum-recovery score (RSI, MACD, price location, trend, volume - capped at 100, strong >= 75, watchlist >= 60) from real daily prices fetched from Yahoo, via `src/lib/live-signals.ts`. If the fetch fails (e.g. you are offline), each symbol falls back to its static demo value silently |
| Exploration surfaces | IPO radar (`/ipos`), themes (`/themes`), supply-chain map (`/supply-chain`), calendar (`/calendar`), commodities, smart money, charts, comparison, and more - all fed by the baked `content/` data and demo fixtures |
| Education + calculators | `/education` and `/calculators` are fully static-friendly |
| Portfolio entry | Holdings you add are kept in your browser's localStorage (`src/lib/local-portfolio.ts`) so the dashboard reflects your book - browser-local only, never sent anywhere |
| Onboarding + welcome flow | The full first-run experience |

### Does not work (by design, without keys)

| Area | Why not |
|---|---|
| Real hourly scanning | The Python worker (`npm run worker:scan`) needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to persist results. In production it runs hourly via the GitHub Actions workflow `.github/workflows/hourly-stock-scanner.yml` |
| Your own ticker list | Tickers live in the database; demo mode shows the built-in demo set |
| Sign-in / accounts | Auth is Supabase-backed; without Supabase the app runs open with no login |
| Telegram / web-push alerts | Need bot tokens and VAPID keys respectively |
| AI chat and briefs | Need a server-side `OPENAI_API_KEY` (or your own key entered in the UI) |
| Cross-device persistence | Portfolio/watchlist edits stay in the one browser's localStorage |

Setting those up is what the live-mode and scanner walkthroughs in [the index](./README.md) cover - each needs your OWN Supabase project (free tier is fine), not anyone else's.

## Prove the checkout is healthy

Two commands, both key-free:

```bash
npm run type-check   # bakes content, then runs tsc --noEmit (TypeScript strict check)
npm run test         # runs the frontend Vitest suite
```

**You know it worked when:** `type-check` exits silently after the `content: ... compiled` lines (no output from `tsc` means no type errors), and `test` ends with all test files passing - as of v0.6.0 that is `Test Files 28 passed (28)` and `Tests 255 passed (255)`. Exact counts will grow over time; what matters is zero failures.

(`npm run worker:test` runs the Python scanner tests - skip it here, it needs a Python environment with `requirements.txt` installed.)

## Troubleshooting

### "Unsupported engine" warning or weird syntax errors on startup

Your Node is too old. The repo requires Node >= 20 (`engines` in `package.json`). Check with `node -v`. Install Node 20+ via [nodejs.org](https://nodejs.org) or a version manager (`nvm install 20 && nvm use 20`). Note: `npm run doctor` only flags Node below 18 (Next 15's hard floor), but match the repo's declared 20+ to stay off the unsupported path.

### Port already in use (`EADDRINUSE`)

Something else is on 3000 (or 3042). Either stop it, or pick another port:

```bash
npm run dev -- -p 3105
```

Then open `http://localhost:3105`. Any free port works in demo mode.

### Dev server refuses to start with `content: <file>:<line> invalid JSON`

The content pipeline (`predev`) validates every line of every `content/*.jsonl` file and exits with code 1 on the first malformed line, which aborts `npm run dev`. The error names the exact file and line number. Fix that line (each non-comment line must be a complete JSON object) and rerun. Blank lines and lines starting with `//` are allowed.

### I keep getting bounced to /welcome

That is the middleware doing its job: no `lyra_onboarded=1` cookie means you have not finished onboarding. Complete the onboarding flow once, or if you did and it still bounces, check that your browser accepts cookies from localhost (private windows drop cookies when closed).

### The doctor says things are "missing" - is that bad?

No. In demo mode every `•` warning about Supabase, Telegram, VAPID, Finnhub, and OpenAI is expected. Only red `✗` lines are problems - the one to genuinely never ignore is the security check that fires if `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is set. Note the doctor checks exactly that one variable name - it cannot detect a service-role key hidden in any other `NEXT_PUBLIC_*` variable, so never put secrets in `NEXT_PUBLIC_*` at all (see `SECURITY.md`).

### Signal numbers differ from a screenshot or from someone else's machine

Expected. Demo mode still computes scores from real current Yahoo price data when it can, so scores move with the market. Offline, you get the static demo snapshot instead. Both are correct behaviour.

### `npm run worker:scan` fails

In demo mode it is supposed to be unused. It runs `python -m workers.stock_scanner.main`, which needs Python, `pip install -r requirements.txt`, and Supabase credentials. Leave it for the scanner walkthrough.

## Where to next

- Back to [the walkthrough index](./README.md) for the rest of the series - going live with your own Supabase project, running the scanner, wiring alerts, and the AI layer.
- `QUICKSTART.md` at the repo root is the condensed version of all modes.
- `DISCLAIMER.md` - worth an actual read: Lyra is research software, and every score it produces is an input to your own thinking, not advice.
