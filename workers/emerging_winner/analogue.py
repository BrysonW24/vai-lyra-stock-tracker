"""
Model 3 - the Historical Analogue Model (deck 4/7; spec models 7-8, 245-297).

"This stock's current 10-domain pattern is most similar to five historical companies six months before
their major rerating." Retrieves the nearest historical winners and the nearest historical failures by
cosine similarity over the domain vector (only the domains actually assessed for the candidate are
compared), and reports the winner-vs-failure similarity ratio plus what is present-now-that-was-present
and what is missing versus the closest winner.

Deployment target (deck 4/7) is a vector / embedding index over real historical snapshots; v1 runs the
same interface over the illustrative REFERENCE_ANALOGUES seed. Case-based reasoning, human-readable.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .domains import DomainResult
from .reference_data import DOMAIN_ORDER, REFERENCE_ANALOGUES

PRESENT_THRESHOLD = 60.0


@dataclass
class AnalogueMatch:
    name: str
    archetype: str
    era: str
    label: str          # winner / failure
    similarity: float   # 0-100

    def to_dict(self) -> dict:
        return {"name": self.name, "archetype": self.archetype, "era": self.era,
                "label": self.label, "similarity": round(self.similarity, 1)}


@dataclass
class AnalogueResult:
    nearest_winners: list[AnalogueMatch]
    nearest_failures: list[AnalogueMatch]
    winner_similarity: float          # 0-100, best winner match
    failure_similarity: float         # 0-100, best failure match
    winner_failure_ratio: float       # winner_similarity / max(failure_similarity, eps)
    present_that_winners_had: list[str]
    missing_vs_top_winner: list[str]
    provenance: str = (
        "reference-v1 (shadow-live): cosine match over an illustrative reference seed, not a vector "
        "index over real historical snapshots. Case-based context, not advice."
    )

    def to_dict(self) -> dict:
        return {
            "nearest_winners": [m.to_dict() for m in self.nearest_winners],
            "nearest_failures": [m.to_dict() for m in self.nearest_failures],
            "winner_similarity": round(self.winner_similarity, 1),
            "failure_similarity": round(self.failure_similarity, 1),
            "winner_failure_ratio": round(self.winner_failure_ratio, 2),
            "present_that_winners_had": self.present_that_winners_had,
            "missing_vs_top_winner": self.missing_vs_top_winner,
            "provenance": self.provenance,
        }


def _cosine(a: dict[str, float], b: dict[str, float], keys: list[str]) -> float:
    """Pattern similarity, mapped to 0-100. Vectors are CENTRED on the domain midpoint (50) before the
    cosine so that "strong here / weak there" patterns are compared, not raw magnitude - otherwise
    everything with high scores looks ~identical. This is a Pearson-style shape match; the trained
    metric-learning / embedding model (spec model 8, Production v2) replaces it. Result clamped to 0-100
    so an anti-correlated (negative-cosine) profile reads as low similarity, not a negative number."""
    av = [a[k] - 50.0 for k in keys]
    bv = [b[k] - 50.0 for k in keys]
    dot = sum(x * y for x, y in zip(av, bv))
    na = math.sqrt(sum(x * x for x in av))
    nb = math.sqrt(sum(y * y for y in bv))
    if na == 0 or nb == 0:
        return 0.5  # a neutral (all-midpoint) profile is uninformative, not a strong match
    return max(0.0, dot / (na * nb))


def find_analogues(domains: list[DomainResult], top_k: int = 3) -> AnalogueResult:
    scores = {d.key: d.score for d in domains if d.score is not None}
    # Compare only over the domains we actually assessed for this candidate.
    keys = [k for k in DOMAIN_ORDER if k in scores]

    matches: list[AnalogueMatch] = []
    if keys:
        for ref in REFERENCE_ANALOGUES:
            sim = _cosine(scores, ref["vector"], keys) * 100.0
            matches.append(AnalogueMatch(ref["name"], ref["archetype"], ref["era"], ref["label"], sim))

    winners = sorted((m for m in matches if m.label == "winner"), key=lambda m: m.similarity, reverse=True)
    failures = sorted((m for m in matches if m.label == "failure"), key=lambda m: m.similarity, reverse=True)

    winner_sim = winners[0].similarity if winners else 0.0
    failure_sim = failures[0].similarity if failures else 0.0
    ratio = winner_sim / failure_sim if failure_sim > 1e-6 else (winner_sim / 1.0 if winner_sim else 0.0)

    present, missing = [], []
    if winners:
        top = next(r for r in REFERENCE_ANALOGUES if r["name"] == winners[0].name)
        for k in keys:
            label = next(d.label for d in domains if d.key == k)
            cand = scores[k]
            ref_v = top["vector"][k]
            if cand >= PRESENT_THRESHOLD and ref_v >= PRESENT_THRESHOLD:
                present.append(label)
            elif ref_v >= PRESENT_THRESHOLD and cand < PRESENT_THRESHOLD:
                missing.append(label)

    return AnalogueResult(
        nearest_winners=winners[:top_k],
        nearest_failures=failures[:top_k],
        winner_similarity=winner_sim,
        failure_similarity=failure_sim,
        winner_failure_ratio=ratio,
        present_that_winners_had=present,
        missing_vs_top_winner=missing,
    )
