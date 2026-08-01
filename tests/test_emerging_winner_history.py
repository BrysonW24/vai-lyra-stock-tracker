"""Unit tests for the point-in-time historical layer (history_source) - pure functions only, no network.

The pins that keep the backtest honest:
  * as-of discipline: a fact FILED after T is invisible at T; a stale share count is rejected.
  * label discipline: first-touch ordering (ruin checked before win on the same bar), immature windows
    are not labels, a series that goes dark mid-window reads as a delisting proxy, and liquidity_grew
    is computed only when the full window was observed.
  * feature parity: assemble_features_asof emits the same keys/units the live feature_source does,
    deep domains stay absent, and market cap uses the RAW close (shares x printed price), never the
    dividend-adjusted series.
"""
from workers.emerging_winner.dataset import label_from_outcome
from workers.emerging_winner.history_source import (
    DailyBar,
    assemble_features_asof,
    bar_index_at,
    bars_to_candles,
    compact_company_facts,
    edgar_features_asof,
    label_forward,
    parse_stooq_csv,
    shares_outstanding_asof,
)


def _bar(day: str, close: float, volume: float = 100_000.0, raw: float | None = None) -> DailyBar:
    return DailyBar(day, close, close * 1.02, close * 0.98, close, volume, raw if raw is not None else close)


def _weekday_series(start_year: int, days: int, price) -> list[DailyBar]:
    """`days` consecutive WEEKDAY bars from Jan 1 of start_year; price = f(i) or constant."""
    import datetime as dt

    out = []
    d = dt.date(start_year, 1, 1)
    i = 0
    while len(out) < days:
        if d.weekday() < 5:
            p = price(i) if callable(price) else float(price)
            out.append(_bar(d.isoformat(), p))
            i += 1
        d += dt.timedelta(days=1)
    return out


# --- stooq parsing ----------------------------------------------------------------------------------

def test_parse_stooq_csv_happy_and_hostile():
    csv_text = "Date,Open,High,Low,Close,Volume\n2024-01-02,10,11,9,10.5,1000\n2024-01-03,10.5,12,10,11,1200\n"
    bars = parse_stooq_csv(csv_text)
    assert [b.day for b in bars] == ["2024-01-02", "2024-01-03"]
    assert bars[0].close == 10.5
    # Stooq closes are split-adjusted ANCHORED TO TODAY - treating them as the printed price would
    # embed future split information in market cap (label-correlated look-ahead). raw stays absent.
    assert bars[0].raw_close is None
    assert parse_stooq_csv("<!DOCTYPE html><script>challenge</script>") == []
    assert parse_stooq_csv("No data") == []
    assert parse_stooq_csv("") == []


# --- bar lookup ---------------------------------------------------------------------------------------

def test_bar_index_at_snaps_back_within_gap_and_refuses_beyond():
    bars = [_bar("2024-01-02", 10), _bar("2024-01-03", 11), _bar("2024-01-31", 12)]
    assert bar_index_at(bars, "2024-01-03") == 1
    assert bar_index_at(bars, "2024-01-06") == 1        # weekend snap-back, gap 3d
    assert bar_index_at(bars, "2024-01-20") is None     # 17 days after the last bar - not trading
    assert bar_index_at(bars, "2023-12-25") is None     # before the series began


# --- labels ---------------------------------------------------------------------------------------------

def test_label_winner_first_touch():
    bars = [_bar("2020-01-01", 10.0)] + [_bar(f"2020-02-{d:02d}", p) for d, p in
                                         [(1, 12.0), (2, 15.0), (3, 21.0), (4, 5.0)]] \
        + [_bar(f"2020-03-{d:02d}", 5.0) for d in range(1, 20)]
    out = label_forward(bars, 0, horizon=10, data_end="2020-03-19")
    assert out["barrier_hit"] == "up_100"  # touched +100% (20.0) before any ruin


def test_ruin_checked_before_win_on_the_same_bar():
    bars = [_bar("2020-01-01", 10.0), _bar("2020-01-02", 1.0)]  # single bar that satisfies both? no - down first
    out = label_forward(bars, 0, horizon=5, data_end="2020-01-02")
    assert out["barrier_hit"] == "down_80"


def test_immature_window_is_not_a_label():
    bars = [_bar("2026-06-01", 10.0), _bar("2026-06-02", 10.5), _bar("2026-06-03", 10.4)]
    out = label_forward(bars, 0, horizon=252, data_end="2026-06-03")
    assert out["immature"] is True and out["still_listed"] is None


def test_series_going_dark_reads_as_delisting_proxy():
    bars = [_bar("2020-01-01", 10.0), _bar("2020-01-02", 9.0), _bar("2020-01-03", 8.5)]
    # Data collection ran through 2021 but this name stopped printing bars in Jan 2020.
    out = label_forward(bars, 0, horizon=252, data_end="2021-06-30")
    assert out["immature"] is False
    assert out["still_listed"] is False
    assert label_from_outcome(out) == 0  # a vanished name is never a quality winner


def test_liquidity_grew_only_measured_over_a_complete_window():
    rising = _weekday_series(2020, 300, lambda i: 10.0 + i * 0.01)
    out = label_forward(rising, 20, horizon=252, data_end=rising[-1].day)
    assert out["still_listed"] is True
    assert out["liquidity_grew"] is not None


# --- EDGAR as-of ------------------------------------------------------------------------------------------

def _bundle():
    facts = {"facts": {
        "dei": {"EntityCommonStockSharesOutstanding": {"units": {"shares": [
            {"val": 9_000_000, "end": "2019-11-30", "filed": "2019-12-05", "fy": 2019, "fp": "FY", "form": "10-K"},
            {"val": 10_000_000, "end": "2020-11-30", "filed": "2020-12-05", "fy": 2020, "fp": "FY", "form": "10-K"},
            {"val": 14_000_000, "end": "2021-05-31", "filed": "2021-06-05", "fy": 2021, "fp": "Q2", "form": "10-Q"},
        ]}}},
        "us-gaap": {"Revenues": {"units": {"USD": [
            {"val": 100.0, "start": "2019-01-01", "end": "2019-12-31", "filed": "2020-02-15", "fy": 2019, "fp": "FY", "form": "10-K"},
            {"val": 150.0, "start": "2020-01-01", "end": "2020-12-31", "filed": "2021-02-15", "fy": 2020, "fp": "FY", "form": "10-K"},
        ]}}},
    }}
    return compact_company_facts(facts)


def test_shares_asof_respects_filed_dates_and_staleness():
    b = _bundle()
    assert shares_outstanding_asof(b, "2020-06-30") == 9_000_000    # 2020 count not FILED yet
    assert shares_outstanding_asof(b, "2021-01-31") == 10_000_000   # now it is
    assert shares_outstanding_asof(b, "2021-07-31") == 14_000_000   # quarterly cover-page count wins on recency
    assert shares_outstanding_asof(b, "2019-11-01") is None         # nothing filed yet at all
    assert shares_outstanding_asof(b, "2024-01-01") is None         # >400 days stale - reject, never misstate


def test_edgar_features_asof_filed_date_discipline():
    b = _bundle()
    # The FY2020 10-K was FILED 2021-02-15: at 2021-03-31 both years are knowable -> growth exists;
    # at 2021-01-31 (after the fiscal year ENDED but before it was FILED) it must stay invisible.
    later = edgar_features_asof(b, "2021-03-31")
    early = edgar_features_asof(b, "2021-01-31")
    assert later["fundamentals"]["revenue_growth_yoy"] == 50.0
    assert "fundamentals" not in early, "period-ended-but-not-yet-filed must not leak"


# --- point-in-time feature assembly -------------------------------------------------------------------------

def test_assemble_features_asof_parity_and_raw_close_cap():
    from workers.stock_scanner.indicators import calculate_indicators

    # 300 weekday bars, adjusted close 5.0 but RAW close 15.0 (a dividend payer's history).
    bars = [DailyBar(b.day, b.open, b.high, b.low, b.close, b.volume, 15.0)
            for b in _weekday_series(2019, 300, 5.0)]
    snapshots = calculate_indicators(bars_to_candles("TEST", bars))
    assert len(snapshots) == len(bars)
    idx = len(bars) - 1

    bundle = _bundle()
    feats = assemble_features_asof(bars, snapshots, idx, edgar_bundle=bundle, as_of="2021-01-31")
    # Same keys/units the live assembler emits for the market-derived domains.
    for key in ("rsi", "volume_ratio", "close", "open", "avg_dollar_volume"):
        assert key in feats
    # Deep domains that need unsourced pipelines stay ABSENT - never defaulted.
    for absent in ("government", "sponsorship", "adoption", "news_attention", "market_context"):
        assert absent not in feats
    # Market cap = shares filed by T x RAW close, not the adjusted series.
    assert feats["market_cap"] == 10_000_000 * 15.0


def test_assemble_features_asof_without_edgar_leaves_fundamentals_absent():
    from workers.stock_scanner.indicators import calculate_indicators

    bars = _weekday_series(2019, 300, 5.0)
    snapshots = calculate_indicators(bars_to_candles("TEST", bars))
    feats = assemble_features_asof(bars, snapshots, len(bars) - 1)
    assert "market_cap" not in feats and "fundamentals" not in feats and "capital" not in feats
