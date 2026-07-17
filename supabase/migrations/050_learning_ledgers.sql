-- 050_learning_ledgers.sql
-- The accumulator wave: three ledgers that turn one-shot events into learnable history.
-- All append-mostly, all read by deterministic passes, no model opinion anywhere.
--
--   1. notification_engagements - the first behavioral validation of alerts: every alert
--      deep link now carries ?nid=<event>&ch=<channel>; opening it logs one row. Over
--      time: which alert TYPES a user actually acts on, and whether relevance scores
--      predict engagement (they have never been validated against behavior before).
--   2. component_efficacy - the flagship engine's evidence ledger: nightly, the labeled
--      signal outcomes (signal_outcomes) are joined to the per-component score values
--      (stock_signal_scores) and REBUILT into per-component/band/horizon aggregates.
--      The engine stays deterministic; /signal-quality retunes FROM this, humans decide.
--   3. scout_attach_exceptions - accumulated attach corrections: when the scout maps an
--      item to the wrong vertical (tritium wastewater is not fusion energy), the
--      correction is recorded once and enforced on every future run - same
--      accumulate-and-enforce shape as the verdict stoplist.
-- Idempotent + additive (safe to re-run).

create table if not exists public.notification_engagements (
  id bigint generated always as identity primary key,
  event_id uuid not null,                  -- notification_events.id (soft ref - events may prune)
  user_id uuid,                            -- the event owner at engagement time
  channel text not null,                   -- telegram | slack | push | whatsapp | web
  notification_type text,                  -- denormalized so the ledger survives event pruning
  relevance integer,                       -- the score the alert carried when sent
  engaged_at timestamptz not null default now()
);

-- First engagement per (event, channel) is the signal; repeats are noise.
create unique index if not exists uq_notification_engagement
  on public.notification_engagements(event_id, channel);
create index if not exists idx_notification_engagements_user
  on public.notification_engagements(user_id, engaged_at desc);

alter table public.notification_engagements enable row level security;
drop policy if exists "notification_engagements_owner_select" on public.notification_engagements;
create policy "notification_engagements_owner_select" on public.notification_engagements
  for select to authenticated using (auth.uid() = user_id);

-- Rebuilt nightly from source (idempotent full rebuild - no incremental drift possible).
create table if not exists public.component_efficacy (
  strategy_code text not null,
  component text not null,                 -- rsi | macd | price_location | trend | volume
  band text not null,                      -- low | mid | high (observed terciles per component)
  horizon text not null,                   -- 5d | 20d
  n integer not null default 0,
  win_rate numeric,                        -- share of outcomes with positive return at horizon
  avg_return numeric,
  updated_at timestamptz not null default now(),
  primary key (strategy_code, component, band, horizon)
);

alter table public.component_efficacy enable row level security;
drop policy if exists "component_efficacy_select_all" on public.component_efficacy;
create policy "component_efficacy_select_all" on public.component_efficacy
  for select to anon, authenticated using (true);

create table if not exists public.scout_attach_exceptions (
  id bigint generated always as identity primary key,
  theme text not null,                     -- theme slug the term must NOT attach to
  term text not null,                      -- the offending lowercase term/phrase
  reason text not null default '',         -- the audit trail ("ALPS wastewater is fission cleanup")
  created_at timestamptz not null default now(),
  unique (theme, term)
);

alter table public.scout_attach_exceptions enable row level security;
drop policy if exists "scout_attach_exceptions_select_all" on public.scout_attach_exceptions;
create policy "scout_attach_exceptions_select_all" on public.scout_attach_exceptions
  for select to anon, authenticated using (true);
-- Maintainer-curated, same authority as idea status moderation.
drop policy if exists "scout_attach_exceptions_insert_maintainer" on public.scout_attach_exceptions;
create policy "scout_attach_exceptions_insert_maintainer" on public.scout_attach_exceptions
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'maintainer'));
