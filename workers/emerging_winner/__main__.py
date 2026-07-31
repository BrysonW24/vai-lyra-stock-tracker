"""
Runnable demo of the full Emerging Winner Engine pipeline (Models 1-5, shadow-live reference-v1).

    python -m workers.emerging_winner

Runs illustrative candidates end to end (domain scorecard -> classifier -> analogues -> archetype+rank
-> risk gates -> ranked output) and prints the research queue. ILLUSTRATIVE fixtures, not live data.
"""
from __future__ import annotations

from .engine import EmergingWinnerResult, rank_universe

DEMO: list[tuple[str, dict]] = [
    # Quantum/AI small cap, technical turn, gov contracts, sound capital -> strong candidate.
    ("QBIT", {
        "rsi": 44.0, "rsi_delta": 2.1, "macd_hist": -0.3, "macd_hist_delta": 0.4, "score_delta": 5.0,
        "price_vs_sma200": 1.04, "dist_from_60_low_pct": 9.0,
        "volume_ratio": 1.9, "close": 12.4, "open": 11.8, "volume": 2_400_000, "volume_state": "accumulation",
        "market_cap": 680_000_000, "avg_dollar_volume": 29_760_000,
        "theme_context": {"themes": ["quantum", "ai", "defence"], "supply_chain_centrality": 0.72, "mention_velocity": 0.55},
        "market_context": {"regime": "risk_on"}, "news_attention": 0.55, "portfolio_relevance": 0.6,
        "government": {"award_count": 3, "contract_value_usd": 42_000_000, "policy_alignment": 0.8},
        "fundamentals": {"revenue_growth_yoy": 45.0, "gross_margin_trend": 0.4, "cash_burn_quality": 0.7},
        "capital": {"cash_runway_quarters": 6.0, "share_count_growth_yoy": 4.0, "debt_to_equity": 0.4},
        "sponsorship": {"insider_net_buy_usd": 1_200_000, "institutional_ownership_change_pct": 6.0},
    }),
    # Speculative pump: hot narrative, tiny float, thin liquidity, dilution -> risk downgrade / block.
    ("HYPE", {
        "rsi": 63.0, "rsi_delta": 3.0, "macd_hist": 0.4, "macd_hist_delta": 0.2, "score_delta": 1.0,
        "price_vs_sma200": 1.2, "dist_from_60_low_pct": 40.0,
        "volume_ratio": 3.4, "close": 2.1, "open": 1.7, "volume": 90_000, "volume_state": "high",
        "market_cap": 90_000_000, "avg_dollar_volume": 189_000, "float_shares": 3_000_000,
        "theme_context": {"themes": ["quantum"], "supply_chain_centrality": 0.2, "mention_velocity": 0.95},
        "market_context": {"regime": "risk_on"}, "news_attention": 0.95,
        "capital": {"cash_runway_quarters": 1.0, "share_count_growth_yoy": 35.0, "debt_to_equity": 1.2},
    }),
    # Technical-only read: honest under-assessment.
    ("TCNO", {
        "rsi": 41.0, "rsi_delta": 1.8, "macd_hist": -0.5, "macd_hist_delta": 0.5, "score_delta": 3.0,
        "price_vs_sma200": 1.01, "dist_from_60_low_pct": 11.0,
        "volume_ratio": 1.6, "close": 8.2, "open": 7.9, "volume": 900_000, "volume_state": "high",
        "market_cap": 540_000_000, "avg_dollar_volume": 7_380_000,
    }),
]


def render(r: EmergingWinnerResult) -> str:
    d = r.to_dict()
    top_contrib = ", ".join(f"{c['label']} {c['contribution']:+.0f}" for c in d["contributions"][:4])
    winners = ", ".join(f"{m['name']} {m['similarity']:.0f}" for m in d["analogues"]["nearest_winners"][:2])
    dist = d["outcome_distribution"]
    lines = [
        f"{r.symbol}  ·  {d['stage_label'].upper()}  ·  winner-similarity {d['winner_similarity']:.0f}/100  "
        f"·  {d['archetype']}  ·  confidence {d['confidence']}",
        f"    priority {d['priority_score']:.0f}  ·  action {d['action']}  ·  risk {d['risk']['verdict'].upper()} "
        f"(penalty {d['risk']['penalty']:.0f})  ·  surfaced={d['surfaced']}",
        f"    domain completeness {int(d['completeness']*100)}%  ·  timing: {d['timing_state']}",
        f"    top drivers: {top_contrib}",
        f"    nearest winners: {winners or 'n/a'}  ·  winner/failure ratio {d['analogues']['winner_failure_ratio']:.2f}",
        f"    outcome: P(2x)~{dist['p_2x_24m']*100:.0f}% P(5x)~{dist['p_5x_36m']*100:.0f}% "
        f"P(10x)~{dist['p_10x_60m']*100:.0f}% P(-80%)~{dist['p_ruin']*100:.0f}%  ·  survivability {dist['survivability']}",
        f"    top risk: {d['risks'][0] if d['risks'] else 'n/a'}",
    ]
    return "\n".join(lines)


def main() -> None:
    print("Lyra Emerging Winner Engine - full pipeline (shadow-live reference-v1, illustrative data)\n")
    ranked = rank_universe(DEMO)
    print("Research queue (surfaced, highest priority first):\n")
    for r in ranked:
        print(render(r))
        print()


if __name__ == "__main__":
    main()
