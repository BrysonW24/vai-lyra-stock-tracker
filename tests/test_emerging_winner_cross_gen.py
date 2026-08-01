"""Pins for the cross-generation paired test (versus-scores).

Gen-1 vs gen-2 could only ever be compared marginally because gen-1 never archived per-row
scores. Archiving started at gen-2 exactly so the NEXT comparison can be paired. These pins
guarantee the aligner's honesty properties before gen-3 relies on it:
  * rows align on (symbol, entry-date); one-sided rows are dropped AND counted,
  * label disagreements between archives are excluded, counted, and above 0.5% they
    invalidate the whole comparison (a changed label definition kills paired claims),
  * identical scores yield a zero delta; a consistent improvement yields a CI excluding zero.
"""
import json

from workers.emerging_winner.backtest import cross_generation_paired


def _write_archive(path, rows, sha="aaaa1111"):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"_meta": {"corpus_sha256": sha}}) + "\n")
        for r in rows:
            fh.write(json.dumps(r) + "\n")
    return str(path)


def _rows(n_symbols=80, bump_winners=0.0, label_flip_keys=(), extra=()):
    rows = []
    for s in range(n_symbols):
        for q, t in enumerate(["2024-03-01", "2024-06-01", "2024-09-01"]):
            y = 1 if (s * 3 + q) % 7 == 0 else 0
            key = (f"S{s}", t)
            if key in label_flip_keys:
                y = 1 - y
            p = 0.1 + ((s * 13 + q * 5) % 40) / 200.0 + (bump_winners if y else 0.0)
            rows.append({"symbol": key[0], "t": t, "y": y, "p_champion": round(p, 6)})
    rows.extend(extra)
    return rows


def test_identical_archives_give_zero_delta(tmp_path):
    a = _write_archive(tmp_path / "a.jsonl", _rows(), sha="gen2sha")
    b = _write_archive(tmp_path / "b.jsonl", _rows(), sha="gen3sha")
    rep = cross_generation_paired(a, b)
    assert rep["valid"] and rep["n_label_mismatch_excluded"] == 0
    assert rep["archive_a"]["corpus_sha256"] == "gen2sha"
    assert rep["paired_delta_b_minus_a"]["point_delta_lift_at_k"] == 0.0
    assert rep["paired_delta_b_minus_a"]["lift_at_k"]["ci_excludes_zero"] is False


def test_consistent_improvement_is_detected(tmp_path):
    a = _write_archive(tmp_path / "a.jsonl", _rows())
    b = _write_archive(tmp_path / "b.jsonl", _rows(bump_winners=0.05))
    rep = cross_generation_paired(a, b)
    d = rep["paired_delta_b_minus_a"]["lift_at_k"]
    assert d["ci_excludes_zero"] is True and d["p05"] > 0


def test_one_sided_rows_are_dropped_and_counted(tmp_path):
    extra = [{"symbol": "ONLYB", "t": "2024-03-01", "y": 0, "p_champion": 0.2}]
    a = _write_archive(tmp_path / "a.jsonl", _rows())
    b = _write_archive(tmp_path / "b.jsonl", _rows(extra=extra))
    rep = cross_generation_paired(a, b)
    assert rep["n_only_b"] == 1 and rep["n_only_a"] == 0
    assert rep["n_aligned"] == 240


def test_label_mismatch_beyond_threshold_invalidates(tmp_path):
    flips = tuple((f"S{s}", "2024-03-01") for s in range(10))  # 10/240 > 0.5%
    a = _write_archive(tmp_path / "a.jsonl", _rows())
    b = _write_archive(tmp_path / "b.jsonl", _rows(label_flip_keys=flips))
    rep = cross_generation_paired(a, b)
    assert rep["n_label_mismatch_excluded"] == 10
    assert rep["valid"] is False, "a changed label definition must invalidate the paired claim"
