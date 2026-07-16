# Lyra web app - production image for Docker/Coolify self-hosting.
#
# The image contains ONLY the Next.js app (dashboard + API routes + middleware).
# The Python scanner worker is NOT in this image - it runs on the GitHub Actions
# hourly schedule (.github/workflows/hourly-stock-scanner.yml) and writes to Supabase.
#
# NEXT_PUBLIC_* variables are inlined into the client bundle AT BUILD TIME, so they
# must be provided as build args (in Coolify: mark them as "Build Variable").
# Server-only secrets (OPENAI_API_KEY, VAPID_PRIVATE_KEY, ...) are runtime env vars.
#
# Build:  docker build -t lyra --build-arg NEXT_PUBLIC_SUPABASE_URL=... .
# Run:    docker run -p 3000:3000 lyra
# Docs:   docs/runbooks/coolify-deploy.md

# --- deps: install node_modules from the lockfile only ------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `prepare` (git hooks) is a no-op here: no git in the image, and the script self-silences.
RUN npm ci

# --- builder: compile the content pipeline + Next.js standalone output --------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Client-exposed config, inlined at build time (safe to expose - anon/publishable only).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1

# prebuild runs scripts/build-content.mjs (content/*.jsonl -> src/lib/generated/*.json).
RUN npm run build

# --- runner: minimal standalone server, non-root -------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Coolify-friendly liveness probe (busybox wget ships with alpine).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
