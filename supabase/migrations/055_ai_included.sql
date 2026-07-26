-- 055_ai_included.sql
-- Per-user AI entitlement grant. Two ways a user gets Lyra's HOSTED key (we pay) instead of
-- bring-your-own-key: (1) the automatic free trial - the first 14 days after signup, computed
-- from the account's created_at, needs NO column; (2) a standing grant recorded here - for the
-- founder, comps, or a future paid tier.
--
-- Everyone else is BYOK: the deterministic scanner + notifications never need AI, so a user past
-- their trial keeps the entire product and simply adds their own key to use the chat.
--
-- The app reads this column best-effort (guardAiRoute + /api/ai/status): if it is absent the
-- entitlement falls back to trial-only, so the code is safe to run before OR after this migration.
-- Idempotent + additive (safe to re-run).

alter table public.profiles add column if not exists ai_included boolean not null default false;

-- To grant a specific account the hosted key indefinitely (e.g. the founder), run:
--   update public.profiles set ai_included = true where id = '<user-uuid>';
