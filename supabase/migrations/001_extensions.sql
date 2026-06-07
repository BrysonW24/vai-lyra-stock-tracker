-- 001_extensions.sql
-- Canonical multi-user schema for Lyra (Stock Momentum Radar).
--
-- DESIGN PRINCIPLE: global market data is SHARED (one copy of AMD/NVDA candles,
-- indicators and signals serves everyone); user decisions and preferences are PRIVATE
-- (each operator has their own portfolio, watchlist, alerts, onboarding and snapshots).
--
-- These migrations are IDEMPOTENT (`create table if not exists`, `add column if not
-- exists`) so they apply cleanly on a fresh project OR on top of the legacy single-
-- operator schema in `sql/`. The legacy `sql/` files are kept for reference; this
-- `supabase/migrations/` set is the canonical going-forward schema.

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists "uuid-ossp";    -- belt-and-braces for uuid helpers
