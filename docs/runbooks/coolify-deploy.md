# Runbook - deploy Lyra on Coolify

Deploy the Lyra web app as a Docker container on a [Coolify](https://coolify.io) server.
Coolify is an open-source, self-hostable PaaS (a self-owned Heroku/Vercel): you point it at a
GitHub repo, it builds the Dockerfile and runs the container behind its Traefik proxy with
automatic HTTPS.

What runs where after this runbook:

```
GitHub Actions (hourly scanner, free)  --->  Supabase (data + auth)  <---  Coolify (this web app)
```

The Python scanner is NOT part of the container - it stays on the GitHub Actions schedule
(`.github/workflows/hourly-stock-scanner.yml`). The container is the Next.js app only
(dashboard + API routes + middleware), built from the `Dockerfile` at the repo root.

Costs for every piece of this stack are itemised in [`COSTS.md`](../../COSTS.md).

## Prerequisites

- A Coolify v4 instance you can log in to. Either:
  - self-hosted (free) on any VPS - a US$6-12/mo DigitalOcean/Hetzner box is enough, or
  - [Coolify Cloud](https://coolify.io/pricing) (they host the control plane, you bring the server).
- This repo pushed to GitHub (public works out of the box; private needs a GitHub App in Coolify).
- Your Supabase project URL + anon/publishable key (see
  [`docs/walkthroughs/03-go-live-supabase.md`](../walkthroughs/03-go-live-supabase.md)).
- A domain or subdomain you can point at the server (optional but recommended).

## 1. Create the application

1. Coolify -> your project -> environment (e.g. `production`) -> **+ New** -> **Public Repository**
   (or Private via GitHub App).
2. Repository URL: `https://github.com/BrysonW24/vai-lyra-stock-tracker` (or your fork). Branch: `main`.
3. **Build Pack: Dockerfile.** Coolify auto-detects the root `Dockerfile`; keep the default
   Dockerfile location `/Dockerfile` and base directory `/`.
4. **Ports Exposes: `3000`** (the container listens on 3000; the proxy handles 80/443).

You know it worked when: the app appears in Coolify with a Dockerfile build pack badge and an
auto-generated `*.sslip.io` preview URL.

## 2. Environment variables - the build-time vs runtime split (this is the step people get wrong)

Next.js **inlines `NEXT_PUBLIC_*` values into the client JavaScript at build time**. If they are
missing during the Docker build, the app compiles fine but ships in demo mode forever, no matter
what you set at runtime. The Dockerfile therefore accepts them as build args - in Coolify you must
mark each one as a **Build Variable**.

In the app's **Environment Variables** tab add:

| Variable | Build Variable? | Value | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | `https://<ref>.supabase.co` | safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **yes** | your anon / publishable key | safe to expose by design |
| `NEXT_PUBLIC_APP_URL` | **yes** | `https://your-domain` | used in links/callbacks |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **yes** | from `npx web-push generate-vapid-keys` | only if you want web push |
| `OPENAI_API_KEY` | no (runtime) | `sk-...` | optional - powers the hosted AI beta; users can still BYOK |
| `VAPID_PRIVATE_KEY` | no (runtime) | pair of the public key | web push |
| `VAPID_SUBJECT` | no (runtime) | `mailto:you@example.com` | web push |
| `NOTIFICATION_DISPATCH_SECRET` | no (runtime) | long random string | protects `/api/notifications/dispatch` |
| `APP_BASE_URL` | no (runtime) | `https://your-domain` | worker -> app dispatch target |

Never set `SUPABASE_SERVICE_ROLE_KEY` on the web app. It is a worker-only secret (GitHub Actions),
and nothing in the container needs it.

You know it worked when: the deploy log's `docker build` section shows your
`--build-arg NEXT_PUBLIC_SUPABASE_URL=...` values, and after deploy
`curl https://<your-app>/api/health` returns `"mode":"live"`.

## 3. Health check

App -> **Health Checks**: enable, path `/api/health`, port `3000`, scheme `http`.
The endpoint is public and returns:

```json
{ "ok": true, "version": "0.7.0", "versionDate": "2026-07-16", "mode": "live" }
```

`version` is your deployment receipt: if it does not match `RELEASES[0]` in
[`src/lib/version.ts`](../../src/lib/version.ts), you are looking at a stale build.

## 4. Domain + HTTPS

App -> **Domains**: add `https://lyra.your-domain.com`. Point a DNS `A` record at the server IP
first; Coolify's Traefik proxy provisions the Let's Encrypt certificate automatically.
Then update `NEXT_PUBLIC_APP_URL` + `APP_BASE_URL` to the real domain and redeploy (the
`NEXT_PUBLIC_*` change requires a rebuild - it is a build-time value).

## 5. Deploy + verify

Click **Deploy** and watch the build log. First build takes a few minutes (npm ci + Next build);
later builds reuse Docker layer cache.

Verification gates, in order:

1. Build log ends with the image being pushed/started, not an `npm run build` error.
2. Container status healthy (the Dockerfile HEALTHCHECK probes `/api/health` every 30s).
3. `curl -s https://<your-app>/api/health` -> `{"ok":true,...,"mode":"live"}` with the version you shipped.
4. Open the app: you land on `/welcome`, can sign up / sign in via your Supabase auth.
5. After the next scanner run (hourly), live scores appear instead of demo data.

## 6. Updates

Coolify can auto-deploy `main` on push (Webhooks tab -> GitHub webhook), or you can keep deploys
manual with the Deploy button. Every shipped change bumps the app version (enforced by the repo's
pre-push guard), so `/api/health` always tells you exactly what is running.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| App runs but shows demo data | `NEXT_PUBLIC_*` not marked as Build Variable, so the build inlined nothing | Mark them Build Variables, redeploy (rebuild, not restart) |
| Build dies partway with no clear error | Server ran out of memory during `next build` | Build needs ~2GB free; stop other builds, add swap, or use a bigger box. Never run two builds at once on a small server |
| `/api/health` 404 | Old image (pre-0.7.0) | Redeploy from `main` |
| Certificate not issued | DNS record not propagated before adding the domain | Verify `dig +short lyra.your-domain.com`, then re-save the domain |
| Sign-up email never arrives | Supabase email confirmation is on and using default SMTP rate limits | Check Supabase Auth logs; add custom SMTP or disable confirmation for testing |

## Operator notes - Vivacity droplet (founder-specific)

For the Vivacity Coolify instance specifically (skip this section if you are not Bryson):

- The droplet **OOMs on concurrent builds**. Deploy Lyra manually, one build at a time, never
  while a Vivacity platform build is running. A build log that stops at "Creating an optimized
  production build" is the OOM signature.
- Coolify identifiers (project/app/environment UUIDs) **drift - resolve them via the API every
  time, never hardcode**. Token lives as `COOLIFY_API_KEY` in the canonical env store; the
  environment name is `prod`.
- Vercel remains a parallel host for Lyra until deliberately consolidated; both build from the
  same `main` + Dockerfile-free path (Vercel ignores the Dockerfile).
