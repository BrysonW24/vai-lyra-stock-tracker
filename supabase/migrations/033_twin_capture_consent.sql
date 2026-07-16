-- 033: capture-consent flag for the digital-trading-twin layer.
--
-- Doctrine (docs/strategy/2026-07-16-digital-trading-twin.md): the twin is OPT-IN, inspectable,
-- and deletable. This adds the opt-in switch. Default FALSE so no behavioural/attention capture
-- happens until the user turns it on - the twin's interaction-capture path (interaction_events)
-- must check this flag before writing. Stated preferences and paper-trade history the app already
-- persists to run its core features are unaffected; this gates the NEW attention capture only.

alter table public.user_settings
  add column if not exists twin_capture_enabled boolean not null default false;

comment on column public.user_settings.twin_capture_enabled is
  'Opt-in for the digital trading twin''s behavioural/attention capture. Default false. The interaction_events write path must respect this.';
