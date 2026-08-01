"""
FX normalisation for the multi-market pool - CI-safe (no network).

The USD-thresholded gates (liquidity, cap tiers) must read comparable numbers across markets. These
tests prove the degradation ladder (live -> cached -> stale -> pinned -> absent) and the one honesty
rule that matters most: when no rate exists, the USD-semantics fields are DROPPED, never mislabelled.

Timezone rule: nothing here reads a local clock; cache TTL tests monkeypatch the fetch, not time.
"""
from __future__ import annotations

from workers.emerging_winner import fx
from workers.emerging_winner import feature_source


def test_parse_frankfurter_payload():
    assert fx.parse_frankfurter_usd({"amount": 1.0, "base": "AUD", "rates": {"USD": 0.6612}}) == 0.6612
    assert fx.parse_frankfurter_usd({"rates": {}}) is None
    assert fx.parse_frankfurter_usd({}) is None
    assert fx.parse_frankfurter_usd({"rates": {"USD": -1}}) is None


def test_usd_is_identity_and_unknown_is_none(monkeypatch):
    monkeypatch.setattr(fx, "_fetch_live", lambda ccy, timeout=10: None)
    monkeypatch.setattr(fx, "_read_cache", lambda: {})
    monkeypatch.setattr(fx, "_write_cache", lambda cache: None)
    assert fx.usd_rate("USD") == (1.0, "identity")
    assert fx.usd_rate("ZZZ") is None  # unknown currency, no source -> None (caller drops the fields)


def test_ladder_live_then_stale_then_pinned(monkeypatch):
    monkeypatch.setattr(fx, "_write_cache", lambda cache: None)
    # Live wins when the fetch works.
    monkeypatch.setattr(fx, "_read_cache", lambda: {})
    monkeypatch.setattr(fx, "_fetch_live", lambda ccy, timeout=10: 0.66)
    assert fx.usd_rate("AUD") == (0.66, "live")
    # Stale cache beats the pin when the fetch fails - it was a real observed rate.
    monkeypatch.setattr(fx, "_fetch_live", lambda ccy, timeout=10: None)
    monkeypatch.setattr(fx, "_read_cache", lambda: {"AUD": {"rate": 0.64, "at": 0}})
    assert fx.usd_rate("AUD") == (0.64, "stale")
    # Nothing observed ever -> the pinned approximate rate, flagged as such.
    monkeypatch.setattr(fx, "_read_cache", lambda: {})
    rate = fx.usd_rate("AUD")
    assert rate is not None and rate[1] == "pinned" and rate[0] == fx.PINNED_USD_RATES["AUD"]


def test_gbx_pence_derives_from_gbp(monkeypatch):
    monkeypatch.setattr(fx, "_write_cache", lambda cache: None)
    monkeypatch.setattr(fx, "_read_cache", lambda: {})
    monkeypatch.setattr(fx, "_fetch_live", lambda ccy, timeout=10: 1.25)
    rate = fx.usd_rate("GBX")
    assert rate is not None and abs(rate[0] - 0.0125) < 1e-9  # pence = GBP / 100


def test_feature_assembly_converts_usd_semantics_fields(monkeypatch):
    feats = {"market_cap": 1_000_000_000.0, "avg_dollar_volume": 2_000_000.0, "close": 5.0, "_currency": "AUD"}
    monkeypatch.setattr(fx, "usd_rate", lambda ccy, **kw: (0.5, "live"))
    feature_source._normalise_to_usd(feats, None)
    assert feats["market_cap"] == 500_000_000.0      # AUD cap halved into USD
    assert feats["avg_dollar_volume"] == 1_000_000.0
    assert feats["close"] == 5.0                      # native price untouched (scale-invariant maths)
    assert "_currency" not in feats                   # the private key never leaks into the features


def test_feature_assembly_drops_fields_when_no_rate_exists(monkeypatch):
    feats = {"market_cap": 1.0, "avg_dollar_volume": 2.0, "close": 5.0}
    monkeypatch.setattr(fx, "usd_rate", lambda ccy, **kw: None)
    feature_source._normalise_to_usd(feats, "ZZZ")
    assert "market_cap" not in feats and "avg_dollar_volume" not in feats  # absent beats wrong
    assert feats["close"] == 5.0


def test_feature_assembly_is_a_noop_for_usd():
    feats = {"market_cap": 7.0, "avg_dollar_volume": 8.0}
    feature_source._normalise_to_usd(feats, "USD")
    assert feats == {"market_cap": 7.0, "avg_dollar_volume": 8.0}
