/**
 * Demo fallback for the Emerging Winner Engine surface, used when Supabase is not configured or the
 * ledger is empty. GENERATED from the Python engine (rank_universe over the illustrative candidates)
 * so it can never drift from real engine output. Regenerate: see workers/emerging_winner/main.py.
 * Illustrative data, not live market data.
 */
import type { EmergingWinnerQueue } from './types';

export const DEMO_QUEUE: EmergingWinnerQueue = {
  "queue": [
    {
      "symbol": "QBIT",
      "engine_version": "emerging-winner-engine-v1-shadow-live",
      "generated_at": "2026-07-29T00:00:00+00:00",
      "winner_similarity": 70.3,
      "probability": 0.7027,
      "ordinal_stage": 3,
      "stage_label": "breakout archetype",
      "confidence": "high",
      "completeness": 0.9,
      "archetype": "Quantum Infrastructure",
      "archetype_confidence": "medium",
      "market_cap": 680000000,
      "domain_composite": 70.2,
      "present_traits": [
        "Technical structure",
        "Volume / accumulation",
        "Liquidity / tradability",
        "Theme strength",
        "Business quality",
        "Capital / survivability",
        "Government / policy",
        "Narrative timing / attention"
      ],
      "strongest_domains": [
        "Narrative timing / attention",
        "Capital / survivability",
        "Technical structure",
        "Liquidity / tradability"
      ],
      "weakest_domains": [
        "Sponsorship / smart money",
        "Government / policy",
        "Business quality"
      ],
      "missing_domains": [
        "Adoption / traction - adoption/traction data not sourced (largely private/paywalled)"
      ],
      "contributions": [
        {
          "domain": "theme",
          "label": "Theme strength",
          "contribution": 5.775072476631507
        },
        {
          "domain": "technical",
          "label": "Technical structure",
          "contribution": 5.259441005503693
        },
        {
          "domain": "narrative",
          "label": "Narrative timing / attention",
          "contribution": 5.039125740567266
        },
        {
          "domain": "capital",
          "label": "Capital / survivability",
          "contribution": 4.609432847960754
        },
        {
          "domain": "accumulation",
          "label": "Volume / accumulation",
          "contribution": 3.2675042421735747
        },
        {
          "domain": "liquidity",
          "label": "Liquidity / tradability",
          "contribution": 2.9865680934013765
        },
        {
          "domain": "business_quality",
          "label": "Business quality",
          "contribution": 1.9687747079425586
        },
        {
          "domain": "government",
          "label": "Government / policy",
          "contribution": 1.8000225901189109
        },
        {
          "domain": "sponsorship",
          "label": "Sponsorship / smart money",
          "contribution": -1.771897237148303
        }
      ],
      "domains": [
        {
          "key": "technical",
          "label": "Technical structure",
          "score": 81.2,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "rsi_reset_band",
              "value": 44.0,
              "score": 92.5
            },
            {
              "name": "rsi_improving",
              "value": 2.1,
              "score": 85.0
            },
            {
              "name": "macd_turn",
              "value": 0.4,
              "score": 70.0
            },
            {
              "name": "trend_vs_sma200",
              "value": 1.04,
              "score": 63.3
            },
            {
              "name": "price_off_lows",
              "value": 9.0,
              "score": 95.0
            }
          ]
        },
        {
          "key": "accumulation",
          "label": "Volume / accumulation",
          "score": 73.2,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "volume_ratio",
              "value": 1.9,
              "score": 70.0
            },
            {
              "name": "rising_vol_up_day",
              "value": 64.71,
              "score": 64.7
            },
            {
              "name": "volume_state",
              "value": "accumulation",
              "score": 85.0
            }
          ]
        },
        {
          "key": "liquidity",
          "label": "Liquidity / tradability",
          "score": 76.5,
          "coverage": "partial",
          "reason": "",
          "subsignals": [
            {
              "name": "avg_dollar_volume",
              "value": 29760000,
              "score": 58.7
            },
            {
              "name": "market_cap_band",
              "value": 680000000,
              "score": 94.4
            }
          ]
        },
        {
          "key": "theme",
          "label": "Theme strength",
          "score": 75.7,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "hot_theme_exposure",
              "value": 3,
              "score": 100.0
            },
            {
              "name": "supply_chain_centrality",
              "value": 0.72,
              "score": 72.0
            },
            {
              "name": "mention_velocity",
              "value": 0.55,
              "score": 55.0
            }
          ]
        },
        {
          "key": "business_quality",
          "label": "Business quality",
          "score": 61.7,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "revenue_growth_yoy",
              "value": 45.0,
              "score": 45.0
            },
            {
              "name": "gross_margin_trend",
              "value": 0.4,
              "score": 70.0
            },
            {
              "name": "cash_burn_quality",
              "value": 0.7,
              "score": 70.0
            }
          ]
        },
        {
          "key": "capital",
          "label": "Capital / survivability",
          "score": 82.8,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "cash_runway_quarters",
              "value": 6.0,
              "score": 75.0
            },
            {
              "name": "low_dilution",
              "value": 4.0,
              "score": 86.7
            },
            {
              "name": "balance_sheet_resilience",
              "value": 0.4,
              "score": 86.7
            }
          ]
        },
        {
          "key": "government",
          "label": "Government / policy",
          "score": 60.7,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "award_count",
              "value": 3,
              "score": 60.0
            },
            {
              "name": "contract_value_usd",
              "value": 42000000,
              "score": 42.0
            },
            {
              "name": "policy_alignment",
              "value": 0.8,
              "score": 80.0
            }
          ]
        },
        {
          "key": "adoption",
          "label": "Adoption / traction",
          "score": null,
          "coverage": "unavailable",
          "reason": "adoption/traction data not sourced (largely private/paywalled)",
          "subsignals": []
        },
        {
          "key": "sponsorship",
          "label": "Sponsorship / smart money",
          "score": 39.5,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "insider_net_buy_usd",
              "value": 1200000,
              "score": 24.0
            },
            {
              "name": "institutional_ownership_change_pct",
              "value": 6.0,
              "score": 55.0
            }
          ]
        },
        {
          "key": "narrative",
          "label": "Narrative timing / attention",
          "score": 85.8,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "macro_regime_fit",
              "value": "risk_on",
              "score": 80.0
            },
            {
              "name": "news_attention",
              "value": 0.55,
              "score": 91.7
            }
          ]
        }
      ],
      "analogues": {
        "nearest_winners": [
          {
            "name": "RoboCore Systems (ref)",
            "archetype": "Robotics Platform",
            "era": "2019-2022",
            "label": "winner",
            "similarity": 76.2
          },
          {
            "name": "Veridian Labs (ref)",
            "archetype": "AI Infrastructure Enabler",
            "era": "2017-2020",
            "label": "winner",
            "similarity": 75.5
          },
          {
            "name": "AlphaWave (ref)",
            "archetype": "AI Infrastructure Enabler",
            "era": "2016-2019",
            "label": "winner",
            "similarity": 74.9
          }
        ],
        "nearest_failures": [
          {
            "name": "Bitforge Tech (ref)",
            "archetype": "Speculative narrative",
            "era": "2015-2017",
            "label": "failure",
            "similarity": 16.7
          },
          {
            "name": "Quantum Ridge (ref)",
            "archetype": "Speculative narrative",
            "era": "2016-2018",
            "label": "failure",
            "similarity": 11.1
          },
          {
            "name": "Hyperion Data (ref)",
            "archetype": "Speculative narrative",
            "era": "2014-2016",
            "label": "failure",
            "similarity": 0.0
          }
        ],
        "winner_similarity": 76.2,
        "failure_similarity": 16.7,
        "winner_failure_ratio": 4.57,
        "present_that_winners_had": [
          "Technical structure",
          "Volume / accumulation",
          "Liquidity / tradability",
          "Theme strength",
          "Business quality",
          "Capital / survivability",
          "Narrative timing / attention"
        ],
        "missing_vs_top_winner": [
          "Sponsorship / smart money"
        ],
        "provenance": "reference-v1 (shadow-live): cosine match over an illustrative reference seed, not a vector index over real historical snapshots. Case-based context, not advice."
      },
      "outcome_distribution": {
        "p_2x_24m": 0.361,
        "p_5x_36m": 0.142,
        "p_10x_60m": 0.051,
        "p_ruin": 0.092,
        "survivability": "high",
        "expected_time_to_catalyst_months": 11,
        "expected_max_drawdown_pct": -31.8,
        "provenance": "reference-v1 (shadow-live): coarse distribution derived from the classifier probability and risk penalty; not a trained competing-risk model. Modelled estimate, not a promise."
      },
      "risk": {
        "verdict": "pass",
        "penalty": 16.2,
        "blocked": false,
        "gates": [
          {
            "key": "survivability",
            "label": "Survivability",
            "verdict": "pass",
            "penalty": 0.0,
            "reasons": [
              "Adequate runway."
            ]
          },
          {
            "key": "dilution",
            "label": "Dilution risk",
            "verdict": "pass",
            "penalty": 0.0,
            "reasons": [
              "Dilution in check."
            ]
          },
          {
            "key": "manipulation",
            "label": "Manipulation / hype",
            "verdict": "pass",
            "penalty": 0.0,
            "reasons": [
              "No manipulation flags in available signals."
            ]
          },
          {
            "key": "liquidity",
            "label": "Liquidity / execution",
            "verdict": "pass",
            "penalty": 5.0,
            "reasons": [
              "Adequate executable liquidity."
            ]
          },
          {
            "key": "downside",
            "label": "Downside / failure",
            "verdict": "insufficient",
            "penalty": 15.0,
            "reasons": [
              "No drawdown / legal data - tail risk unproven."
            ]
          }
        ]
      },
      "priority_score": 57.1,
      "action": "deep_research",
      "ranking_signals": {
        "winner_score": 70.27228657541833,
        "model_confidence_pct": 95.0,
        "risk_penalty": 16.25,
        "catalyst_freshness": 55.00000000000001,
        "portfolio_relevance": 60.0
      },
      "surfaced": true,
      "timing_state": "confirmation building",
      "timing": {
        "timing_state": "confirmation building",
        "timing_score": 84.4,
        "catalyst_window": "near (evidence compounding now)",
        "network_state": "well-connected (smart money / centrality / program links present)",
        "network_score": 100.0,
        "network_notes": [
          "Material insider net buying ($1.2M).",
          "Institutional ownership rising (+6pp).",
          "Central node in its theme's supply chain.",
          "Linked to government programs (3 award(s))."
        ],
        "challenger_note": "Model 6 runs as a shadow challenger: it annotates timing and network context only, and contributes nothing to priority or risk until it earns promotion (Production v2/v3).",
        "provenance": "timing-network-reference-v1 (shadow-live): deterministic reference read of temporal momentum and network connectivity; not a trained temporal or graph model."
      },
      "risks": [
        "Small caps carry elevated dilution, going-concern and liquidity risk; any signal can be wrong.",
        "This is a resemblance-to-past-winners measure, not a prediction and not advice.",
        "Not yet assessed: Adoption / traction."
      ]
    },
    {
      "symbol": "TCNO",
      "engine_version": "emerging-winner-engine-v1-shadow-live",
      "generated_at": "2026-07-29T00:00:00+00:00",
      "winner_similarity": 61.5,
      "probability": 0.6146,
      "ordinal_stage": 1,
      "stage_label": "interesting",
      "confidence": "low",
      "completeness": 0.3,
      "archetype": "Quantum Infrastructure",
      "archetype_confidence": "low",
      "market_cap": 540000000,
      "domain_composite": 63.6,
      "present_traits": [
        "Technical structure"
      ],
      "strongest_domains": [
        "Technical structure",
        "Volume / accumulation",
        "Liquidity / tradability"
      ],
      "weakest_domains": [
        "Liquidity / tradability",
        "Volume / accumulation",
        "Technical structure"
      ],
      "missing_domains": [
        "Theme strength - no theme-graph membership supplied (curated theme graph needs small-cap coverage)",
        "Business quality - no SEC EDGAR fundamentals pipeline yet",
        "Capital / survivability - no SEC EDGAR balance-sheet / dilution pipeline yet",
        "Government / policy - no USAspending / SAM.gov awards pipeline yet",
        "Adoption / traction - adoption/traction data not sourced (largely private/paywalled)",
        "Sponsorship / smart money - no SEC EDGAR Form 4 / 13F pipeline yet",
        "Narrative timing / attention - no market-regime or news-attention inputs supplied"
      ],
      "contributions": [
        {
          "domain": "technical",
          "label": "Technical structure",
          "contribution": 17.24662269589378
        },
        {
          "domain": "accumulation",
          "label": "Volume / accumulation",
          "contribution": 3.6232400621625573
        },
        {
          "domain": "liquidity",
          "label": "Liquidity / tradability",
          "contribution": -0.7449736497444965
        }
      ],
      "domains": [
        {
          "key": "technical",
          "label": "Technical structure",
          "score": 79.2,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "rsi_reset_band",
              "value": 41.0,
              "score": 92.5
            },
            {
              "name": "rsi_improving",
              "value": 1.8,
              "score": 80.0
            },
            {
              "name": "macd_turn",
              "value": 0.5,
              "score": 75.0
            },
            {
              "name": "trend_vs_sma200",
              "value": 1.01,
              "score": 53.3
            },
            {
              "name": "price_off_lows",
              "value": 11.0,
              "score": 95.0
            }
          ]
        },
        {
          "key": "accumulation",
          "label": "Volume / accumulation",
          "score": 57.4,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "volume_ratio",
              "value": 1.6,
              "score": 55.0
            },
            {
              "name": "rising_vol_up_day",
              "value": 47.06,
              "score": 47.1
            },
            {
              "name": "volume_state",
              "value": "high",
              "score": 70.0
            }
          ]
        },
        {
          "key": "liquidity",
          "label": "Liquidity / tradability",
          "score": 48.1,
          "coverage": "partial",
          "reason": "",
          "subsignals": [
            {
              "name": "avg_dollar_volume",
              "value": 7380000,
              "score": 13.0
            },
            {
              "name": "market_cap_band",
              "value": 540000000,
              "score": 83.2
            }
          ]
        },
        {
          "key": "theme",
          "label": "Theme strength",
          "score": null,
          "coverage": "unavailable",
          "reason": "no theme-graph membership supplied (curated theme graph needs small-cap coverage)",
          "subsignals": []
        },
        {
          "key": "business_quality",
          "label": "Business quality",
          "score": null,
          "coverage": "unavailable",
          "reason": "no SEC EDGAR fundamentals pipeline yet",
          "subsignals": []
        },
        {
          "key": "capital",
          "label": "Capital / survivability",
          "score": null,
          "coverage": "unavailable",
          "reason": "no SEC EDGAR balance-sheet / dilution pipeline yet",
          "subsignals": []
        },
        {
          "key": "government",
          "label": "Government / policy",
          "score": null,
          "coverage": "unavailable",
          "reason": "no USAspending / SAM.gov awards pipeline yet",
          "subsignals": []
        },
        {
          "key": "adoption",
          "label": "Adoption / traction",
          "score": null,
          "coverage": "unavailable",
          "reason": "adoption/traction data not sourced (largely private/paywalled)",
          "subsignals": []
        },
        {
          "key": "sponsorship",
          "label": "Sponsorship / smart money",
          "score": null,
          "coverage": "unavailable",
          "reason": "no SEC EDGAR Form 4 / 13F pipeline yet",
          "subsignals": []
        },
        {
          "key": "narrative",
          "label": "Narrative timing / attention",
          "score": null,
          "coverage": "unavailable",
          "reason": "no market-regime or news-attention inputs supplied",
          "subsignals": [
            {
              "name": "macro_regime_fit",
              "value": null,
              "score": null
            },
            {
              "name": "news_attention",
              "value": null,
              "score": null
            }
          ]
        }
      ],
      "analogues": {
        "nearest_winners": [
          {
            "name": "QuantumLight (ref)",
            "archetype": "Quantum Infrastructure",
            "era": "2020-2023",
            "label": "winner",
            "similarity": 91.0
          },
          {
            "name": "GovSecure Labs (ref)",
            "archetype": "Government-Backed Strategic Tech",
            "era": "2018-2021",
            "label": "winner",
            "similarity": 84.8
          },
          {
            "name": "OrbitWorks (ref)",
            "archetype": "Space / Defence Supplier",
            "era": "2017-2020",
            "label": "winner",
            "similarity": 81.2
          }
        ],
        "nearest_failures": [
          {
            "name": "Bitforge Tech (ref)",
            "archetype": "Speculative narrative",
            "era": "2015-2017",
            "label": "failure",
            "similarity": 63.2
          },
          {
            "name": "Quantum Ridge (ref)",
            "archetype": "Speculative narrative",
            "era": "2016-2018",
            "label": "failure",
            "similarity": 36.4
          },
          {
            "name": "Pinnacle Grid (ref)",
            "archetype": "Weak fundamentals",
            "era": "2017-2019",
            "label": "failure",
            "similarity": 25.1
          }
        ],
        "winner_similarity": 91.0,
        "failure_similarity": 63.2,
        "winner_failure_ratio": 1.44,
        "present_that_winners_had": [
          "Technical structure"
        ],
        "missing_vs_top_winner": [
          "Volume / accumulation"
        ],
        "provenance": "reference-v1 (shadow-live): cosine match over an illustrative reference seed, not a vector index over real historical snapshots. Case-based context, not advice."
      },
      "outcome_distribution": {
        "p_2x_24m": 0.292,
        "p_5x_36m": 0.112,
        "p_10x_60m": 0.039,
        "p_ruin": 0.21,
        "survivability": "medium-high",
        "expected_time_to_catalyst_months": 15,
        "expected_max_drawdown_pct": -41.0,
        "provenance": "reference-v1 (shadow-live): coarse distribution derived from the classifier probability and risk penalty; not a trained competing-risk model. Modelled estimate, not a promise."
      },
      "risk": {
        "verdict": "review",
        "penalty": 33.8,
        "blocked": false,
        "gates": [
          {
            "key": "survivability",
            "label": "Survivability",
            "verdict": "insufficient",
            "penalty": 20.0,
            "reasons": [
              "No balance-sheet data (SEC EDGAR pipeline not built) - survivability unproven."
            ]
          },
          {
            "key": "dilution",
            "label": "Dilution risk",
            "verdict": "insufficient",
            "penalty": 20.0,
            "reasons": [
              "No share-count / financing history - dilution risk unproven."
            ]
          },
          {
            "key": "manipulation",
            "label": "Manipulation / hype",
            "verdict": "insufficient",
            "penalty": 15.0,
            "reasons": [
              "No float / social / promotion data - manipulation risk unproven."
            ]
          },
          {
            "key": "liquidity",
            "label": "Liquidity / execution",
            "verdict": "pass",
            "penalty": 5.0,
            "reasons": [
              "Adequate executable liquidity."
            ]
          },
          {
            "key": "downside",
            "label": "Downside / failure",
            "verdict": "insufficient",
            "penalty": 15.0,
            "reasons": [
              "No drawdown / legal data - tail risk unproven."
            ]
          }
        ]
      },
      "priority_score": 35.7,
      "action": "watchlist_candidate",
      "ranking_signals": {
        "winner_score": 61.46313121657884,
        "model_confidence_pct": 40.0,
        "risk_penalty": 33.75,
        "catalyst_freshness": 50.0,
        "portfolio_relevance": 50.0
      },
      "surfaced": true,
      "timing_state": "confirmation building",
      "timing": {
        "timing_state": "confirmation building",
        "timing_score": 74.5,
        "catalyst_window": "near (evidence compounding now)",
        "network_state": "not assessed (graph model is a Production v3 challenger)",
        "network_score": null,
        "network_notes": [],
        "challenger_note": "Model 6 runs as a shadow challenger: it annotates timing and network context only, and contributes nothing to priority or risk until it earns promotion (Production v2/v3).",
        "provenance": "timing-network-reference-v1 (shadow-live): deterministic reference read of temporal momentum and network connectivity; not a trained temporal or graph model."
      },
      "risks": [
        "Under-assessed: only 3 of 10 domains have data - several signal pipelines are not built yet, so this score is preliminary.",
        "Small caps carry elevated dilution, going-concern and liquidity risk; any signal can be wrong.",
        "This is a resemblance-to-past-winners measure, not a prediction and not advice.",
        "Not yet assessed: Theme strength, Business quality, Capital / survivability, Government / policy, Adoption / traction, Sponsorship / smart money, Narrative timing / attention."
      ]
    },
    {
      "symbol": "HYPE",
      "engine_version": "emerging-winner-engine-v1-shadow-live",
      "generated_at": "2026-07-29T00:00:00+00:00",
      "winner_similarity": 42.3,
      "probability": 0.4232,
      "ordinal_stage": 1,
      "stage_label": "interesting",
      "confidence": "medium",
      "completeness": 0.6,
      "archetype": "Quantum Infrastructure",
      "archetype_confidence": "medium",
      "market_cap": 90000000,
      "domain_composite": 50.7,
      "present_traits": [
        "Volume / accumulation",
        "Narrative timing / attention"
      ],
      "strongest_domains": [
        "Volume / accumulation",
        "Narrative timing / attention",
        "Technical structure",
        "Theme strength"
      ],
      "weakest_domains": [
        "Liquidity / tradability",
        "Capital / survivability",
        "Theme strength"
      ],
      "missing_domains": [
        "Business quality - no SEC EDGAR fundamentals pipeline yet",
        "Government / policy - no USAspending / SAM.gov awards pipeline yet",
        "Adoption / traction - adoption/traction data not sourced (largely private/paywalled)",
        "Sponsorship / smart money - no SEC EDGAR Form 4 / 13F pipeline yet"
      ],
      "contributions": [
        {
          "domain": "accumulation",
          "label": "Volume / accumulation",
          "contribution": 8.847762302399843
        },
        {
          "domain": "capital",
          "label": "Capital / survivability",
          "contribution": -5.714179820299898
        },
        {
          "domain": "liquidity",
          "label": "Liquidity / tradability",
          "contribution": -4.671618495667118
        },
        {
          "domain": "narrative",
          "label": "Narrative timing / attention",
          "contribution": 2.3962689568999562
        },
        {
          "domain": "technical",
          "label": "Technical structure",
          "contribution": 0.3185194428863951
        },
        {
          "domain": "theme",
          "label": "Theme strength",
          "contribution": -0.19661694005333294
        }
      ],
      "domains": [
        {
          "key": "technical",
          "label": "Technical structure",
          "score": 51.2,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "rsi_reset_band",
              "value": 63.0,
              "score": 0.0
            },
            {
              "name": "rsi_improving",
              "value": 3.0,
              "score": 100.0
            },
            {
              "name": "macd_turn",
              "value": 0.2,
              "score": 56.0
            },
            {
              "name": "trend_vs_sma200",
              "value": 1.2,
              "score": 100.0
            },
            {
              "name": "price_off_lows",
              "value": 40.0,
              "score": 0.0
            }
          ]
        },
        {
          "key": "accumulation",
          "label": "Volume / accumulation",
          "score": 90.0,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "volume_ratio",
              "value": 3.4,
              "score": 100.0
            },
            {
              "name": "rising_vol_up_day",
              "value": 100.0,
              "score": 100.0
            },
            {
              "name": "volume_state",
              "value": "high",
              "score": 70.0
            }
          ]
        },
        {
          "key": "liquidity",
          "label": "Liquidity / tradability",
          "score": 23.6,
          "coverage": "partial",
          "reason": "",
          "subsignals": [
            {
              "name": "avg_dollar_volume",
              "value": 189000,
              "score": 0.0
            },
            {
              "name": "market_cap_band",
              "value": 90000000,
              "score": 47.2
            }
          ]
        },
        {
          "key": "theme",
          "label": "Theme strength",
          "score": 49.4,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "hot_theme_exposure",
              "value": 1,
              "score": 33.3
            },
            {
              "name": "supply_chain_centrality",
              "value": 0.2,
              "score": 20.0
            },
            {
              "name": "mention_velocity",
              "value": 0.95,
              "score": 95.0
            }
          ]
        },
        {
          "key": "business_quality",
          "label": "Business quality",
          "score": null,
          "coverage": "unavailable",
          "reason": "no SEC EDGAR fundamentals pipeline yet",
          "subsignals": []
        },
        {
          "key": "capital",
          "label": "Capital / survivability",
          "score": 24.2,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "cash_runway_quarters",
              "value": 1.0,
              "score": 12.5
            },
            {
              "name": "low_dilution",
              "value": 35.0,
              "score": 0.0
            },
            {
              "name": "balance_sheet_resilience",
              "value": 1.2,
              "score": 60.0
            }
          ]
        },
        {
          "key": "government",
          "label": "Government / policy",
          "score": null,
          "coverage": "unavailable",
          "reason": "no USAspending / SAM.gov awards pipeline yet",
          "subsignals": []
        },
        {
          "key": "adoption",
          "label": "Adoption / traction",
          "score": null,
          "coverage": "unavailable",
          "reason": "adoption/traction data not sourced (largely private/paywalled)",
          "subsignals": []
        },
        {
          "key": "sponsorship",
          "label": "Sponsorship / smart money",
          "score": null,
          "coverage": "unavailable",
          "reason": "no SEC EDGAR Form 4 / 13F pipeline yet",
          "subsignals": []
        },
        {
          "key": "narrative",
          "label": "Narrative timing / attention",
          "score": 60.8,
          "coverage": "full",
          "reason": "",
          "subsignals": [
            {
              "name": "macro_regime_fit",
              "value": "risk_on",
              "score": 80.0
            },
            {
              "name": "news_attention",
              "value": 0.95,
              "score": 41.7
            }
          ]
        }
      ],
      "analogues": {
        "nearest_winners": [
          {
            "name": "Reforge Metals (ref)",
            "archetype": "Turnaround",
            "era": "2015-2018",
            "label": "winner",
            "similarity": 28.6
          },
          {
            "name": "RoboCore Systems (ref)",
            "archetype": "Robotics Platform",
            "era": "2019-2022",
            "label": "winner",
            "similarity": 11.8
          },
          {
            "name": "QuantumLight (ref)",
            "archetype": "Quantum Infrastructure",
            "era": "2020-2023",
            "label": "winner",
            "similarity": 9.2
          }
        ],
        "nearest_failures": [
          {
            "name": "Bitforge Tech (ref)",
            "archetype": "Speculative narrative",
            "era": "2015-2017",
            "label": "failure",
            "similarity": 72.6
          },
          {
            "name": "Quantum Ridge (ref)",
            "archetype": "Speculative narrative",
            "era": "2016-2018",
            "label": "failure",
            "similarity": 59.7
          },
          {
            "name": "Pinnacle Grid (ref)",
            "archetype": "Weak fundamentals",
            "era": "2017-2019",
            "label": "failure",
            "similarity": 59.6
          }
        ],
        "winner_similarity": 28.6,
        "failure_similarity": 72.6,
        "winner_failure_ratio": 0.39,
        "present_that_winners_had": [
          "Volume / accumulation"
        ],
        "missing_vs_top_winner": [
          "Technical structure",
          "Liquidity / tradability"
        ],
        "provenance": "reference-v1 (shadow-live): cosine match over an illustrative reference seed, not a vector index over real historical snapshots. Case-based context, not advice."
      },
      "outcome_distribution": {
        "p_2x_24m": 0.14,
        "p_5x_36m": 0.047,
        "p_10x_60m": 0.014,
        "p_ruin": 0.637,
        "survivability": "low",
        "expected_time_to_catalyst_months": 21,
        "expected_max_drawdown_pct": -73.7,
        "provenance": "reference-v1 (shadow-live): coarse distribution derived from the classifier probability and risk penalty; not a trained competing-risk model. Modelled estimate, not a promise."
      },
      "risk": {
        "verdict": "block",
        "penalty": 100.0,
        "blocked": true,
        "gates": [
          {
            "key": "survivability",
            "label": "Survivability",
            "verdict": "block",
            "penalty": 80.0,
            "reasons": [
              "Cash runway ~1.0 quarters - acute going-concern risk."
            ]
          },
          {
            "key": "dilution",
            "label": "Dilution risk",
            "verdict": "block",
            "penalty": 70.0,
            "reasons": [
              "Shares outstanding +35.0% yoy - destructive dilution."
            ]
          },
          {
            "key": "manipulation",
            "label": "Manipulation / hype",
            "verdict": "review",
            "penalty": 45.0,
            "reasons": [
              "Very high mention velocity - attention may be engineered, not organic.",
              "Manic news attention - treat as hype until confirmed by fundamentals.",
              "Very low float - outsized manipulation sensitivity."
            ]
          },
          {
            "key": "liquidity",
            "label": "Liquidity / execution",
            "verdict": "block",
            "penalty": 70.0,
            "reasons": [
              "Avg $ volume ~$189,000/day - not executable without ruinous slippage."
            ]
          },
          {
            "key": "downside",
            "label": "Downside / failure",
            "verdict": "insufficient",
            "penalty": 15.0,
            "reasons": [
              "No drawdown / legal data - tail risk unproven."
            ]
          }
        ]
      },
      "priority_score": 0.0,
      "action": "needs_review",
      "ranking_signals": {
        "winner_score": 42.31837755443284,
        "model_confidence_pct": 70.0,
        "risk_penalty": 100.0,
        "catalyst_freshness": 95.0,
        "portfolio_relevance": 50.0
      },
      "surfaced": false,
      "timing_state": "crowded - attention ahead of evidence",
      "timing": {
        "timing_state": "crowded - attention ahead of evidence",
        "timing_score": 68.5,
        "catalyst_window": "attention peak likely behind or upon us - timing edge gone",
        "network_state": "partially connected",
        "network_score": 46.0,
        "network_notes": [
          "Peripheral to its theme's supply chain."
        ],
        "challenger_note": "Model 6 runs as a shadow challenger: it annotates timing and network context only, and contributes nothing to priority or risk until it earns promotion (Production v2/v3).",
        "provenance": "timing-network-reference-v1 (shadow-live): deterministic reference read of temporal momentum and network connectivity; not a trained temporal or graph model."
      },
      "risks": [
        "BLOCKED by a risk gate - excluded from the research queue until the flag clears.",
        "Small caps carry elevated dilution, going-concern and liquidity risk; any signal can be wrong.",
        "This is a resemblance-to-past-winners measure, not a prediction and not advice.",
        "Not yet assessed: Business quality, Government / policy, Adoption / traction, Sponsorship / smart money.",
        "Cash runway ~1.0 quarters - acute going-concern risk.",
        "Shares outstanding +35.0% yoy - destructive dilution.",
        "Very high mention velocity - attention may be engineered, not organic.",
        "Manic news attention - treat as hype until confirmed by fundamentals.",
        "Very low float - outsized manipulation sensitivity.",
        "Avg $ volume ~$189,000/day - not executable without ruinous slippage.",
        "Resembles historical FAILURES at least as much as winners (failure similarity 73 vs winner 29).",
        "Modelled P(-80% / delisting) ~64% - material ruin risk.",
        "Timing read: attention is ahead of evidence - the crowd likely arrived first."
      ]
    }
  ],
  "generated_at": "2026-07-29T00:00:00+00:00",
  "engine_version": "emerging-winner-engine-v1-shadow-live",
  "demo": true,
  "note": "Illustrative demo output generated by the real engine over the illustrative candidate set. Not live market data."
};
