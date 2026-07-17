#!/usr/bin/env bash
# migrate-from-zero.sh - prove the WHOLE schema builds on an empty database.
#
# The 0.36.0 incident: four migrations had never reached production, and a fresh clone
# could not build the schema at all because one migration indexed columns another had
# not yet added. The static dup/shape gate catches numbering collisions; THIS gate
# catches the real thing - it applies every migration, in order, against a throwaway
# Postgres, exactly like a new install does. If this script is red, a fresh clone is
# broken, whatever CI's unit tests say.
#
# Usage:  DATABASE_URL=postgres://... scripts/migrate-from-zero.sh
# CI:     runs against the postgres:16 service container on every push/PR.
# Local:  createdb lyra_scratch && DATABASE_URL=postgres:///lyra_scratch scripts/migrate-from-zero.sh
#
# The shim below stands in for the managed-Supabase surface the migrations assume
# (auth schema, auth.uid(), anon/authenticated roles) - it is the MINIMUM for vanilla
# Postgres to accept them, not a Supabase emulation.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "migrate-from-zero: DATABASE_URL is required" >&2
  exit 2
fi

PSQL="psql $DATABASE_URL -q -v ON_ERROR_STOP=1"

echo "migrate-from-zero: shimming the Supabase surface (auth schema, roles, extensions)"
$PSQL <<'SQL'
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);
-- Stable stand-in for Supabase's request-scoped auth.uid(); RLS policies only need it
-- to exist and be callable, not to resolve a real session here.
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public to anon, authenticated, service_role;
SQL

count=0
for f in $(find supabase/migrations -maxdepth 1 -name '*.sql' | sort); do
  echo "  applying $(basename "$f")"
  $PSQL -f "$f"
  count=$((count + 1))
done

echo "migrate-from-zero: applying sql/_apply_all_scanner_schema.sql (worker-column reconcile)"
$PSQL -f sql/_apply_all_scanner_schema.sql

tables=$($PSQL -t -A -c "select count(*) from information_schema.tables where table_schema = 'public'")
echo ""
echo "migrate-from-zero OK - $count migrations + reconcile applied cleanly; $tables public tables built from zero"
