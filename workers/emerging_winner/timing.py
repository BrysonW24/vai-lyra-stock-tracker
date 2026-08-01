"""
Model 6 - Timing & Network Intelligence (deck model 6/6; spec Production v2/v3 challengers).

The deck's sixth model answers two questions the structural scorecard cannot:
  TEMPORAL - is the evidence for this name accelerating, dormant, or already crowded? (the full
  version is a trained temporal model over score-trajectory sequences, Production v2)
  NETWORK  - is the name connected to the clusters winners historically sat inside - smart money,
  supply-chain centrality, government programs? (the full version is a graph model, Production v3)

v1 here is an HONEST REFERENCE read of both halves from the features the engine already receives.
It exists so the 6-model stack is complete end to end and the output contract is fixed; the trained
temporal model and the graph model drop in behind `assess()` later without changing the contract.

SHADOW CHALLENGER, BY DESIGN: Model 6 annotates timing and network context on the finding. It
contributes NOTHING to priority, ranking, or risk verdicts until it earns promotion - a challenger
never silently steers the champion. (`ranker.rank()` takes no timing/network input; that is the
enforcement, and a test pins it.)

COVERAGE HONESTY (same law as the domains): absent inputs mean "not assessed", never a low score.
"""
from __future__ import annotations

from dataclasses import dataclass, field

MODEL_VERSION = "timing-network-reference-v1"

# Timing states (ordered roughly by evidence momentum)
DORMANT = "dormant / weakening"
ACCUMULATING = "evidence accumulating"
CONFIRMING = "confirmation building"
CROWDED = "crowded - attention ahead of evidence"
NOT_ASSESSED = "not assessed (temporal model is a Production v2 challenger)"


@dataclass
class TimingNetworkResult:
    timing_state: str
    timing_score: float | None            # 0-100, None when temporal inputs are absent
    catalyst_window: str
    network_state: str
    network_score: float | None           # 0-100, None when network inputs are absent
    network_notes: list[str] = field(default_factory=list)
    challenger_note: str = (
        "Model 6 runs as a shadow challenger: it annotates timing and network context only, and "
        "contributes nothing to priority or risk until it earns promotion (Production v2/v3)."
    )
    provenance: str = (
        f"{MODEL_VERSION} (shadow-live): deterministic reference read of temporal momentum and "
        "network connectivity; not a trained temporal or graph model."
    )

    def to_dict(self) -> dict:
        return {
            "timing_state": self.timing_state,
            "timing_score": None if self.timing_score is None else round(self.timing_score, 1),
            "catalyst_window": self.catalyst_window,
            "network_state": self.network_state,
            "network_score": None if self.network_score is None else round(self.network_score, 1),
            "network_notes": self.network_notes,
            "challenger_note": self.challenger_note,
            "provenance": self.provenance,
        }


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _assess_temporal(features: dict) -> tuple[str, float | None, str]:
    """Temporal half: is evidence accelerating? Reads the deltas the scanner already computes."""
    score_delta = features.get("score_delta")
    rsi_delta = features.get("rsi_delta")
    macd_delta = features.get("macd_hist_delta")
    if score_delta is None and rsi_delta is None and macd_delta is None:
        return NOT_ASSESSED, None, "not assessed"

    timing = 50.0
    if score_delta is not None:
        timing += _clamp(float(score_delta) * 4.0, -20.0, 20.0)
    if macd_delta is not None:
        # The histogram delta is in PRICE units - normalise to percent-of-price when the close is
        # known (same scale fix as domains.macd_turn: an absolute band pins micro-caps at neutral
        # and saturates large-caps). Falls back to the raw value only when no close is supplied.
        close = features.get("close")
        macd_term = (float(macd_delta) / float(close) * 100.0) if close else float(macd_delta)
        timing += _clamp(macd_term * 10.0, -10.0, 10.0)
    if rsi_delta is not None:
        timing += _clamp(float(rsi_delta) * 1.5, -10.0, 10.0)
    volume_ratio = features.get("volume_ratio")
    if volume_ratio is not None:
        timing += _clamp((float(volume_ratio) - 1.0) * 8.0, -8.0, 8.0)
    timing = _clamp(timing, 0.0, 100.0)

    # Crowding check first: extreme attention with peripheral structure is the pump signature -
    # the temporal model's job is to say "you are late", not "this is confirming".
    theme = features.get("theme_context") or {}
    mention_velocity = float(theme.get("mention_velocity", 0.0))
    news_attention = float(features.get("news_attention", 0.0))
    if mention_velocity >= 0.85 and news_attention >= 0.85:
        state = CROWDED
    elif timing >= 68.0:
        state = CONFIRMING
    elif timing >= 52.0:
        state = ACCUMULATING
    else:
        state = DORMANT

    if state == CROWDED:
        window = "attention peak likely behind or upon us - timing edge gone"
    elif timing >= 68.0:
        window = "near (evidence compounding now)"
    elif timing >= 52.0:
        window = "forming (weeks to months, unconfirmed)"
    else:
        window = "distant or absent"
    return state, timing, window


def _assess_network(features: dict) -> tuple[str, float | None, list[str]]:
    """Network half: is the name inside the clusters winners sat inside? Reads sponsorship,
    supply-chain centrality and government-program links."""
    sponsorship = features.get("sponsorship") or {}
    theme = features.get("theme_context") or {}
    government = features.get("government") or {}
    centrality = theme.get("supply_chain_centrality")
    insider = sponsorship.get("insider_net_buy_usd")
    inst = sponsorship.get("institutional_ownership_change_pct")
    awards = government.get("award_count")
    if insider is None and inst is None and centrality is None and awards is None:
        return "not assessed (graph model is a Production v3 challenger)", None, []

    score = 40.0
    notes: list[str] = []
    if insider is not None:
        if float(insider) >= 500_000:
            score += 15.0
            notes.append(f"Material insider net buying (${float(insider)/1e6:.1f}M).")
        elif float(insider) > 0:
            score += 8.0
            notes.append("Modest insider net buying.")
        else:
            score -= 10.0
            notes.append("Insiders are net sellers.")
    if inst is not None:
        score += _clamp(float(inst) * 2.0, -15.0, 15.0)
        if float(inst) > 0:
            notes.append(f"Institutional ownership rising ({float(inst):+.0f}pp).")
        elif float(inst) < 0:
            notes.append(f"Institutional ownership falling ({float(inst):+.0f}pp).")
    if centrality is not None:
        score += _clamp(float(centrality) * 30.0, 0.0, 30.0)
        if float(centrality) >= 0.6:
            notes.append("Central node in its theme's supply chain.")
        elif float(centrality) < 0.3:
            notes.append("Peripheral to its theme's supply chain.")
    if awards is not None and int(awards) > 0:
        score += _clamp(float(awards) * 5.0, 0.0, 15.0)
        notes.append(f"Linked to government programs ({int(awards)} award(s)).")
    score = _clamp(score, 0.0, 100.0)

    if score >= 70.0:
        state = "well-connected (smart money / centrality / program links present)"
    elif score >= 45.0:
        state = "partially connected"
    else:
        state = "peripheral - little network confirmation"
    return state, score, notes


def assess(features: dict) -> TimingNetworkResult:
    """Run both halves of Model 6 over one candidate's features. Shadow annotation only."""
    timing_state, timing_score, window = _assess_temporal(features)
    network_state, network_score, notes = _assess_network(features)
    return TimingNetworkResult(
        timing_state=timing_state,
        timing_score=timing_score,
        catalyst_window=window,
        network_state=network_state,
        network_score=network_score,
        network_notes=notes,
    )
