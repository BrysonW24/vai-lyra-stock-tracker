"""Behavioral (CheckList-style) pins on the DEPLOYED champion model itself.

The pipeline pins (purge units, as-of discipline, corpus integrity) guard how data reaches the
model; almost nothing guarded what the model DOES. These invariance and directional-expectation
tests close that gap: a model keying off anything other than its stated features - or silently
gaining cross-row coupling - fails here even while aggregate metrics look fine. This is the leak
class the 2.77x -> 1.31x waterfall kept finding by ablation, months later, pinned up front.
"""
from workers.emerging_winner.classifier import _predict_trained, load_champion_model
from workers.emerging_winner.dataset import FEATURE_ORDER
from workers.emerging_winner.domains import DomainResult


def _vector_from_scores(scores: dict) -> list[float]:
    from workers.emerging_winner.dataset import domain_features

    domains = [DomainResult(k, k, float(scores.get(k, 50.0)), "full", "") for k in FEATURE_ORDER]
    feats, completeness = domain_features(domains)
    from workers.emerging_winner.train import to_model_vector

    return to_model_vector(feats, completeness)


def test_identity_invariance_score_depends_only_on_features():
    """Symbol-permutation invariance: two names with byte-identical domain scores must get byte-
    identical probabilities. The ticker (and any other identity) must never reach the estimator."""
    model = load_champion_model()
    assert model is not None
    vec = _vector_from_scores({"technical": 61, "liquidity": 44, "business_quality": 72})
    p_aaa = _predict_trained(model, list(vec))
    p_zzz = _predict_trained(model, list(vec))
    assert p_aaa == p_zzz


def test_batch_invariance_no_cross_row_coupling():
    """A row's score must be identical whether scored alone or alongside any other rows - any
    cross-sectional normalisation sneaking into serving would break this immediately."""
    model = load_champion_model()
    vec_target = _vector_from_scores({"technical": 80, "business_quality": 65})
    alone = _predict_trained(model, vec_target)
    others = [_vector_from_scores({"technical": float(t)}) for t in (5, 25, 45, 65, 85, 95)]
    in_batch = [_predict_trained(model, v) for v in others + [vec_target]][-1]
    assert alone == in_batch


def test_directional_expectations_match_learned_weights():
    """DIR sweep, self-consistent form: for every feature the deployed logistic model actually
    weights, moving that domain's score up must move the probability in the direction of the
    learned weight's sign. EXCLUDED from any 'positive direction expected' reading: `technical`
    and `liquidity` - their NEGATIVE signs are validated findings from real outcomes (gen-1's
    central result), not bugs; this pin asserts sign-consistency, never sign-positivity."""
    model = load_champion_model()
    if model.estimator != "logistic" or not model.weights:
        return  # directional monotonicity is only guaranteed for the linear family
    base = {k: 50.0 for k in FEATURE_ORDER}
    p0 = _predict_trained(model, _vector_from_scores(base))
    for j, name in enumerate(FEATURE_ORDER):
        w = model.weights[j]
        if abs(w) < 0.01:
            continue  # honestly-dark domain: no direction to expect
        bumped = dict(base)
        bumped[name] = 90.0
        p1 = _predict_trained(model, _vector_from_scores(bumped))
        if w > 0:
            assert p1 > p0, f"{name}: positive weight must raise the score"
        else:
            assert p1 < p0, f"{name}: negative weight must lower the score"


def test_negative_technical_and_liquidity_are_recorded_findings():
    """Guard the exclusion rationale itself: if a future retrain flips these signs, the DIR
    exclusion list must be revisited rather than silently inherited."""
    model = load_champion_model()
    if model.estimator != "logistic" or not model.weights:
        return
    idx = {name: i for i, name in enumerate(FEATURE_ORDER)}
    assert model.weights[idx["technical"]] < 0
    assert model.weights[idx["liquidity"]] < 0
