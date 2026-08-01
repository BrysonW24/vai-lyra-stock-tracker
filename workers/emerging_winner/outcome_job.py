"""
Emerging Winner outcome-maturation job - the loop-closer the shadow-live design has been waiting
for. Nightly it walks the immutable predictions ledger, fetches each name's daily bars since the
prediction date, and writes the matured 12-month first-touch outcome (with the option-4 conjuncts,
still_listed + liquidity_grew) into `emerging_winner_outcomes`.

Why this is the single most important standing worker for the model family: every matured pair is
a REAL training row and a REAL calibration point. At >= 200 matured outcomes
`dataset.load_training_dataset` auto-upgrades training from the historical backtest corpus to live
point-in-time ledger rows; at >= 20, `monitor.model_health` starts scoring live calibration - the
evidence the founder-gated surfacing promotion actually requires. Until this job had shipped, both
gates were structurally unreachable.

Label discipline is identical to the backtest corpus (history_source.label_forward): first-touch
+100%/-80% over 252 trading days from the entry bar's close, ruin checked before win on the same
bar, immature windows are NOT labels, a series that goes dark mid-window is the delisting proxy.
Barrier-resolved rows are written immediately; unresolved rows wait (upsert refines nothing until
there is something honest to write).

Run: python -m workers.emerging_winner.outcome_job (scheduled by nightly-maintenance.yml).
Demo-safe: no Supabase configured = clean no-op.
"""
from __future__ import annotations

import datetime as dt
import logging
import sys

from . import history_source as hs
from .dataset import HORIZON_TRADING_DAYS
from .repo import EmergingWinnerRepo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emerging_winner.outcome_job")

# Ledger predictions younger than this cannot possibly have a resolved window worth checking daily
# bars for - skip the fetch entirely (a +100% first touch CAN resolve any time, so keep it short).
MIN_AGE_DAYS_TO_CHECK = 7


def mature_prediction(predicted_at: str, bars: list, *, data_end: str) -> dict | None:
    """Pure: one prediction + its daily bars -> the outcome row fields, or None while immature.

    Entry = the close of the last bar on/before the prediction date (the price the market printed
    when the prediction was logged); forward path = closes after it. Delegates the whole label to
    history_source.label_forward so live maturation and the backtest corpus can never use different
    label maths."""
    day = str(predicted_at)[:10]
    idx = hs.bar_index_at(bars, day)
    if idx is None or not bars[idx].close:
        return None
    outcome = hs.label_forward(bars, idx, horizon=HORIZON_TRADING_DAYS, data_end=data_end)
    if outcome is None or outcome.get("immature"):
        return None
    # An unresolved-but-not-dark window (barrier 'neither', window incomplete) is also immature.
    if outcome["barrier_hit"] == "neither" and outcome["fwd_bars"] < HORIZON_TRADING_DAYS \
            and outcome["still_listed"] is not False:
        return None
    entry = bars[idx].close
    forward = [b.close for b in bars[idx + 1: idx + 1 + HORIZON_TRADING_DAYS] if b.close]
    fwd_ret = round((forward[-1] / entry - 1.0) * 100.0, 2) if forward else None
    return {
        "horizon_days": HORIZON_TRADING_DAYS,
        "entry_price": round(entry, 6),
        "forward_return_pct": fwd_ret,
        "barrier_hit": outcome["barrier_hit"],
        "still_listed": outcome["still_listed"],
        "liquidity_grew": outcome["liquidity_grew"],
        "matured_at": data_end,
    }


def main() -> int:
    repo = EmergingWinnerRepo()
    if not repo.enabled:
        logger.info("Supabase not configured - demo mode, nothing to mature.")
        return 0

    predictions = repo.fetch_predictions(limit=1000)
    have_outcome = {str(o.get("prediction_id")) for o in repo.fetch_outcomes(limit=5000)}
    today = dt.datetime.now(dt.timezone.utc).date()
    todo = [p for p in predictions
            if str(p.get("id")) not in have_outcome
            and (today - dt.date.fromisoformat(str(p.get("predicted_at"))[:10])).days >= MIN_AGE_DAYS_TO_CHECK]
    if not todo:
        logger.info("outcomes: nothing to mature (%d predictions, %d already matured)",
                    len(predictions), len(have_outcome))
        return 0

    bars_by_symbol: dict[str, list] = {}
    rows: list[dict] = []
    checked = 0
    for p in todo:
        sym = str(p.get("symbol", "")).upper()
        if not sym:
            continue
        if sym not in bars_by_symbol:
            fetched = hs.fetch_yfinance_history(sym)
            bars_by_symbol[sym] = fetched if fetched else []
            hs.polite_sleep(0.2)
        bars = bars_by_symbol[sym]
        checked += 1
        if not bars:
            continue  # unfetchable tonight - try again tomorrow, never guess
        outcome = mature_prediction(str(p.get("predicted_at")), bars, data_end=today.isoformat())
        if outcome is None:
            continue  # still maturing
        rows.append({"prediction_id": p.get("id"), "symbol": sym, **outcome})

    written = repo.save_outcomes(rows)
    logger.info("outcomes: checked %d predictions across %d symbols -> %d matured rows written",
                checked, len(bars_by_symbol), written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
