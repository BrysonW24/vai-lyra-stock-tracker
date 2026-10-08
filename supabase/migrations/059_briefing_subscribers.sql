-- 059_briefing_subscribers.sql
-- The AI briefing's subscribe-by-link audience (v0.134.0): people WITHOUT a Lyra account who
-- answered three questions at /subscribe (what they hold, which topics, where to send it) and get
-- the evening briefing on Telegram or by email, personalised by the deterministic reorder in
-- workers/stock_scanner/briefing_subscribers.py (their holdings first, their topics next).
--
-- Why a table of its own and not notification_channels: that table hangs off profiles(user_id NOT
-- NULL), so every row there is an account - the whole point here is that a friend of the founder
-- needs no account, no onboarding, no password. A subscriber who later signs up is linked through
-- user_id (nullable) rather than migrated.
--
-- Proof of ownership is the channel itself: a Telegram chat id is learnt ONLY from the bot's own
-- /start webhook (never typed), and an email address is active only after its confirmation link is
-- opened. The links are signed (HMAC over the row id, see src/lib/subscribe-server.ts and the
-- worker) so nothing secret has to be stored here beyond the random public `token`.
--
-- RLS is enabled with NO policies on purpose: only the service role (the API routes and the worker)
-- reads or writes this table. The anon key and signed-in users see nothing.
-- Idempotent + additive (safe to re-run).

create table if not exists public.briefing_subscribers (
  id uuid primary key default gen_random_uuid(),
  -- Random public handle: the Telegram deep-link start parameter and the /subscribe status poll.
  token text not null unique,
  channel text not null check (channel in ('telegram', 'email')),
  -- Lower-cased; email subscribers only.
  email text,
  -- Learnt from the bot's /start update; Telegram subscribers only.
  telegram_chat_id text,
  -- Subset of the briefing categories (investment, infrastructure, ai_release, emerging, developer)
  -- plus 'holdings' = only items that touch what I hold. Empty = everything.
  topics text[] not null default '{}',
  -- Upper-cased symbols as typed (QQQ, CRWD, NVDA...), at most 20; matched against each item's
  -- ticker and lyra_symbols by the worker. Never looked up, never priced here.
  holdings text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  unsubscribe_reason text,
  -- Set when a signed-in account subscribes; otherwise null (no account needed).
  user_id uuid references public.profiles(id) on delete set null,
  source text,
  -- Delivery ledger for the worker: the reader-local date last delivered (so a resend firing never
  -- sends twice), how many briefings reached this person, and the last provider error (short,
  -- never a token).
  last_sent_date date,
  sent_count integer not null default 0,
  last_error text,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_briefing_subscribers_status on public.briefing_subscribers(status);
-- One live subscription per inbox and per chat. A re-subscribe supersedes the earlier row
-- (the code marks it unsubscribed with reason 'replaced' before activating the new one).
create unique index if not exists idx_briefing_subscribers_live_email
  on public.briefing_subscribers(email) where status = 'active' and email is not null;
create unique index if not exists idx_briefing_subscribers_live_chat
  on public.briefing_subscribers(telegram_chat_id) where status = 'active' and telegram_chat_id is not null;

alter table public.briefing_subscribers enable row level security;
-- No policies: service role only (see the header).
