-- 034: freeze "the state a name was in when you added it" onto the watchlist add.
--
-- The twin doc calls this out explicitly: watchlist adds should carry the deterministic signal
-- score, lifecycle stage, and backing strength AT THE MOMENT OF ADD, not recomputed later. That is
-- the single highest-signal enrichment for the twin's early-vs-late affinity model (did you add
-- names early - concept/funded - or late - scaling/crowded?). watchlist_signal_overlay is a later
-- per-candle recompute, not an at-add freeze, so these are new, immutable columns.
--
-- All nullable: legacy rows and demo mode simply have no snapshot, which the twin model handles.

alter table public.watchlist_items add column if not exists signal_score_at_add numeric;
alter table public.watchlist_items add column if not exists lifecycle_stage_at_add text;
alter table public.watchlist_items add column if not exists backing_strength_at_add numeric;

comment on column public.watchlist_items.lifecycle_stage_at_add is
  'Deterministic lifecycle stage (concept/funded/contracted/scaling/crowded) at the moment of add. Immutable. Read by the trading-twin model.';
