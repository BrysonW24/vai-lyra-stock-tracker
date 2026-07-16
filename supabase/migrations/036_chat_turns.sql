-- 036: cross-session conversational memory for the copilot.
--
-- The chat route folds the current session's turns (client-sent) into the prompt, but a returning
-- user starts cold - the copilot recalls nothing across sessions/devices. This durable, owner-only
-- store lets it seed a fresh session from the user's own prior turns. Opt-in: writes/reads are gated
-- by user_settings.twin_capture_enabled at the app layer (same consent switch as attention capture),
-- and every row cascades away on account delete. Research context only - never instructions.

create table if not exists public.chat_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_turns_user_time
  on public.chat_turns(user_id, created_at desc);

alter table public.chat_turns enable row level security;

drop policy if exists chat_turns_owner_ins on public.chat_turns;
create policy chat_turns_owner_ins on public.chat_turns
  for insert with check (auth.uid() = user_id);

drop policy if exists chat_turns_owner_sel on public.chat_turns;
create policy chat_turns_owner_sel on public.chat_turns
  for select using (auth.uid() = user_id);

drop policy if exists chat_turns_owner_del on public.chat_turns;
create policy chat_turns_owner_del on public.chat_turns
  for delete using (auth.uid() = user_id);
