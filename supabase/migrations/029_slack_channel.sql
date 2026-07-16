-- 029: Slack as a first-class notification channel.
--
-- Users save their OWN Slack incoming-webhook URL (Settings -> Notifications); it lands in
-- notification_channels as channel_type='slack' with the webhook as destination, RLS-scoped
-- to the owner (policies from 015 cover every notification_channels row, slack included).
-- The webhook URL is a secret: the app only ever POSTs to hooks.slack.com (SSRF fence in
-- src/lib/notifications/slack.ts) and delivery logs store a redacted form of it.

-- Allow 'slack' in the channel_type check. The constraint was created NOT VALID in 020 with
-- an in-list we now need to widen, so swap it: drop if present, re-add with slack included.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'notification_channels_channel_type_check'
      and conrelid = 'public.notification_channels'::regclass
  ) then
    alter table public.notification_channels
      drop constraint notification_channels_channel_type_check;
  end if;
  alter table public.notification_channels
    add constraint notification_channels_channel_type_check
    check (channel_type in ('telegram', 'whatsapp', 'slack')) not valid;
end $$;

-- Per-user preference toggle, same shape as telegram_enabled / whatsapp_enabled (024).
alter table public.user_alert_preferences add column if not exists slack_enabled boolean default false;

-- Agent voice: which pre-created template set words alert prose (src/lib/notifications/voice.ts).
-- Free text on purpose (validated in code via isVoiceId) so adding a preset needs no migration.
alter table public.user_alert_preferences add column if not exists voice_preset text default 'analyst';

-- channel_pairing_codes stays telegram/whatsapp-only on purpose: Slack needs no pairing
-- code - saving the webhook and receiving the verification message IS the pairing.
