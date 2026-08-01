"""
Model 5 - the Risk Gate Stack. Filter out fragile, manipulative or unexecutable setups before they
reach the user (deck 6/7; spec gates 55-58, and the hierarchy's Gate 1 "legitimacy & survivability").

Five gates, each returning PASS / REVIEW / BLOCK / INSUFFICIENT:
  1. Survivability      - can the company stay in the game? (cash runway, burn, debt)
  2. Dilution risk      - will existing holders get diluted heavily? (share-count velocity, raises)
  3. Manipulation/hype  - is attention real or engineered? (float, social acceleration, promotion)
  4. Liquidity/execution- can we enter and exit without ruinous slippage? (avg $ volume, spread)
  5. Downside/failure   - tail risk profile (max drawdown, binary events, legal red flags)

CRITICAL HONESTY RULE: a gate with no data returns INSUFFICIENT, never a silent PASS. A missing pipeline
must not read as "safe". The overall verdict downgrades a high-scoring name (deck example: winner 84 ->
Review due to dilution + weak liquidity), and BLOCK excludes it from the queue entirely.
"""
from __future__ import annotations

from dataclasses import dataclass, field

PASS, REVIEW, BLOCK, INSUFFICIENT = "pass", "review", "block", "insufficient"
_ORDER = {PASS: 0, INSUFFICIENT: 1, REVIEW: 2, BLOCK: 3}


@dataclass
class GateResult:
    key: str
    label: str
    verdict: str                 # pass/review/block/insufficient
    penalty: float               # 0-100 contribution to the overall risk penalty
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "verdict": self.verdict,
                "penalty": round(self.penalty, 1), "reasons": self.reasons}


@dataclass
class RiskAssessment:
    verdict: str                 # overall: pass/review/block
    penalty: float               # 0-100 aggregate risk penalty
    gates: list[GateResult]
    blocked: bool
    def to_dict(self) -> dict:
        return {"verdict": self.verdict, "penalty": round(self.penalty, 1),
                "blocked": self.blocked, "gates": [g.to_dict() for g in self.gates]}


def _ctx(f: dict, name: str) -> dict | None:
    v = f.get(name)
    return v if isinstance(v, dict) else None


def _gate_survivability(f: dict) -> GateResult:
    cap = _ctx(f, "capital")
    if not cap:
        return GateResult("survivability", "Survivability", INSUFFICIENT, 20.0,
                          ["No balance-sheet data (SEC EDGAR pipeline not built) - survivability unproven."])
    runway = cap.get("cash_runway_quarters")
    dte = cap.get("debt_to_equity")
    reasons, penalty, verdict = [], 0.0, PASS
    if runway is not None and runway < 2:
        verdict, penalty = BLOCK, 80.0
        reasons.append(f"Cash runway ~{runway} quarters - acute going-concern risk.")
    elif runway is not None and runway < 4:
        verdict, penalty = REVIEW, 40.0
        reasons.append(f"Cash runway ~{runway} quarters - financing likely needed.")
    if dte is not None and dte > 2.0:
        penalty = max(penalty, 45.0)
        verdict = REVIEW if verdict == PASS else verdict
        reasons.append(f"Debt/equity {dte} - leveraged balance sheet.")
    return GateResult("survivability", "Survivability", verdict, penalty, reasons or ["Adequate runway."])


def _gate_dilution(f: dict) -> GateResult:
    cap = _ctx(f, "capital")
    if not cap:
        return GateResult("dilution", "Dilution risk", INSUFFICIENT, 20.0,
                          ["No share-count / financing history - dilution risk unproven."])
    growth = cap.get("share_count_growth_yoy")
    reasons, penalty, verdict = [], 0.0, PASS
    if growth is not None and growth > 25:
        verdict, penalty = BLOCK, 70.0
        reasons.append(f"Shares outstanding +{growth}% yoy - destructive dilution.")
    elif growth is not None and growth > 12:
        verdict, penalty = REVIEW, 40.0
        reasons.append(f"Shares outstanding +{growth}% yoy - meaningful dilution overhang.")
    return GateResult("dilution", "Dilution risk", verdict, penalty, reasons or ["Dilution in check."])


def _gate_manipulation(f: dict) -> GateResult:
    """Attention is NOT automatically positive - intense social activity can precede lower returns."""
    news = f.get("news_attention")
    tctx = f.get("theme_context") if isinstance(f.get("theme_context"), dict) else None
    mention_velocity = tctx.get("mention_velocity") if tctx else None
    float_shares = f.get("float_shares")
    reasons, penalty, verdict = [], 0.0, PASS
    have_any = False
    if mention_velocity is not None:
        have_any = True
        if mention_velocity > 0.85:
            verdict, penalty = REVIEW, 45.0
            reasons.append("Very high mention velocity - attention may be engineered, not organic.")
    if news is not None and news > 0.9:
        have_any = True
        penalty = max(penalty, 40.0)
        verdict = REVIEW if verdict == PASS else verdict
        reasons.append("Manic news attention - treat as hype until confirmed by fundamentals.")
    if float_shares is not None and float_shares < 5_000_000:
        have_any = True
        penalty = max(penalty, 35.0)
        verdict = REVIEW if verdict == PASS else verdict
        reasons.append("Very low float - outsized manipulation sensitivity.")
    if not have_any:
        return GateResult("manipulation", "Manipulation / hype", INSUFFICIENT, 15.0,
                          ["No float / social / promotion data - manipulation risk unproven."])
    return GateResult("manipulation", "Manipulation / hype", verdict, penalty,
                      reasons or ["No manipulation flags in available signals."])


def _gate_liquidity(f: dict) -> GateResult:
    adv = f.get("avg_dollar_volume")
    if (adv is None and not f.get("usd_semantics_dropped")
            and f.get("close") is not None and f.get("volume") is not None):
        # Fallback only when the FX step did not deliberately drop the USD-semantics fields - close x
        # volume is listing-currency and must not be compared against USD thresholds after that drop.
        adv = f["close"] * f["volume"]
    if adv is None:
        return GateResult("liquidity", "Liquidity / execution", INSUFFICIENT, 20.0,
                          ["No volume data - executable liquidity unproven."])
    if adv < 250_000:
        return GateResult("liquidity", "Liquidity / execution", BLOCK, 70.0,
                          [f"Avg $ volume ~${adv:,.0f}/day - not executable without ruinous slippage."])
    if adv < 2_000_000:
        return GateResult("liquidity", "Liquidity / execution", REVIEW, 35.0,
                          [f"Avg $ volume ~${adv:,.0f}/day - thin; size and slippage matter."])
    return GateResult("liquidity", "Liquidity / execution", PASS, 5.0, ["Adequate executable liquidity."])


def _gate_downside(f: dict) -> GateResult:
    dd = f.get("max_drawdown_pct")  # historical, if supplied
    legal = f.get("legal_red_flags")
    reasons, penalty, verdict = [], 0.0, PASS
    have_any = False
    if dd is not None:
        have_any = True
        if dd <= -70:
            verdict, penalty = REVIEW, 40.0
            reasons.append(f"Historical max drawdown {dd}% - violent downside profile.")
    if legal:
        have_any = True
        verdict, penalty = BLOCK, 85.0
        reasons.append("Regulatory / legal red flags present.")
    if not have_any:
        return GateResult("downside", "Downside / failure", INSUFFICIENT, 15.0,
                          ["No drawdown / legal data - tail risk unproven."])
    return GateResult("downside", "Downside / failure", verdict, penalty, reasons or ["No downside flags."])


_GATES = [_gate_survivability, _gate_dilution, _gate_manipulation, _gate_liquidity, _gate_downside]


def assess_risk(features: dict) -> RiskAssessment:
    gates = [g(features) for g in _GATES]
    worst = max(gates, key=lambda g: _ORDER[g.verdict]).verdict
    blocked = any(g.verdict == BLOCK for g in gates)

    # Overall verdict: any block -> block; else review if any review OR >=3 gates lack data.
    insufficient = sum(1 for g in gates if g.verdict == INSUFFICIENT)
    if blocked:
        overall = BLOCK
    elif any(g.verdict == REVIEW for g in gates) or insufficient >= 3:
        overall = REVIEW
    else:
        overall = PASS

    # Aggregate penalty: emphasise the worst gate, add the rest at diminishing weight.
    penalties = sorted((g.penalty for g in gates), reverse=True)
    penalty = penalties[0] if penalties else 0.0
    for p in penalties[1:]:
        penalty = min(100.0, penalty + p * 0.25)

    return RiskAssessment(verdict=overall, penalty=penalty, gates=gates, blocked=blocked)
