-- 060_content_feedback.sql
-- What readers say about the content Lyra sends (v0.137.0). Every message the workers send - the
-- daily read, the AI briefing, the morning guide - is on the record as an ai_runs row (migration
-- 019, written by workers/stock_scanner/generation_record.py) and ends with two Telegram buttons,
-- 👍 Useful and 👎 Not for me. A tap reaches the webhook (src/app/api/webhooks/telegram/route.ts),
-- which writes one row here; the buttons then become six reasons that are the nightly review's six
-- pillars (correctness, relevance, breadth, insight, clarity, freshness - see
-- workers/stock_scanner/content_judge.py), so a reader's "why" lands on the same radar as the
-- judge's score. A reply to the message is kept as a note on the same row.
--
-- One row per reader per generation (the unique index): a reader who changes their mind updates
-- their row rather than adding a vote. reader_ref is 'sub:<subscriber id>', 'user:<profile id>' or
-- 'chat:<first 16 hex of sha256(chat id)>' - never a raw chat id.
--
-- generation_id is deliberately not a foreign key: ai_runs rows are an append-only audit trail
-- that cascades away with a deleted profile, and a reader's feedback must never be lost or block
-- that delete. The worker only attaches buttons to a message whose ai_runs row was written.
--
-- RLS is enabled with NO policies on purpose: only the service role (the webhook and the review)
-- reads or writes this table. Readers never see each other's feedback.
-- Idempotent + additive (safe to re-run).

create table if not exists public.content_feedback (
  id uuid primary key default gen_random_uuid(),
  -- The ai_runs row of the message the reader reacted to.
  generation_id uuid not null,
  reader_ref text not null,
  reader_kind text not null check (reader_kind in ('subscriber', 'account', 'chat')),
  -- Erasing an account (DELETE /api/account cascades from profiles) erases its feedback too:
  -- reader_ref and a note would otherwise outlive the account they describe.
  user_id uuid references public.profiles(id) on delete cascade,
  subscriber_id uuid references public.briefing_subscribers(id) on delete set null,
  channel text not null default 'telegram' check (channel in ('telegram', 'email', 'web')),
  -- null until the reader taps 👍 or 👎 (a reply alone leaves a note with no rating).
  rating text check (rating in ('up', 'down')),
  -- The reason chip they chose, as a review pillar; null when they skipped it.
  pillar text check (pillar in ('correctness', 'relevance', 'breadth', 'insight', 'clarity', 'freshness')),
  -- A reply to the message, kept as written (at most 1000 characters).
  note text check (note is null or char_length(note) <= 1000),
  -- Telegram's id for the message they reacted to, so a reply can be matched to it.
  telegram_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_content_feedback_reader
  on public.content_feedback (generation_id, reader_ref);
create index if not exists idx_content_feedback_time
  on public.content_feedback (created_at desc);

alter table public.content_feedback enable row level security;
-- No policies: service role only.
