-- 051: make mutes server-enforceable + give delivery claims a durable idempotency backstop.
--
-- Mutes: the router (routeNotification rule 2) has always supported mutedSymbols/mutedThemes,
-- but no column existed to load them from, so every mute a user could set (the AccountMenu
-- "Muted" mode / "Mute 1h/4h/tomorrow" controls) was localStorage-only and inert on the server
-- dispatch path - all channels kept sending. These columns live on user_alert_preferences (the
-- row loadPreferences already reads - zero extra queries) rather than the alert_mutes table,
-- which has had zero readers and zero writers since migration 009 (left in place; candidate
-- for a later drop).
--   mute_all      : the "Muted" mode - indefinite, until switched off.
--   muted_until   : timed snooze ("Mute 1h/4h/tomorrow"); active while now < muted_until.
--   muted_symbols : per-symbol mutes fed to the router's existing mutedSymbols rule.
--   muted_themes  : per-theme mutes fed to the router's existing mutedThemes rule.
-- Safety-critical types (kill_switch_enabled, order/paper approval, risk_blocked) are exempt
-- from mute_all/muted_until in the router - a mute must not silence an approval request.
alter table public.user_alert_preferences add column if not exists mute_all boolean not null default false;
alter table public.user_alert_preferences add column if not exists muted_until timestamptz;
alter table public.user_alert_preferences add column if not exists muted_symbols text[] not null default '{}';
alter table public.user_alert_preferences add column if not exists muted_themes text[] not null default '{}';

-- Delivery idempotency: notification_deliveries.idempotency_key had no unique constraint, so
-- the drainer paths' check-then-act patterns (held release, failed-chat retry) had no durable
-- backstop - two concurrent runners (hourly dispatch + nightly sweep, or overlapping sweeps)
-- could both send the same notification. The dispatch code now CLAIMS before sending (atomic
-- UPDATE ... WHERE status='held' for release; INSERT of a claim row for retry); this index is
-- what makes the retry claim atomic - the second runner's identical claim insert fails 23505.
-- Plain (non-partial) unique index per the migration-046 lesson: NULLs are distinct, so rows
-- without a key coexist, and no partial predicate is needed.
-- Prod precondition verified 2026-07-18: zero duplicate non-null keys among existing rows.
create unique index if not exists uq_notification_deliveries_idem
  on public.notification_deliveries(idempotency_key);
