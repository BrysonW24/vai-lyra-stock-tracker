"""
Reference analogue profiles for the Historical Analogue Model (Model 3).

HONESTY: these are ILLUSTRATIVE REFERENCE PROFILES, not real companies and not real point-in-time
snapshots. They exist so the analogue-retrieval interface (nearest winners / nearest failures) runs
end-to-end in shadow-live today. The real deployment (deck 4/7) is a vector index over REAL historical
company snapshots six months before their rerating - that dataset is Phase 1 and replaces this seed
wholesale, with no change to analogue.py. Names are fictional and archetype-descriptive by design.

Each profile carries a 10-domain vector on the same 0-100 scale as the live domain engine, in the
canonical domain order (technical, accumulation, liquidity, theme, business_quality, capital,
government, adoption, sponsorship, narrative).
"""
from __future__ import annotations

# label: "winner" (became an outsized winner) or "failure" (looked promising, then failed)
REFERENCE_ANALOGUES: list[dict] = [
    # ---- winners ----
    {"name": "AlphaWave (ref)", "archetype": "AI Infrastructure Enabler", "era": "2016-2019", "label": "winner",
     "vector": {"technical": 78, "accumulation": 74, "liquidity": 70, "theme": 88, "business_quality": 72,
                "capital": 68, "government": 40, "adoption": 80, "sponsorship": 76, "narrative": 66}},
    {"name": "GovSecure Labs (ref)", "archetype": "Government-Backed Strategic Tech", "era": "2018-2021", "label": "winner",
     "vector": {"technical": 70, "accumulation": 66, "liquidity": 58, "theme": 82, "business_quality": 64,
                "capital": 70, "government": 90, "adoption": 60, "sponsorship": 72, "narrative": 62}},
    {"name": "QuantumLight (ref)", "archetype": "Quantum Infrastructure", "era": "2020-2023", "label": "winner",
     "vector": {"technical": 66, "accumulation": 62, "liquidity": 52, "theme": 90, "business_quality": 55,
                "capital": 66, "government": 78, "adoption": 48, "sponsorship": 70, "narrative": 74}},
    {"name": "RoboCore Systems (ref)", "archetype": "Robotics Platform", "era": "2019-2022", "label": "winner",
     "vector": {"technical": 74, "accumulation": 72, "liquidity": 64, "theme": 80, "business_quality": 70,
                "capital": 62, "government": 45, "adoption": 78, "sponsorship": 66, "narrative": 60}},
    {"name": "OrbitWorks (ref)", "archetype": "Space / Defence Supplier", "era": "2017-2020", "label": "winner",
     "vector": {"technical": 68, "accumulation": 64, "liquidity": 60, "theme": 78, "business_quality": 66,
                "capital": 64, "government": 84, "adoption": 62, "sponsorship": 74, "narrative": 58}},
    {"name": "Veridian Labs (ref)", "archetype": "AI Infrastructure Enabler", "era": "2017-2020", "label": "winner",
     "vector": {"technical": 72, "accumulation": 70, "liquidity": 66, "theme": 84, "business_quality": 74,
                "capital": 72, "government": 38, "adoption": 76, "sponsorship": 70, "narrative": 64}},
    {"name": "Reforge Metals (ref)", "archetype": "Turnaround", "era": "2015-2018", "label": "winner",
     "vector": {"technical": 76, "accumulation": 78, "liquidity": 62, "theme": 50, "business_quality": 60,
                "capital": 58, "government": 40, "adoption": 55, "sponsorship": 60, "narrative": 52}},

    # ---- failures (looked promising, then failed / diluted / faded) ----
    {"name": "Bitforge Tech (ref)", "archetype": "Speculative narrative", "era": "2015-2017", "label": "failure",
     "vector": {"technical": 62, "accumulation": 68, "liquidity": 34, "theme": 72, "business_quality": 30,
                "capital": 22, "government": 20, "adoption": 28, "sponsorship": 24, "narrative": 82}},
    {"name": "Quantum Ridge (ref)", "archetype": "Speculative narrative", "era": "2016-2018", "label": "failure",
     "vector": {"technical": 55, "accumulation": 58, "liquidity": 30, "theme": 80, "business_quality": 26,
                "capital": 20, "government": 18, "adoption": 22, "sponsorship": 20, "narrative": 88}},
    {"name": "Hyperion Data (ref)", "archetype": "Speculative narrative", "era": "2014-2016", "label": "failure",
     "vector": {"technical": 48, "accumulation": 44, "liquidity": 28, "theme": 60, "business_quality": 24,
                "capital": 18, "government": 15, "adoption": 20, "sponsorship": 18, "narrative": 70}},
    {"name": "Cascade Bio (ref)", "archetype": "Dilution death-spiral", "era": "2018-2020", "label": "failure",
     "vector": {"technical": 40, "accumulation": 38, "liquidity": 26, "theme": 55, "business_quality": 28,
                "capital": 12, "government": 22, "adoption": 30, "sponsorship": 26, "narrative": 58}},
    {"name": "Pinnacle Grid (ref)", "archetype": "Weak fundamentals", "era": "2017-2019", "label": "failure",
     "vector": {"technical": 52, "accumulation": 50, "liquidity": 40, "theme": 45, "business_quality": 32,
                "capital": 30, "government": 25, "adoption": 34, "sponsorship": 30, "narrative": 48}},
]

DOMAIN_ORDER = [
    "technical", "accumulation", "liquidity", "theme", "business_quality",
    "capital", "government", "adoption", "sponsorship", "narrative",
]
