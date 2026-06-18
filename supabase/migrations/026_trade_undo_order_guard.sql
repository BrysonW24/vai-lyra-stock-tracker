-- 026_trade_undo_order_guard.sql
-- Fix the conversational trade-log undo so it cannot corrupt a position.
--
-- The 023 undo restores cash RELATIVELY (current_cash - cash_delta, order-independent) but
-- restores the POSITION ABSOLUTELY from previous_quantity / previous_average_buy_price - a
-- snapshot taken at the moment that buy was logged. That snapshot is only valid if no LATER buy
-- on the same symbol intervened. Sequence: buy NVDA (new), buy NVDA again, then undo the FIRST
-- log -> the first log's previous_quantity is null, so the undo deactivates the whole position,
-- silently wiping the second buy. Buy-buy-undo-first corrupts the book.
--
-- Fix: undo must be reverse-chronological per symbol. Block undoing any applied log that has a
-- newer applied log on the same symbol, with a clear message. This keeps the absolute snapshot
-- restore valid (it is always the latest state) without the risk of weighted-average reversal math.
-- Idempotent: create-or-replace, safe to re-run.

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

  -- Reverse-chronological guard: the position snapshot we restore is only valid if no later
  -- applied buy on this symbol intervened. Block out-of-order undo so we never wipe a newer buy.
  if exists (
    select 1
      from public.user_trade_logs nl
      where nl.user_id = v_user
        and nl.symbol = v_log.symbol
        and nl.status = 'applied'
        and (nl.created_at > v_log.created_at or (nl.created_at = v_log.created_at and nl.id <> v_log.id and nl.id > v_log.id))
  ) then
    raise exception 'Undo trades in reverse order - there is a newer applied trade on % to undo first.', v_log.symbol;
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

grant execute on function public.undo_trade_log(uuid) to authenticated;
