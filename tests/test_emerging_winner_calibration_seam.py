"""Pins for the artifact-carried probability-calibration seam.

Motivation (gen-2 finding): the champion's recalibration slope is 0.755 CI90 [0.57, 0.98] - the
spread is mildly overconfident even though level and binned means are clean. The fix candidate is
a logit-linear correction carried BY the artifact and applied at serve. These pins guarantee the
seam's safety properties so the gen-3 evaluation is purely a data decision:
  * absent block = byte-identical behaviour for every existing artifact (backwards compatibility),
  * a malformed block refuses to load rather than silently serving raw probabilities,
  * the correction is monotone - rankings (and therefore every lift/precision metric) untouched,
  * a slope below 1 shrinks the spread toward the base rate, which is the finding's direction.
"""
import json
import math

from workers.emerging_winner.classifier import _predict_trained, _read_model, load_champion_model


def _write_artifact(tmp_path, calibration=None):
    src = load_champion_model()
    assert src is not None and src.estimator == "logistic"
    data = {
        "featureOrder": src.feature_order, "modelVersion": "cal-seam-test",
        "mean": src.mean, "std": src.std, "weights": src.weights, "bias": src.bias,
        "dataset": {"source": "test"}, "provenance": "test",
    }
    if calibration is not None:
        data["probabilityCalibration"] = calibration
    path = tmp_path / "artifact.json"
    path.write_text(json.dumps(data))
    return str(path)


def test_absent_block_is_byte_identical_to_legacy(tmp_path):
    plain = _read_model(_write_artifact(tmp_path))
    assert plain is not None and plain.calibration is None
    champion = load_champion_model()
    vec = [0.3] * len(champion.mean)
    assert _predict_trained(plain, vec) == _predict_trained(champion, vec)


def test_malformed_calibration_refuses_to_load(tmp_path):
    for bad in ({"type": "logit_linear", "slope": 0.0, "intercept": 0.0},
                {"type": "logit_linear", "slope": -1.0, "intercept": 0.0},
                {"type": "platt", "slope": 1.0, "intercept": 0.0},
                {"type": "logit_linear", "slope": "x", "intercept": 0.0},
                {"type": "logit_linear"}):
        assert _read_model(_write_artifact(tmp_path, bad)) is None, f"must refuse {bad}"


def test_identity_parameters_change_nothing(tmp_path):
    ident = _read_model(_write_artifact(tmp_path, {"type": "logit_linear", "slope": 1.0, "intercept": 0.0}))
    plain = _read_model(_write_artifact(tmp_path))
    vec = [0.2] * len(ident.mean)
    assert abs(_predict_trained(ident, vec) - _predict_trained(plain, vec)) < 1e-12


def test_slope_correction_is_monotone_and_shrinks_spread(tmp_path):
    """Rankings must be untouched (monotone), and slope<1 must pull extremes toward the middle -
    the exact geometry the 0.755 finding calls for."""
    cal = _read_model(_write_artifact(tmp_path, {"type": "logit_linear", "slope": 0.755, "intercept": 0.0}))
    plain = _read_model(_write_artifact(tmp_path))
    vecs = [[v] * len(cal.mean) for v in (-0.5, -0.25, 0.0, 0.25, 0.5)]
    raw = [_predict_trained(plain, v) for v in vecs]
    adj = [_predict_trained(cal, v) for v in vecs]
    assert sorted(range(5), key=lambda i: raw[i]) == sorted(range(5), key=lambda i: adj[i])
    # spread shrinks in logit space
    lg = lambda p: math.log(p / (1 - p))
    assert (lg(max(adj)) - lg(min(adj))) < (lg(max(raw)) - lg(min(raw)))
