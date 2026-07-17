# Put Lyra online - Vercel or your own server (Docker/Coolify)

This walkthrough takes the Lyra web app from "runs on my laptop" to "has a real URL".
There are two paths:

- **Path A - Vercel**: a hosting platform that builds and serves Next.js apps for you. Simplest, free on the Hobby plan, zero servers to manage.
- **Path B - self-host with Docker**: build the container image from the `Dockerfile` at the repo root and run it anywhere - your own VPS, a home server, or a Coolify instance (Coolify is a self-hosted, open-source Vercel-alternative you run on your own machine).

Either way, remember the framing: Lyra is research tooling, not financial advice. Putting it on the internet does not change that - the deployed app surfaces scores and signals for your own study, nothing more. See [../../DISCLAIMER.md](../../DISCLAIMER.md).

Before starting you should have:

- The repo pushed to a GitHub account you control (a fork is fine).
- Your OWN Supabase project if you want live mode - the founder's project is not shared. Setting that up is covered in the earlier walkthroughs; see the [index](README.md). Without Supabase keys the deployed app still works, it just serves built-in demo data.

One fact that applies to BOTH paths: **the web deploy is only the dashboard + API routes. The Python scanner is not part of it.** The scanner (`workers/stock_scanner/`) runs hourly on GitHub Actions (`.github/workflows/hourly-stock-scanner.yml`, cron `5 * * * *` UTC) and writes to Supabase. Deploying the website does not deploy, move, or duplicate the scanner - it keeps running from your GitHub repo either way.

## Which path should I pick?

| You are... | Pick | Why |
|---|---|---|
| Just trying Lyra out, want a URL in 10 minutes | Path A (Vercel) | Free Hobby tier, auto-deploys on every push, no server |
| Allergic to accounts on big platforms, or already run a VPS | Path B (Docker) | One image, runs anywhere Docker runs |
| Already running Coolify for other apps | Path B (Coolify section) | The Dockerfile was written with Coolify in mind |
| Unsure | Path A | You can always switch later - the same repo supports both (`next.config.js` sets `output: 'standalone'` for Docker, which Vercel simply ignores) |

Running costs for both paths are near zero: Vercel's Hobby plan is free, and the Docker path costs whatever you already pay for the machine it runs on. Every service in the stack is priced, with free-tier limits and the gotchas that actually bite, in [COSTS.md](../../COSTS.md).

## Path A - Vercel (simplest)

Two ways to drive it: the **dashboard** (clicks, below) or the **CLI** (terminal, further below -
this is also the way an agent like Claude Code does it for you in `/setup`).

### A1. Import the repo

1. Sign in at https://vercel.com (the free Hobby plan is enough).
2. Click **Add New... -> Project** and import your GitHub repo.
3. Vercel auto-detects Next.js. The repo also ships a `vercel.json` that pins the framework, `npm install` / `npm run build`, and the `iad1` region - accept the defaults.

You know it worked when the import screen shows **Framework Preset: Next.js** and the Build Command reads `npm run build`.

### A1-alt. The CLI way (agent-friendly, no dashboard)

From the repo root:

```bash
npm install -g vercel        # or prefix every command below with npx
vercel login                 # opens a browser auth flow; finish it there
vercel whoami                # prints your username when login worked
vercel link                  # choose your scope -> "create a new project" -> accept the name
printf '%s' "https://YOUR-REF.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
printf '%s' "YOUR-ANON-KEY"                | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod                # builds and deploys; prints your production URL
vercel git connect           # optional: auto-deploy every push to your fork
```

You know it worked when `vercel --prod` prints a production URL and step A3's health check passes
against it. Skip the two `env add` lines to deploy in demo mode.

### A2. Set environment variables

In the import screen (or later under **Project -> Settings -> Environment Variables**), add:

| Variable | Where to get it | Example shape |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project -> Settings -> API -> Project URL | `https://abcdefghijkl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page -> the `anon` / publishable key | long token starting `eyJ...` or `sb_publishable_...` |

These two are safe to expose - the anon key is designed for browsers and your database's row-level security does the real gatekeeping. **Never** put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable (see [../../SECURITY.md](../../SECURITY.md)).

Optional server-only secrets, used by the API routes if present (all from `.env.example`):

| Variable | Enables | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | Hosted keyless AI chat/briefs (users can still bring their own key) | platform.openai.com |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` | Browser push notifications (VAPID = the standard key pair web push requires) | `npx web-push generate-vapid-keys` |
| `NOTIFICATION_DISPATCH_SECRET` | Lets the GitHub Actions scanner call `/api/notifications/dispatch` on this deploy | Invent a long random string - it must MATCH the same-named GitHub Actions secret |
| `FINNHUB_API_KEY` | Live news / fundamentals / earnings data | finnhub.io free tier |
| `TELEGRAM_WEBHOOK_SECRET` | Secures the Telegram webhook route | Invent it; set the same value when registering the webhook |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | A shared cache across serverless instances (falls back to an in-process cache when unset) | Add the "Upstash for Redis" marketplace integration (**Storage -> Create Database**); it injects these (as `KV_REST_API_*`, which Lyra also accepts) |

Skip everything optional on a first deploy - you can add them and redeploy later.

You know it worked when both `NEXT_PUBLIC_SUPABASE_*` variables appear under **Project -> Settings -> Environment Variables** (and, once A3 deploys, `/api/health` reports `"mode":"live"`).

### A3. Deploy and verify

Click **Deploy**. First build takes a couple of minutes (it runs `scripts/build-content.mjs` as a `prebuild` step, then `next build`).

You know it worked when Vercel shows a green **Ready** deployment and opening the URL shows the Lyra landing page.

Now verify the deploy identity with the health endpoint:

```bash
curl -s https://YOUR-PROJECT.vercel.app/api/health
```

Expected:

```json
{"ok":true,"version":"0.6.0","versionDate":"...","mode":"live"}
```

- `version` must equal the top entry of `RELEASES` in `src/lib/version.ts` on the commit you deployed (`0.6.0` at the time of writing). If it does not, you are looking at a stale deploy.
- `mode` is `"live"` when both `NEXT_PUBLIC_SUPABASE_*` vars were present at build time, `"demo"` otherwise.
- `cache` is `"upstash"` when the Upstash Redis vars (A2) are wired, `"memory"` otherwise - both are healthy; Redis just shares the cache across serverless instances (which the in-process fallback cannot).

### A4. Auto-deploy on push

Nothing to configure - Vercel redeploys on every push to the default branch. Note the repo's pre-push git hook blocks any push that changes shippable code (`src` / `supabase` / `workers` / `public`) without a version bump, so the flow for shipping a change is: prepend an entry to `RELEASES` in `src/lib/version.ts`, run `npm run release`, commit, push.

You know it worked when, after a push, `curl .../api/health` reports the NEW version number within a few minutes.

## Path B - self-host with Docker

### B1. Understand the one non-obvious rule: build args vs runtime env

The repo root `Dockerfile` is multi-stage (`deps` -> `builder` -> `runner`) and treats configuration in two different ways on purpose:

- **`NEXT_PUBLIC_*` variables are BUILD arguments.** Next.js inlines them into the client JavaScript bundle at build time - the browser has no access to your server's environment, so the values are literally baked into the compiled files. Passing them at `docker run` time does nothing to the already-compiled bundle. If you change one, you must rebuild the image.
- **Server-only secrets** (`OPENAI_API_KEY`, `VAPID_PRIVATE_KEY`, `NOTIFICATION_DISPATCH_SECRET`, ...) are **runtime env vars** (`docker run -e ...`). They are read by API routes on each request, never enter the image, and never reach the browser.

The Dockerfile accepts four build args: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. The `.dockerignore` keeps `.env*` files (except the secret-free `.env.example` template), the Python worker (`workers/`, `tests/`), `sql/`, `supabase/`, and docs out of the build context; the final image contains only the standalone server output.

### B2. Build and run locally (proof it works)

From the repo root:

```bash
docker build -t lyra \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY \
  .
```

(Leave both `--build-arg` lines off to build a demo-mode image - useful for a first smoke test with zero credentials.)

You know it worked when the build finishes with an exported image and `docker images lyra` lists it.

Run it:

```bash
docker run --rm -p 3000:3000 lyra
```

Add runtime secrets only if you use those features, for example:

```bash
docker run --rm -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e VAPID_PRIVATE_KEY=... \
  -e VAPID_SUBJECT=mailto:you@example.com \
  -e NOTIFICATION_DISPATCH_SECRET=... \
  lyra
```

Verify:

```bash
curl -s http://localhost:3000/api/health
```

You know it worked when you get `{"ok":true,"version":"0.6.0",...,"mode":"live"}` (or `"mode":"demo"` for a no-args build), and `docker ps` shows the container as `(healthy)` after ~30 seconds - the image has a built-in `HEALTHCHECK` that probes `/api/health` every 30s.

Notes on the image: it serves the Next.js standalone output (`node server.js`) as a non-root `nextjs` user on port 3000, with `NODE_ENV=production` and telemetry disabled.

### B3. Coolify (brief version)

Coolify drives the same Dockerfile; the short version:

1. **Create application** from your GitHub repo, and choose the **Dockerfile** build pack (not Nixpacks) so the repo `Dockerfile` is used.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plus `NEXT_PUBLIC_APP_URL` = your final domain, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` if you use push) as environment variables and **mark each one as a Build Variable** - that is Coolify's way of passing them as Docker build args. This is the step everyone misses.
3. Add server-only secrets (`OPENAI_API_KEY`, `VAPID_PRIVATE_KEY`, etc.) as normal (runtime) environment variables - NOT build variables.
4. Set the port to `3000` and the health check path to `/api/health`.
5. Attach your domain and deploy.

You know it worked when Coolify shows the container **Running (healthy)** and `curl -s https://your-domain/api/health` returns `"mode":"live"` with the expected version.

For the full founder-grade version with screenshots-level detail (server prep, domains, TLS, redeploy discipline), see the runbook: [../runbooks/coolify-deploy.md](../runbooks/coolify-deploy.md).

## Don't forget the scanner

Whichever path you chose, the hourly scanner still lives in GitHub Actions. For a live deploy, go to your GitHub repo -> **Settings -> Environments -> Production** and make sure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL` (your new deployed URL), and `NOTIFICATION_DISPATCH_SECRET` (matching the web deploy's value) are set there. With no secrets set, the workflow no-ops safely and your dashboard stays on demo data.

You know it worked when the **Hourly Stock Scanner** workflow run (trigger one manually via **Actions -> Hourly Stock Scanner -> Run workflow**) goes green and fresh rows appear on the dashboard.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health` says `"mode":"demo"` on Vercel | The two `NEXT_PUBLIC_SUPABASE_*` vars were absent (or added after the last build) - Vercel env changes only apply on the next build | Check both names for typos, then **Deployments -> Redeploy** |
| `/api/health` says `"mode":"demo"` in Docker even though you passed `-e NEXT_PUBLIC_SUPABASE_URL=...` at run time | `NEXT_PUBLIC_*` is inlined at BUILD time; runtime env cannot change it | Rebuild with `--build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=...` |
| Same, but you swear the build args were set | An empty string counts as unset - `src/lib/env.ts` converts blank values to `undefined` | Make sure the arg values are non-empty and the URL is a valid `https://...` URL (Zod validates it) |
| Coolify container loops between starting and unhealthy | Health check hitting the wrong port or path | Port must be `3000`, health check path `/api/health`; do not override the `PORT` env var |
| `git push` rejected with a version-bump error | The repo's pre-push hook (`scripts/check-version-bump.mjs`) blocks shippable-code pushes without a version bump | Prepend an entry to `RELEASES` in `src/lib/version.ts`, run `npm run release`, commit, push (emergency bypass: `VD_SKIP_VERSION=1 git push`) |
| Vercel build fails immediately | Node too old on a custom setting, or a broken lockfile | The repo requires Node >= 20 (`engines` in `package.json`); leave Vercel's Node version at its default (22) |
| Deployed site works but dashboard is empty in live mode | `mode: "live"` only means the keys were present - the tables are empty until the scanner writes | Set the GitHub Actions secrets (section above) and trigger a manual workflow run |
| AI chat says no key is configured | `OPENAI_API_KEY` is a server-side runtime var and was not set on the host | Add it in Vercel env vars (then redeploy) or `docker run -e OPENAI_API_KEY=...`; or just use bring-your-own-key in the app settings |
| Push notifications never prompt/arrive | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` missing at build time, or `VAPID_PRIVATE_KEY` missing at runtime | Generate a pair with `npx web-push generate-vapid-keys`; public half = build arg / Vercel env, private half = runtime secret |
| Scanner runs green but no push/WhatsApp notifications | `APP_BASE_URL` or `NOTIFICATION_DISPATCH_SECRET` missing in the Actions "Production" environment, or the secret does not match the web deploy | Set both; the secret value must be identical on both sides |

Still stuck? `npm run doctor` (locally) prints exactly which keys are present and which mode you are in, and the other walkthroughs in the [index](README.md) cover Supabase setup and the scanner in depth.
