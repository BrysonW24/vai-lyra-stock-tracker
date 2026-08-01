"""Unit tests for the real-history backtest layer (workers/emerging_winner/backtest.py).

Pins the honesty contract of the corpus -> eval -> retrain -> promote lifecycle:
  * corpus rows flow through the UNCHANGED ledger-shaped training assembly (byte-compatible seam);
  * a challenger artifact carries the corpus source label + the survivorship caveat - it can never
    claim it was trained on the 056 ledger or on a survivorship-corrected universe;
  * a challenger that failed its absolute floors is REFUSED promotion;
  * metric blocks are computed per cohort, never pooled-only.
No network: everything runs from a tiny synthetic corpus written to tmp_path.
"""
import json
import os

import pytest

from workers.emerging_winner import backtest as bt
from workers.emerging_winner.dataset import assemble_training_rows, load_training_dataset


def _toy_features(strong: bool) -> dict:
    if strong:
        return {
            "rsi": 44.0, "rsi_delta": 2.0, "macd_hist": -0.2, "macd_hist_delta": 0.05,
            "price_vs_sma200": 1.05, "dist_from_60_low_pct": 9.0, "volume_ratio": 1.8,
            "close": 10.0, "open": 9.6, "volume": 2_000_000, "volume_state": "above_average",
            "market_cap": 500_000_000, "avg_dollar_volume": 12_000_000,
            "fundamentals": {"revenue_growth_yoy": 60.0, "gross_margin_trend": 0.2},
            "capital": {"share_count_growth_yoy": 2.0, "debt_to_equity": 0.3},
        }
    return {
        "rsi": 70.0, "rsi_delta": -2.0, "macd_hist": 0.4, "macd_hist_delta": -0.05,
        "price_vs_sma200": 0.86, "dist_from_60_low_pct": 45.0, "volume_ratio": 0.6,
        "close": 2.0, "open": 2.1, "volume": 50_000, "volume_state": "below_average",
        "market_cap": 40_000_000, "avg_dollar_volume": 90_000,
        "fundamentals": {"revenue_growth_yoy": -20.0, "gross_margin_trend": -0.3},
        "capital": {"share_count_growth_yoy": 28.0, "debt_to_equity": 2.5},
    }


def _write_toy_corpus(cache_dir: str, n: int = 240) -> None:
    os.makedirs(cache_dir, exist_ok=True)
    rows = []
    for i in range(n):
        strong = i % 6 == 0
        year = 2018 + (i % 6)
        quarter = (i // 6) % 4 + 1
        rows.append({
            "symbol": f"T{i:03d}",
            "predicted_at": f"{year}-{quarter * 3:02d}-01",
            "cohort": f"{year}Q{quarter}",
            "curated": False,
            "features": _toy_features(strong),
            # Strong names win 2/3 of the time, weak ~5% - a learnable, rare-ish positive signal.
            "outcome": {
                "barrier_hit": "up_100" if (strong and i % 3 != 0) or i % 19 == 0 else "neither",
                "still_listed": True,
                "liquidity_grew": True,
            },
            "diagnostics": {"max_fwd_return": 120.0, "fwd_bars": 252, "entry_close": 10.0,
                            "cap_tier": "small" if strong else "micro", "avg_dollar_volume": 1e6},
        })
    with open(os.path.join(cache_dir, bt.CORPUS_FILE), "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r) + "\n")
    meta = {
        "source": bt.CORPUS_SOURCE_LABEL, "caveat": bt.SURVIVORSHIP_CAVEAT,
        "corpus_sha256": bt._corpus_sha256(os.path.join(cache_dir, bt.CORPUS_FILE)),
        "built_at_data_end": "2026-07-31", "seed": 7, "n_sample_requested": n,
        "n_symbols_priced": n, "n_symbols_with_rows": n, "n_symbols_with_edgar": n,
        "score_dates": ["2018-03-01", "2023-12-01"], "n_rows": n, "n_rows_curated": 0,
        "n_winners": sum(1 for r in rows if r["outcome"]["barrier_hit"] == "up_100"),
        "base_rate": 0.2, "skipped": {}, "filters": {}, "theme_injection": False, "label": "test",
    }
    with open(os.path.join(cache_dir, bt.CORPUS_META_FILE), "w", encoding="utf-8") as fh:
        json.dump(meta, fh)


def test_quarterly_score_dates_bounds():
    dates = bt.quarterly_score_dates(2016, "2017-08-01")
    assert dates[0] == "2016-01-02" and dates[-1] == "2017-07-02"
    assert all(d <= "2017-08-01" for d in dates)


def test_cap_tier_bands():
    assert bt.cap_tier(None) == "unknown"
    assert bt.cap_tier(50e6) == "micro"
    assert bt.cap_tier(800e6) == "small"
    assert bt.cap_tier(5e9) == "mid"
    assert bt.cap_tier(50e9) == "large"


def test_corpus_rows_flow_through_the_unchanged_ledger_assembly(tmp_path):
    cache = str(tmp_path)
    _write_toy_corpus(cache, n=60)
    rows, _meta = bt.load_corpus(cache)
    predictions, outcomes = bt.corpus_as_ledger_rows(rows)
    assembled = assemble_training_rows(predictions, outcomes)
    assert len(assembled) == 60, "every corpus row must join to its outcome - the ledger seam is intact"
    ds = load_training_dataset(predictions, outcomes, min_matured=50,
                               source_label="historical-survivor-v1", provenance_note="test caveat")
    assert ds["source"] == "historical-survivor-v1"
    assert ds["provenance"] == "test caveat"
    assert ds["times"] is not None, "corpus rows carry a real timeline for the purged walk-forward"


def test_retrained_challenger_carries_corpus_provenance_never_ledger_claims(tmp_path):
    cache = str(tmp_path / "cache")
    out = str(tmp_path / "challenger.json")
    _write_toy_corpus(cache)
    payload = bt.run_retrain(cache, out_path=out, folds=4)
    assert payload["dataset"]["source"] == bt.CORPUS_SOURCE_LABEL
    assert "Survivor-biased" in payload["provenance"] or "Survivor-biased" in payload["dataset"]["provenance"]
    assert "056" not in payload["dataset"]["provenance"], "must never claim the shadow-live ledger"
    assert payload["modelVersion"] == "emerging-winner-classifier-real-v1"
    assert os.path.exists(out)


def test_promotion_refused_when_floors_failed(tmp_path):
    challenger = tmp_path / "challenger.json"
    champion = tmp_path / "champion.json"
    challenger.write_text(json.dumps({
        "modelVersion": "x", "floor": {"passed": False, "reasons": ["oos_auc 0.5 < floor 0.55"]},
    }))
    with pytest.raises(SystemExit):
        bt.promote_challenger(str(challenger), str(champion))
    assert not champion.exists(), "a floor-failing model must never be silently promoted"


def test_forced_promotion_requires_and_records_an_explicit_reason(tmp_path):
    challenger = tmp_path / "challenger.json"
    champion = tmp_path / "champion.json"
    challenger.write_text(json.dumps({
        "modelVersion": "x", "floor": {"passed": False, "reasons": ["lift 1.3 < floor 1.5"]},
    }))
    reason = "incumbent refuted on identical real OOS data with CI separation (dev + one-shot holdout)"
    bt.promote_challenger(str(challenger), str(champion), force_reason=reason)
    promoted = json.loads(champion.read_text())
    assert promoted["promotion"]["forced_over_floor"] is True
    assert promoted["promotion"]["reason"] == reason, "a forced promotion must carry its justification"


def test_metric_block_reports_cohorts_not_just_pooled():
    y = [1, 0, 0, 0, 1, 0, 0, 0]
    p = [0.9, 0.2, 0.1, 0.3, 0.8, 0.1, 0.2, 0.15]
    cohorts = ["2020Q1"] * 4 + ["2020Q2"] * 4
    block = bt._metric_block(y, p, cohorts, k_frac=0.25)
    assert block["by_cohort"]["n_cohorts"] == 2
    assert block["pr_auc"] == 1.0  # both positives ranked top - sanity of the metric plumbing
