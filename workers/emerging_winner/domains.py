"""
The 10 domains of the Emerging Winner scorecard.

Each domain is a pure function: (features: dict) -> DomainResult. A domain inspects which of its
sub-signal inputs are present and:
  - returns coverage="unavailable" (score=None) when NONE of its inputs are present, carrying an honest
    `reason` naming the pipeline that must be built to light it up;
  - returns coverage="partial" when SOME are present (score computed from those only);
  - returns coverage="full" when ALL expected sub-signals are present.

A domain score is 0-100. It is the mean of its present sub-signal scores (equal weight in this v0 - the
learned model in Layer 2 will learn the real weights; this deterministic layer stays simple and legible).

The input `features` dict contract (all keys optional - the engine is tolerant by design):

  Technical / volume / liquidity (REAL today, from the scanner's indicator snapshot):
    rsi, rsi_delta, macd_hist, macd_hist_delta,
    price_vs_sma20, price_vs_sma50, price_vs_sma200,   # ratios: close / SMA (1.0 = at the average)
    dist_from_60_low_pct,                              # % above the 60-period low
    volume_ratio, close, open, volume, volume_state,
    avg_dollar_volume, market_cap

  Context sub-dicts (present only when their pipeline exists - unavailable in this first slice):
    theme_context      = {"themes": [str], "supply_chain_centrality": 0..1, "mention_velocity": 0..1}
    market_context     = {"regime": "risk_on"|"neutral"|"risk_off"}
    news_attention     = 0..1
    fundamentals       = {"revenue_growth_yoy": pct, "gross_margin_trend": -1..1, "cash_burn_quality": 0..1}
    capital            = {"cash_runway_quarters": n, "share_count_growth_yoy": pct, "debt_to_equity": n}
    government         = {"award_count": n, "contract_value_usd": n, "policy_alignment": 0..1}
    adoption           = {"traction_score": 0..1}
    sponsorship        = {"insider_net_buy_usd": n, "institutional_ownership_change_pct": pct}
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

# Themes Lyra treats as structurally relevant to the 2025-2026 winner regime.
HOT_THEMES = {
    "ai", "agi", "robotics", "quantum", "defence", "defense", "space",
    "power", "energy", "infrastructure", "semiconductors", "chips", "compute",
}

PRESENT_THRESHOLD = 60.0  # a domain scoring at/above this counts as a "present trait"


@dataclass
class SubSignal:
    name: str
    value: Optional[float]
    score: Optional[float]  # 0-100, or None if the input was absent


@dataclass
class DomainResult:
    key: str
    label: str
    score: Optional[float]          # 0-100 over present sub-signals, or None when unavailable
    coverage: str                   # "full" | "partial" | "unavailable"
    reason: str                     # why unavailable, or "" when scored
    subsignals: list[SubSignal] = field(default_factory=list)

    @property
    def available(self) -> bool:
        return self.score is not None

    @property
    def is_present_trait(self) -> bool:
        return self.score is not None and self.score >= PRESENT_THRESHOLD

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "score": None if self.score is None else round(self.score, 1),
            "coverage": self.coverage,
            "reason": self.reason,
            "subsignals": [
                {"name": s.name, "value": s.value, "score": None if s.score is None else round(s.score, 1)}
                for s in self.subsignals
            ],
        }


# --- helpers --------------------------------------------------------------------------------------

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _scale(v: Optional[float], lo: float, hi: float) -> Optional[float]:
    """Map lo->0, hi->100, clamped. None passes through (absent input)."""
    if v is None:
        return None
    if hi == lo:
        return 0.0
    return _clamp((v - lo) / (hi - lo) * 100.0, 0.0, 100.0)


def _reset_band_score(rsi: Optional[float]) -> Optional[float]:
    """Peaks in the 35-50 RSI reset band (centre 42.5), decays outside it."""
    if rsi is None:
        return None
    return _clamp((1.0 - abs(rsi - 42.5) / 20.0) * 100.0, 0.0, 100.0)


def _finish(key: str, label: str, subs: list[SubSignal], expected: int, reason_if_empty: str) -> DomainResult:
    present = [s for s in subs if s.score is not None]
    if not present:
        return DomainResult(key, label, None, "unavailable", reason_if_empty, subs)
    score = sum(s.score for s in present) / len(present)
    coverage = "full" if len(present) >= expected else "partial"
    return DomainResult(key, label, score, coverage, "", subs)


def _get(features: dict, *keys):
    for k in keys:
        if k in features and features[k] is not None:
            return features[k]
    return None


def _ctx(features: dict, name: str) -> Optional[dict]:
    v = features.get(name)
    return v if isinstance(v, dict) else None


# --- the 10 domains -------------------------------------------------------------------------------

def domain_technical(f: dict) -> DomainResult:
    rsi = _get(f, "rsi")
    rsi_delta = _get(f, "rsi_delta")
    macd_hist = _get(f, "macd_hist")
    macd_hist_delta = _get(f, "macd_hist_delta")
    p200 = _get(f, "price_vs_sma200")
    dist_low = _get(f, "dist_from_60_low_pct")

    subs = [
        SubSignal("rsi_reset_band", rsi, _reset_band_score(rsi)),
        SubSignal("rsi_improving", rsi_delta, _scale(rsi_delta, -3.0, 3.0)),
        # An improving histogram while still negative is the early-turn tell (weighted up).
        SubSignal(
            "macd_turn", macd_hist_delta,
            None if macd_hist_delta is None
            else _scale(macd_hist_delta * (1.0 if (macd_hist or 0) < 0 else 0.6), -1.0, 1.0),
        ),
        SubSignal("trend_vs_sma200", p200, _scale(p200, 0.85, 1.15)),
        # Off the lows but not extended: reward ~5-15% above the 60-low.
        SubSignal(
            "price_off_lows", dist_low,
            None if dist_low is None else _clamp((1.0 - abs(dist_low - 10.0) / 20.0) * 100.0, 0.0, 100.0),
        ),
    ]
    return _finish("technical", "Technical structure", subs, expected=5,
                   reason_if_empty="no price/indicator snapshot supplied")


def domain_accumulation(f: dict) -> DomainResult:
    vr = _get(f, "volume_ratio")
    close = _get(f, "close")
    open_ = _get(f, "open")
    state = _get(f, "volume_state")

    up_day_vol = None
    if vr is not None and close is not None and open_ is not None:
        up_day_vol = _scale(vr, 0.8, 2.5) if close >= open_ else _scale(vr, 0.8, 2.5) * 0.4

    state_score = None
    if isinstance(state, str):
        state_score = {"accumulation": 85.0, "high": 70.0, "normal": 50.0, "low": 25.0}.get(state.lower())

    subs = [
        SubSignal("volume_ratio", vr, _scale(vr, 0.5, 2.5)),
        SubSignal("rising_vol_up_day", None if up_day_vol is None else round(up_day_vol, 2), up_day_vol),
        SubSignal("volume_state", state, state_score),
    ]
    return _finish("accumulation", "Volume / accumulation", subs, expected=2,
                   reason_if_empty="no volume snapshot supplied")


def domain_liquidity(f: dict) -> DomainResult:
    adv = _get(f, "avg_dollar_volume")
    if adv is None:
        close, vol = _get(f, "close"), _get(f, "volume")
        if close is not None and vol is not None:
            adv = close * vol
    mcap = _get(f, "market_cap")

    subs = [
        # $1M/day is thin, $50M/day is comfortably tradable.
        SubSignal("avg_dollar_volume", adv, _scale(adv, 1_000_000, 50_000_000)),
        # Small-cap sweet spot band: reward ~$100M-$2B, taper toward micro/large.
        SubSignal(
            "market_cap_band", mcap,
            None if mcap is None else _clamp((1.0 - abs(mcap - 750_000_000) / 1_250_000_000) * 100.0, 15.0, 100.0),
        ),
    ]
    # float / dilution sub-signals are intentionally absent until the fundamentals pipeline exists.
    return _finish("liquidity", "Liquidity / tradability", subs, expected=3,
                   reason_if_empty="no liquidity inputs (price/volume or market cap) supplied")


def domain_theme(f: dict) -> DomainResult:
    ctx = _ctx(f, "theme_context")
    if not ctx:
        return DomainResult("theme", "Theme strength", None, "unavailable",
                            "no theme-graph membership supplied (curated theme graph needs small-cap coverage)", [])
    themes = ctx.get("themes") or []
    hot_hits = sum(1 for t in themes if str(t).lower() in HOT_THEMES)
    subs = [
        SubSignal("hot_theme_exposure", hot_hits, _scale(hot_hits, 0, 3)),
        SubSignal("supply_chain_centrality", ctx.get("supply_chain_centrality"),
                  _scale(ctx.get("supply_chain_centrality"), 0.0, 1.0)),
        SubSignal("mention_velocity", ctx.get("mention_velocity"),
                  _scale(ctx.get("mention_velocity"), 0.0, 1.0)),
    ]
    return _finish("theme", "Theme strength", subs, expected=3,
                   reason_if_empty="theme context present but empty")


def domain_business_quality(f: dict) -> DomainResult:
    ctx = _ctx(f, "fundamentals")
    if not ctx:
        return DomainResult("business_quality", "Business quality", None, "unavailable",
                            "no SEC EDGAR fundamentals pipeline yet", [])
    subs = [
        SubSignal("revenue_growth_yoy", ctx.get("revenue_growth_yoy"), _scale(ctx.get("revenue_growth_yoy"), 0.0, 100.0)),
        SubSignal("gross_margin_trend", ctx.get("gross_margin_trend"), _scale(ctx.get("gross_margin_trend"), -1.0, 1.0)),
        SubSignal("cash_burn_quality", ctx.get("cash_burn_quality"), _scale(ctx.get("cash_burn_quality"), 0.0, 1.0)),
    ]
    return _finish("business_quality", "Business quality", subs, expected=3,
                   reason_if_empty="fundamentals context present but empty")


def domain_capital(f: dict) -> DomainResult:
    ctx = _ctx(f, "capital")
    if not ctx:
        return DomainResult("capital", "Capital / survivability", None, "unavailable",
                            "no SEC EDGAR balance-sheet / dilution pipeline yet", [])
    runway = ctx.get("cash_runway_quarters")
    dilution = ctx.get("share_count_growth_yoy")  # higher = worse
    dte = ctx.get("debt_to_equity")
    subs = [
        SubSignal("cash_runway_quarters", runway, _scale(runway, 0.0, 8.0)),
        SubSignal("low_dilution", dilution, None if dilution is None else _scale(-dilution, -30.0, 0.0)),
        SubSignal("balance_sheet_resilience", dte, None if dte is None else _scale(-dte, -3.0, 0.0)),
    ]
    return _finish("capital", "Capital / survivability", subs, expected=3,
                   reason_if_empty="capital context present but empty")


def domain_government(f: dict) -> DomainResult:
    ctx = _ctx(f, "government")
    if not ctx:
        return DomainResult("government", "Government / policy", None, "unavailable",
                            "no USAspending / SAM.gov awards pipeline yet", [])
    subs = [
        SubSignal("award_count", ctx.get("award_count"), _scale(ctx.get("award_count"), 0, 5)),
        SubSignal("contract_value_usd", ctx.get("contract_value_usd"), _scale(ctx.get("contract_value_usd"), 0, 100_000_000)),
        SubSignal("policy_alignment", ctx.get("policy_alignment"), _scale(ctx.get("policy_alignment"), 0.0, 1.0)),
    ]
    return _finish("government", "Government / policy", subs, expected=2,
                   reason_if_empty="government context present but empty")


def domain_adoption(f: dict) -> DomainResult:
    ctx = _ctx(f, "adoption")
    if not ctx:
        return DomainResult("adoption", "Adoption / traction", None, "unavailable",
                            "adoption/traction data not sourced (largely private/paywalled)", [])
    subs = [SubSignal("traction_score", ctx.get("traction_score"), _scale(ctx.get("traction_score"), 0.0, 1.0))]
    return _finish("adoption", "Adoption / traction", subs, expected=1,
                   reason_if_empty="adoption context present but empty")


def domain_sponsorship(f: dict) -> DomainResult:
    ctx = _ctx(f, "sponsorship")
    if not ctx:
        return DomainResult("sponsorship", "Sponsorship / smart money", None, "unavailable",
                            "no SEC EDGAR Form 4 / 13F pipeline yet", [])
    subs = [
        SubSignal("insider_net_buy_usd", ctx.get("insider_net_buy_usd"), _scale(ctx.get("insider_net_buy_usd"), 0, 5_000_000)),
        SubSignal("institutional_ownership_change_pct", ctx.get("institutional_ownership_change_pct"),
                  _scale(ctx.get("institutional_ownership_change_pct"), -5.0, 15.0)),
    ]
    return _finish("sponsorship", "Sponsorship / smart money", subs, expected=2,
                   reason_if_empty="sponsorship context present but empty")


def domain_narrative(f: dict) -> DomainResult:
    mc = _ctx(f, "market_context")
    regime = mc.get("regime") if mc else None
    regime_score = None
    if isinstance(regime, str):
        regime_score = {"risk_on": 80.0, "neutral": 50.0, "risk_off": 25.0}.get(regime.lower())
    news = _get(f, "news_attention")

    subs = [
        SubSignal("macro_regime_fit", regime, regime_score),
        # "Beginning to care, not manic": a middling attention reads best.
        SubSignal("news_attention", news,
                  None if news is None else _clamp((1.0 - abs(news - 0.6) / 0.6) * 100.0, 0.0, 100.0)),
    ]
    return _finish("narrative", "Narrative timing / attention", subs, expected=2,
                   reason_if_empty="no market-regime or news-attention inputs supplied")


# Ordered registry - the 10 domains in canonical order.
DOMAIN_REGISTRY: list[Callable[[dict], DomainResult]] = [
    domain_technical,
    domain_accumulation,
    domain_liquidity,
    domain_theme,
    domain_business_quality,
    domain_capital,
    domain_government,
    domain_adoption,
    domain_sponsorship,
    domain_narrative,
]

# Relative importance for the composite (v0 hand-designed; Layer 2 will learn the real weights).
# Theme, government, sponsorship and business quality carry the most weight - the structural traits that
# most separated 2025-2026 small-cap winners from also-rans. Normalised over AVAILABLE domains at runtime.
#
# Evidence provenance (MODEL-SELECTION-AND-OSS-STACK.md 3.2/3.3), stated honestly so bets read as bets:
#  - `capital` (net share issuance / dilution) is the ONLY weight backed by a Hou-Xue-Zhang-grade,
#    internationally-replicated anomaly (Pontiff & Woodgate, JF 2008). It is a NEGATIVE predictor, so its
#    highest-value use is as a risk GATE (risk_gates.py Gate 1), not just a scoring input.
#  - `theme` (16.0, top weight) has NO cross-sectional asset-pricing evidence. It is a deliberate bet on
#    differentiation - kept as the top weight ON PURPOSE, and labelled as a bet rather than dressed as fact.
#  - `technical` (12.0) predicts *timing*, not archetype (Gu/Kelly/Xiu found technicals help mean-return
#    prediction, a different task). It is a candidate to DOWN-WEIGHT here and move to Model A's timing job.
DOMAIN_WEIGHTS: dict[str, float] = {
    "technical": 12.0,
    "accumulation": 10.0,
    "liquidity": 8.0,
    "theme": 16.0,
    "business_quality": 12.0,
    "capital": 10.0,
    "government": 12.0,
    "adoption": 8.0,
    "sponsorship": 12.0,
    "narrative": 10.0,
}


def score_domains(features: dict) -> list[DomainResult]:
    """Run all 10 domains in canonical order."""
    return [fn(features) for fn in DOMAIN_REGISTRY]
