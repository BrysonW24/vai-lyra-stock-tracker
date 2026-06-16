-- 023_conversational_trade_logs.sql
-- Durable audit trail for confirm-to-act conversational trade logging.
-- The AI may propose/parse an intent; deterministic server code prices it, updates cash,
-- updates portfolio_positions, and writes this reversible log.

create table if not exists public.user_trade_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_position_id uuid references public.portfolio_positions(id) on delete set null,
  symbol text not null references public.stock_tickers(symbol),
  side text not null check (side in ('buy')),
  notional_value numeric not null,
  quantity_delta numeric not null,
  fill_price numeric not null,
  cash_delta numeric not null,
  previous_cash_available numeric,
  previous_quantity numeric,
  previous_average_buy_price numeric,
  status text not null default 'applied' check (status in ('applied', 'undone')),
  source text,
  raw_text text,
  created_at timestamptz default now(),
  undone_at timestamptz
);

create index if not exists idx_user_trade_logs_user_time
  on public.user_trade_logs(user_id, created_at desc);

alter table public.user_trade_logs enable row level security;

drop policy if exists user_trade_logs_owner_sel on public.user_trade_logs;
create policy user_trade_logs_owner_sel on public.user_trade_logs
  for select using (auth.uid() = user_id);

drop policy if exists user_trade_logs_owner_ins on public.user_trade_logs;
create policy user_trade_logs_owner_ins on public.user_trade_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists user_trade_logs_owner_upd on public.user_trade_logs;
create policy user_trade_logs_owner_upd on public.user_trade_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.log_buy_trade(
  p_symbol text,
  p_notional numeric,
  p_quantity_delta numeric,
  p_fill_price numeric,
  p_source text default 'chat',
  p_raw_text text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cash numeric;
  v_cash_after numeric;
  v_position record;
  v_previous_quantity numeric;
  v_previous_average numeric;
  v_new_quantity numeric;
  v_new_average numeric;
  v_position_id uuid;
  v_log_id uuid;
  v_symbol text := upper(trim(coalesce(p_symbol, '')));
  v_today date := current_date;
begin
  if v_user is null then
    raise exception 'Sign in to log trades.';
  end if;

  if v_symbol = '' or p_notional is null or p_notional <= 0 or p_quantity_delta is null or p_quantity_delta <= 0 or p_fill_price is null or p_fill_price <= 0 then
    raise exception 'Provide a valid buy trade.';
  end if;

  select cash_available
    into v_cash
    from public.operator_profiles
    where user_id = v_user
    for update;

  if v_cash is null then
    raise exception 'Set available cash in onboarding before logging trades.';
  end if;

  if v_cash < p_notional then
    raise exception 'Not enough available cash. You have $%.', round(v_cash, 2);
  end if;

  select id, quantity, average_buy_price
    into v_position
    from public.portfolio_positions
    where user_id = v_user
      and symbol = v_symbol
      and is_active = true
    order by created_at
    limit 1
    for update;

  if found then
    v_previous_quantity := v_position.quantity;
    v_previous_average := v_position.average_buy_price;
    v_new_quantity := round(coalesce(v_previous_quantity, 0) + p_quantity_delta, 6);
    v_new_average := case
      when coalesce(v_previous_quantity, 0) > 0 and v_previous_average is not null
        then round(((v_previous_quantity * v_previous_average) + p_notional) / v_new_quantity, 4)
      else round(p_fill_price, 4)
    end;

    update public.portfolio_positions
      set quantity = v_new_quantity,
          average_buy_price = v_new_average,
          purchase_date = v_today,
          notes = 'Updated from chat trade log on ' || v_today::text,
          is_active = true,
          updated_at = now()
      where id = v_position.id
        and user_id = v_user
      returning id into v_position_id;
  else
    insert into public.portfolio_positions (
      user_id,
      symbol,
      quantity,
      average_buy_price,
      brokerage_fee,
      purchase_date,
      notes,
      is_active
    )
    values (
      v_user,
      v_symbol,
      round(p_quantity_delta, 6),
      round(p_fill_price, 4),
      0,
      v_today,
      'Created from chat trade log on ' || v_today::text,
      true
    )
    returning id into v_position_id;
  end if;

  v_cash_after := round(v_cash - p_notional, 4);

  update public.operator_profiles
    set cash_available = v_cash_after,
        updated_at = now()
    where user_id = v_user;

  insert into public.user_trade_logs (
    user_id,
    portfolio_position_id,
    symbol,
    side,
    notional_value,
    quantity_delta,
    fill_price,
    cash_delta,
    previous_cash_available,
    previous_quantity,
    previous_average_buy_price,
    source,
    raw_text
  )
  values (
    v_user,
    v_position_id,
    v_symbol,
    'buy',
    round(p_notional, 4),
    round(p_quantity_delta, 6),
    round(p_fill_price, 4),
    -round(p_notional, 4),
    v_cash,
    v_previous_quantity,
    v_previous_average,
    nullif(trim(coalesce(p_source, 'chat')), ''),
    p_raw_text
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'id', v_log_id,
    'symbol', v_symbol,
    'notional', round(p_notional, 4),
    'quantity', round(p_quantity_delta, 6),
    'fillPrice', round(p_fill_price, 4),
    'cashAvailable', v_cash_after,
    'portfolioPositionId', v_position_id
  );
end;
$$;

create or replace function public.undo_trade_log(p_log_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_log record;
  v_current_cash numeric;
  v_restored_cash numeric;
begin
  if v_user is null then
    raise exception 'Sign in to undo trades.';
  end if;

  select *
    into v_log
    from public.user_trade_logs
    where id = p_log_id
      and user_id = v_user
    for update;

  if not found then
    raise exception 'Trade log is not undoable.';
  end if;

  if v_log.status <> 'applied' then
    raise exception 'Trade log is not undoable.';
  end if;

  select cash_available
    into v_current_cash
    from public.operator_profiles
    where user_id = v_user
    for update;

  v_restored_cash := round(coalesce(v_current_cash, 0) - v_log.cash_delta, 4);

  if v_log.portfolio_position_id is not null then
    if v_log.previous_quantity is null or v_log.previous_quantity <= 0 then
      update public.portfolio_positions
        set is_active = false,
            updated_at = now()
        where id = v_log.portfolio_position_id
          and user_id = v_user;
    else
      update public.portfolio_positions
        set quantity = v_log.previous_quantity,
            average_buy_price = v_log.previous_average_buy_price,
            is_active = true,
            updated_at = now()
        where id = v_log.portfolio_position_id
          and user_id = v_user;
    end if;
  end if;

  update public.operator_profiles
    set cash_available = v_restored_cash,
        updated_at = now()
    where user_id = v_user;

  update public.user_trade_logs
    set status = 'undone',
        undone_at = now()
    where id = v_log.id
      and user_id = v_user;

  return jsonb_build_object(
    'id', v_log.id,
    'symbol', v_log.symbol,
    'cashAvailable', v_restored_cash
  );
end;
$$;

grant execute on function public.log_buy_trade(text, numeric, numeric, numeric, text, text) to authenticated;
grant execute on function public.undo_trade_log(uuid) to authenticated;
