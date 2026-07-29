# lyra-back-office - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Legal, billing, invoices, taxes, subscriptions, support, vendors, compliance. Today: a monetisation
**primitive** and the **legal/compliance surface** exist; the commercial back office is greenfield.

## Lyra as it is today
- **No billing/invoicing/subscription system.** There is no Stripe integration (the `billing` string
  matches in the codebase are unrelated push/notification code). Payments, invoices, and tax are not built.
- **Monetisation primitive exists:** BYOK (bring-your-own-key, browser-local) plus a hosted-key
  entitlement. `supabase/migrations/055_ai_included.sql` grants the hosted key two ways - a 14-day free
  trial computed from `created_at` (no column), and a standing `ai_included` boolean for the founder,
  comps, or a future paid tier. Read best-effort by `src/lib/ai/entitlement.ts` (tested) + `/api/ai/status`.
  The deterministic product needs no AI, so a lapsed user keeps everything and just adds their own key.
- **Legal/compliance surface:** `DISCLAIMER.md` (research-only, not financial advice), `PRIVACY.md`,
  `SECURITY.md`, and the `/privacy` + `/terms` public pages. Entity (estate record): sole trader,
  Vivacity Digital.
- **Support:** the `/support` page + `/api/feedback` route.

## How it works
Entitlement gates WHO gets the hosted key, never what a number is. Everything commercial downstream of
that (charging for `ai_included`, invoices, tax) is not yet built.

## Strengths (verified)
- The entitlement model is real, migration-backed, and tested - a clean seam for a future paid tier.
- Legal disclaimers and a support channel are live before monetisation, which is the right order.

## Gaps, risks, what is missing
- Greenfield: billing, invoicing, tax, formal subscription tiers, vendor management, support-ticket tracking.
- The research-only framing must stay airtight as any paid tier lands (compliance risk on a finance app).

## Where to find it
`src/lib/ai/entitlement.ts`, `supabase/migrations/055_ai_included.sql`, `DISCLAIMER.md`, `PRIVACY.md`,
`SECURITY.md`, `src/app/{privacy,terms,support}/`, `src/app/api/feedback/route.ts`.

## Posture
Entitlement primitive + legal disclaimers live; commercial back office greenfield.
