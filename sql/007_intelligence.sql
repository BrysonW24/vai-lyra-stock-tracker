-- Horizon-2 NEWS INTELLIGENCE tables
-- No user_id: single-operator system
-- Demo-safe schema matching frontend shape (src/lib/intelligence.ts)

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  summary text,
  source text not null,
  source_domain text,
  category text,
  published_at timestamptz not null,
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  relevance text, -- 'high' | 'medium' | 'low'
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(headline, source)
);

create index if not exists idx_news_items_published
  on news_items(published_at desc);

create index if not exists idx_news_items_sentiment
  on news_items(sentiment);

create index if not exists idx_news_items_category
  on news_items(category);

-- Ticker-to-news mapping with relevance and sentiment scores
create table if not exists ticker_news_map (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  headline text not null,
  source text not null,
  relevance text, -- 'high' | 'medium' | 'low'
  relevance_score numeric, -- 0-100
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  sentiment_score numeric, -- -1..1
  published_at timestamptz,
  created_at timestamptz default now(),
  unique(ticker, headline, source)
);

create index if not exists idx_ticker_news_map_ticker
  on ticker_news_map(ticker);

create index if not exists idx_ticker_news_map_published
  on ticker_news_map(published_at desc);

create index if not exists idx_ticker_news_map_relevance
  on ticker_news_map(ticker, relevance);

-- Per-ticker hype scores
-- Hype is CONTEXT: buzz intensity, not a trade signal
-- Computed deterministically from recent news volume, sentiment, and acceleration
create table if not exists hype_scores (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  hype_score numeric, -- 0-100
  recent_count numeric, -- Count of high-relevance items in last 7 days
  positive_pct numeric, -- % of recent items that are positive (0-100)
  trend text, -- 'rising' | 'steady' | 'cooling'
  computed_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_hype_scores_ticker
  on hype_scores(ticker);

create index if not exists idx_hype_scores_computed
  on hype_scores(computed_at desc);

-- Sentiment score history (optional: for hype acceleration tracking)
create table if not exists sentiment_scores (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  sentiment_score numeric, -- -1..1
  window_start timestamptz,
  window_end timestamptz,
  count numeric,
  created_at timestamptz default now()
);

create index if not exists idx_sentiment_scores_ticker_window
  on sentiment_scores(ticker, window_start desc);
