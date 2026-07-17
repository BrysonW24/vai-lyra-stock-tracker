-- 049: align the news-intelligence tables with what the intelligence worker actually writes.
--
-- THE BUG (loud since v0.47.0, silent for months before that):
-- "intelligence worker failed: fetched 25 news items but persisted 0 - every write was
-- rejected." Two root causes, both schema-vs-worker splits:
--
-- 1. 014_future_intelligence.sql created news_items/ticker_news_map with one shape
--    (title / payload; news_id+symbol FKs), but workers/intelligence_worker/main.py writes
--    the legacy sql/007 shape (headline / summary / category / relevance; ticker+headline+
--    source) and upserts on conflict targets (headline,source) / (ticker,headline,source)
--    that the migration tables never had. Same disease 042 cured for fundamental_snapshots.
-- 2. hype_scores exists ONLY in legacy sql/007 - a migrations-built database has no such
--    table at all, so the hype leg of the same worker also persists nothing.
--
-- Additive like 042: legacy 014 columns stay in place (unused, nullable) so this applies
-- cleanly to a database in either state and no existing row is lost. NOT NULL constraints
-- on legacy FK columns are relaxed instead of dropped - the worker does not supply them.
-- Full (non-partial) unique indexes back the upserts, per the 041/044 lesson: a partial
-- index cannot be an ON CONFLICT target.

-- 1. news_items: the columns the worker writes that 014 never defined.
alter table public.news_items add column if not exists headline text;      -- 014 named it title
alter table public.news_items add column if not exists summary text;
alter table public.news_items add column if not exists source_domain text;
alter table public.news_items add column if not exists category text;
alter table public.news_items add column if not exists relevance text;     -- 014 had relevance_score numeric
alter table public.news_items add column if not exists updated_at timestamptz default now();

-- Backfill so any pre-existing 014-shape rows keep their identity under the new key.
update public.news_items set headline = title where headline is null and title is not null;

-- The upsert key: .upsert(..., on_conflict="headline,source") needs a matching FULL
-- unique index or every write is rejected outright.
create unique index if not exists ux_news_items_headline_source
  on public.news_items(headline, source);

create index if not exists idx_news_items_published
  on public.news_items(published_at desc);

-- 2. ticker_news_map: the worker writes ticker/headline/source rows, not news_id/symbol FKs.
alter table public.ticker_news_map add column if not exists ticker text;
alter table public.ticker_news_map add column if not exists headline text;
alter table public.ticker_news_map add column if not exists source text;
alter table public.ticker_news_map add column if not exists relevance text;
alter table public.ticker_news_map add column if not exists sentiment text;
alter table public.ticker_news_map add column if not exists sentiment_score numeric;
alter table public.ticker_news_map add column if not exists published_at timestamptz;

-- 014 made news_id and symbol NOT NULL; the worker never supplies either, so every
-- insert would still violate them. Relax - the columns stay for any legacy rows.
alter table public.ticker_news_map alter column news_id drop not null;
alter table public.ticker_news_map alter column symbol drop not null;

create unique index if not exists ux_ticker_news_map_ticker_headline_source
  on public.ticker_news_map(ticker, headline, source);

create index if not exists idx_ticker_news_map_ticker
  on public.ticker_news_map(ticker);

-- 3. hype_scores: existed only in legacy sql/007 - a migrations-built database never had
--    it, so .upsert(..., on_conflict="ticker") had no table to hit.
create table if not exists public.hype_scores (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  hype_score numeric,      -- 0-100, deterministic buzz intensity - context, not a signal
  recent_count numeric,
  positive_pct numeric,
  trend text,              -- 'rising' | 'steady' | 'cooling'
  computed_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_hype_scores_computed
  on public.hype_scores(computed_at desc);

-- Read policy parity with the other intelligence tables (anon read, service write).
alter table public.hype_scores enable row level security;
drop policy if exists hype_scores_read on public.hype_scores;
create policy hype_scores_read on public.hype_scores for select using (true);

comment on table public.news_items is
  'News intelligence items written by workers/intelligence_worker, one row per (headline, source).
   The title / payload / relevance_score columns are LEGACY from migration 014 and unused -
   write headline / summary / category / relevance instead (aligned by 049).';
