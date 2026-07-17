-- 052: per-user alert rate cap. The founder's live report: six pushes in five minutes - a
-- fresh watchlist plus an hourly scan can burst one alert per minute with nothing throttling
-- outbound volume. max_alerts_per_hour caps instant deliveries per user per rolling hour;
-- excess events park as 'held' (the existing held/release rails - late beats lost) and drain
-- as the window frees. Safety-critical types (approvals, kill-switch) and scheduled digests
-- are exempt. alert_mode (quiet/muted enforcement) already exists on this table since 009 -
-- it was simply never read server-side until now.
alter table public.user_alert_preferences add column if not exists max_alerts_per_hour integer not null default 6;
