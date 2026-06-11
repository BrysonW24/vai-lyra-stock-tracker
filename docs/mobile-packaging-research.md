# Lyra (vdapp42) — Mobile Packaging Research

> **Question:** how much effort to put Lyra on a phone as an installable / App Store app —
> via PWA, an iOS web wrapper, Capacitor, or Expo / React Native?
> **Captured:** 2026-06-07. **Status:** research / decision input — nothing built yet.

## TL;DR

Lyra is a **Next.js 15 App Router** app that leans on **server components, request-time
server data fetching, Route Handlers (API), and SSR middleware (Supabase auth)**. That one
fact drives every option below: Capacitor wants a *static* web bundle, and a server-rendered
Next app does not export to one. So the cheap wins are web-native (PWA / hosted wrapper); the
expensive ones require either decoupling the frontend from SSR or rebuilding the UI natively.

**Recommended sequence:** Deploy to Vercel (Phase 8) → **PWA** for instant "on my phone" →
only invest in Capacitor-hosted or Expo when a concrete driver appears (App Store listing,
native push, paying users asking). Native push isn't urgent — alerts already go out via
Telegram/WhatsApp.

## The architectural constraint

| Lyra uses today | Why it blocks a static/Capacitor bundle |
|---|---|
| `async` server components (`await getDashboardData()` in `app/page.tsx`) | Render at request time on a server; can't be pre-baked into a static file |
| Route Handlers (`app/api/*`) | Server endpoints — need a Node/edge runtime, not a webview |
| SSR middleware (`middleware.ts`, Supabase auth + onboarding gate) | Runs on every request on the server/edge |
| `next/headers`, cookies, dynamic rendering | All request-time server features |

`output: 'export'` (static export) only supports a fully static app — none of the above.

## Options, lowest → highest effort

### 1. PWA (installable web app) — ~hours
Add `manifest.json` + icons + a service worker. Installs to the iOS home screen, runs
full-screen with an app icon, works offline-ish for the shell.
- **Pros:** cheapest; no App Store; no native code; app is already mobile-responsive.
- **Cons:** iOS PWA push is limited (improved in iOS 16.4+, still constrained) — but Lyra
  alerts via Telegram/WhatsApp, so push isn't a blocker. No App Store presence.
- **Verdict:** **best first step** to get it on your actual phone like an app.

### 2. iOS wrapper / Capacitor pointing at the HOSTED URL — ~1–2 days
A thin native shell (`WKWebView` / Capacitor `server.url`) loads the deployed Vercel URL.
- **Pros:** App Store-submittable binary; unlocks native plugins (push, biometrics, haptics).
- **Cons:** needs the server always online (no real offline); Apple sometimes rejects thin
  "it's just a website" wrappers (Guideline 4.2 — wants native value-add); requires deploy first.
- **Verdict:** viable once there's a reason to be in the App Store.

### 3. Capacitor with a real bundled frontend — ~1–3 weeks
To bundle the UI *inside* the binary you must decouple from SSR: convert server components →
client components with client-side fetching, move auth off middleware to client/edge, and host
the Route Handlers as a separate API. Effectively: Next-SSR → SPA + standalone API.
- **Pros:** proper offline-capable native package.
- **Cons:** real rework because the app leans on server rendering today.

### 4. Expo / React Native (true native rebuild) — ~3–6+ weeks
Expo is **not a wrapper** — it renders native components, so you don't wrap the web app, you
rebuild the UI in React Native.
- **Reusable as-is:** the entire Python worker + Supabase backend; the deterministic logic and
  types in `src/lib/*`; the API contracts.
- **Rebuilt:** every `.tsx` screen (Tailwind → RN styling), Next routing → Expo Router.
- **Pros:** best native UX; most defensible App Store story.
- **Cons:** biggest cost; two frontends to maintain unless web is retired.

## Monorepo context

The repo already has a Capacitor reference — **Podium** (`mobile-apps/apps/podium`, the
`react-capacitor` lane). But Podium is a **Vite SPA**, which is Capacitor-friendly; Lyra being
Next-SSR is the mismatch. The VD Apps factory even treats `next-app` and `react-capacitor` as
**separate scaffold lanes**, which confirms Next-SSR is not the natural Capacitor route.

## Effort summary

| Option | Effort | App Store | Offline | Native push | Rework |
|---|---|---|---|---|---|
| PWA | ~hours | ✗ | partial | limited | none |
| Capacitor → hosted URL | ~1–2 days | ✓ | ✗ | ✓ | thin shell |
| Capacitor + bundled SPA | ~1–3 wks | ✓ | ✓ | ✓ | SSR → SPA + API |
| Expo / React Native | ~3–6+ wks | ✓ | ✓ | ✓ | rebuild UI |

## Recommendation

Ship web → PWA now; defer Capacitor/Expo until a concrete driver justifies it. Re-evaluate
once Lyra has paying users and a reason to be in the App Store (native push, widgets, offline).
