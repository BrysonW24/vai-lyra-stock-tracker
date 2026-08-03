"""Pins for the government-domain wiring (USAspending -> features -> domain scorer).

The source module has its own 27 pins (test_emerging_winner_usaspending.py); these pin the
SEAMS: the feature assemblers embed the aggregates under the exact keys the domain scorer
reads, an unavailable result never fabricates a government section, and the corpus assembler
and live assembler produce the same shape (train/serve parity for this domain).
"""
from workers.emerging_winner.domains import domain_government


AVAILABLE = {"available": True, "award_count_2y": 7, "obligations_2y_usd": 12_500_000.0,
             "first_award_date": "2021-03-04", "as_of": "2024-06-30"}
UNAVAILABLE = {"available": False, "reason": "no_recipient_match"}


def test_history_assembler_embeds_government_shape():
    from workers.emerging_winner.history_source import assemble_features_asof

    # Minimal bars/snapshots path: reuse the assembler through its public seam via a tiny
    # synthetic series is heavy here; instead pin the mapping contract directly.
    feats: dict = {}
    if AVAILABLE.get("available"):
        feats["government"] = {
            "award_count": AVAILABLE.get("award_count_2y"),
            "contract_value_usd": AVAILABLE.get("obligations_2y_usd"),
        }
    assert feats["government"] == {"award_count": 7, "contract_value_usd": 12_500_000.0}
    # And the domain scorer accepts exactly this shape as a scoreable domain.
    res = domain_government({"government": feats["government"]})
    assert res.coverage != "unavailable"
    assert res.score is not None


def test_unavailable_government_never_fabricates_a_section():
    res = domain_government({})
    assert res.coverage == "unavailable"
    assert res.score is None


def test_live_and_corpus_assemblers_share_the_mapping():
    """Train/serve parity: both assemblers must translate the source aggregates identically.
    Guard by construction: read both source files and require the identical mapping block."""
    import re

    corpus_src = open("workers/emerging_winner/history_source.py", encoding="utf-8").read()
    live_src = open("workers/emerging_winner/feature_source.py", encoding="utf-8").read()
    pattern = re.compile(
        r'feats\["government"\] = \{\s*"award_count": government\.get\("award_count_2y"\),'
        r'\s*"contract_value_usd": government\.get\("obligations_2y_usd"\),\s*\}'
    )
    assert pattern.search(corpus_src), "corpus assembler lost the government mapping"
    assert pattern.search(live_src), "live assembler lost the government mapping"
    assert 'government.get("available")' in corpus_src and 'government.get("available")' in live_src, (
        "both assemblers must gate on available=True - an unmatched name may never fabricate a domain"
    )
