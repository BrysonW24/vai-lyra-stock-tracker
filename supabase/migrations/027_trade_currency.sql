-- 027_trade_currency.sql
-- Currency-aware trade logging. cash_available is held in operator_profiles.base_currency (default
-- USD). A trade priced in a different currency (e.g. a .AX name quoted in AUD) would corrupt the
-- cash pool and the average cost if deducted as-is, so log_buy_trade now REJECTS a cross-currency
-- trade with a clear message. FX conversion is a later phase. Idempotent + additive.

-- The account base currency is owned by public.profiles.base_currency (written by the account API +
-- defaulted in onboarding); operator_profiles never stores it. Both the RPC below and getUserConstraints
-- read it from profiles so the cross-currency guard compares against the currency the user actually set.
alter table public.user_trade_logs add column if not exists currency text default 'USD';
alter table public.portfolio_positions add column if not exists currency text default 'USD';

-- Replace log_buy_trade with a 7-arg, currency-aware version. Drop the old 6-arg signature first so
-- there is no ambiguous overload (PostgREST calls by name; the new p_currency defaults so existing
-- 6-arg callers still resolve).
drop function if exists public.log_buy_trade(text, numeric, numeric, numeric, text, text);

create or replace function public.log_buy_trade(
  p_symbol text,
  p_notional numeric,
  p_quantity_delta numeric,
  p_fill_price numeric,
  p_source text default 'chat',
  p_raw_text text default null,
  p_currency text default 'USD'
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
  v_base_currency text;
  v_currency text := upper(trim(coalesce(p_currency, 'USD')));
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

  -- Base currency lives in profiles (profiles.id = auth user id), written by the account API.
  select coalesce(base_currency, 'USD')
    into v_base_currency
    from public.profiles
    where id = v_user;
  v_base_currency := coalesce(v_base_currency, 'USD');

  -- Cross-currency guard: cash is held in the base currency; logging a trade priced in another
  -- currency would corrupt the cash pool + average cost. Reject clearly until FX conversion exists.
  if v_currency <> upper(v_base_currency) then
    raise exception 'Cross-currency trade not supported yet: % trades in %, but your account is in %. Adjust the holding in Portfolio manually for now.', v_symbol, v_currency, upper(v_base_currency);
  end if;

  if v_cash < p_notional then
    raise exception 'Not enough available cash. You have %.', round(v_cash, 2);
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
          currency = v_currency,
          purchase_date = v_today,
          notes = 'Updated from chat trade log on ' || v_today::text,
          is_active = true,
          updated_at = now()
      where id = v_position.id
        and user_id = v_user
      returning id into v_position_id;
  else
    insert into public.portfolio_positions (
      user_id, symbol, quantity, average_buy_price, brokerage_fee, currency, purchase_date, notes, is_active
    )
    values (
      v_user, v_symbol, round(p_quantity_delta, 6), round(p_fill_price, 4), 0, v_currency, v_today,
      'Created from chat trade log on ' || v_today::text, true
    )
    returning id into v_position_id;
  end if;

  v_cash_after := round(v_cash - p_notional, 4);

  update public.operator_profiles
    set cash_available = v_cash_after, updated_at = now()
    where user_id = v_user;

  insert into public.user_trade_logs (
    user_id, portfolio_position_id, symbol, side, notional_value, quantity_delta, fill_price,
    cash_delta, previous_cash_available, previous_quantity, previous_average_buy_price, currency, source, raw_text
  )
  values (
    v_user, v_position_id, v_symbol, 'buy', round(p_notional, 4), round(p_quantity_delta, 6), round(p_fill_price, 4),
    -round(p_notional, 4), v_cash, v_previous_quantity, v_previous_average, v_currency,
    nullif(trim(coalesce(p_source, 'chat')), ''), p_raw_text
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'id', v_log_id, 'symbol', v_symbol, 'notional', round(p_notional, 4), 'quantity', round(p_quantity_delta, 6),
    'fillPrice', round(p_fill_price, 4), 'cashAvailable', v_cash_after, 'currency', v_currency, 'portfolioPositionId', v_position_id
  );
end;
$$;

grant execute on function public.log_buy_trade(text, numeric, numeric, numeric, text, text, text) to authenticated;
