"""
Real-history backtest for the Emerging Winner model family - the first genuine "does it predict
success?" eval, run on OLD data with MATURED outcomes instead of waiting 12 months for the ledger.

What it does, end to end:

  build    Assemble a point-in-time corpus over the real (current) SEC universe: for each sampled
           symbol and each quarterly score date T in [2016 .. last matured quarter], compute the exact
           live feature dict as-of T (history_source: causal indicators + EDGAR facts filed <= T) and
           the first-touch 12-month outcome from the forward path. Rows are written as JSONL shaped
           like matured ledger rows, so the whole existing lifecycle runs on them unchanged.
  eval     Score every corpus row with (a) the deterministic reference scorecard and (b) the deployed
           champion artifact, and report the rare-positive family - PR-AUC, per-cohort precision@k,
           lift, adaptive ECE - overall and per cap-tier slice. Both models are fully out-of-sample on
           this corpus by construction (neither ever saw a real historical row).
  retrain  Train a challenger through the UNCHANGED train.py lifecycle (purged + embargoed walk-forward
           on the corpus timeline), stamped with honest corpus provenance, exported to its own artifact
           path. Compare champion vs challenger on identical held-out data; promotion to the deployed
           champion path is a separate, explicit step - never a side effect.

SURVIVORSHIP HONESTY: the corpus is built from the CURRENT SEC listing (delisted names absent), so the
ruin class is censored and every precision number here is an OPTIMISTIC BOUND. The corpus, every report
and every artifact trained from it carry this caveat in their provenance. The delisted-inclusive
point-in-time dataset remains the roadmap's data gate; this corpus is the strongest eval free data can
honestly support, not a substitute for that gate.

    .venv/bin/python -m workers.emerging_winner.backtest build --sample 1400
    .venv/bin/python -m workers.emerging_winner.backtest eval
    .venv/bin/python -m workers.emerging_winner.backtest retrain
    .venv/bin/python -m workers.emerging_winner.backtest promote   # explicit, after reading the report

Research only - informs resemblance scores, never decides an action.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
from datetime import date
from typing import Optional

from .dataset import HORIZON_TRADING_DAYS, domain_features, label_from_outcome
from .domains import score_domains
from .train import (
    average_precision,
    calibration_bins,
    expected_calibration_error,
    precision_at_k,
    precision_at_k_by_cohort,
    to_model_vector,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emerging_winner.backtest")

DEFAULT_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".ew-backtest-cache")
CORPUS_FILE = "corpus.jsonl"
CORPUS_META_FILE = "corpus-meta.json"
CHALLENGER_ARTIFACT = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "lib", "generated", "emerging-winner-model-real-v1.json"
)
CHAMPION_ARTIFACT = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "lib", "generated", "emerging-winner-model.json"
)

CORPUS_SOURCE_LABEL = "historical-survivor-v1"
SURVIVORSHIP_CAVEAT = (
    "Survivor-biased corpus: universe = the CURRENT SEC listing, so delisted names are absent, the ruin "
    "class is censored, and precision here is an optimistic bound. A second selection bias is disclosed "
    "and quarantined: the curated emergence names were hand-picked WITH hindsight (they are in the "
    "curated set because they later won), so their rows are flagged `curated`, EXCLUDED from all "
    "training, and reported as a separate slice - the random-sample slice is the honest headline. "
    "Features are point-in-time (causal indicators; EDGAR facts filtered on filed <= entry date); "
    "labels are matured 12-month first-touch outcomes."
)

# Quarterly score dates: first calendar day of each quarter (bar_index_at snaps to the last bar <= T).
FIRST_SCORE_YEAR = 2016

# Dev/holdout discipline: everything before this date is the DEVELOPMENT set (training, model
# selection, floor gates, iteration); score dates from here on are the untouched CONFIRMATION set,
# scored exactly once after all decisions - the guard against adaptive overfitting to one eval set.
HOLDOUT_START = "2024-01-01"
# A score date must have a fully maturable window: ~252 trading days + settle margin before data end.


def quarterly_score_dates(first_year: int, last_iso: str) -> list[str]:
    out: list[str] = []
    for year in range(first_year, date.fromisoformat(last_iso).year + 1):
        for month in (1, 4, 7, 10):
            d = f"{year}-{month:02d}-02"
            if d <= last_iso:
                out.append(d)
    return out


def cap_tier(market_cap: Optional[float]) -> str:
    if market_cap is None:
        return "unknown"
    if market_cap < 75e6:
        return "micro"
    if market_cap < 2e9:
        return "small"
    if market_cap < 10e9:
        return "mid"
    return "large"


# --------------------------------------------------------------------------------------------------
# build - assemble the corpus
# --------------------------------------------------------------------------------------------------

def sample_universe(n_sample: int, seed: int) -> tuple[list[str], set[str]]:
    """(symbols, curated_set). Curated emergence names are included for the eval SLICE only - they were
    hand-picked with hindsight, so they are flagged, quarantined from training, and never the headline.
    The random seeded sample of the current SEC listing is the honest measurement population."""
    from .universe_source import _emergence_first, load_sec_listing

    curated = _emergence_first()
    listing = load_sec_listing()
    pool = [s for s in listing if s not in set(curated)]
    rng = random.Random(seed)
    picked = rng.sample(pool, min(n_sample, len(pool))) if pool else []
    return curated + picked, {s.upper() for s in curated}


def build_corpus(
    cache_dir: str,
    *,
    n_sample: int = 1400,
    seed: int = 7,
    min_price: float = 0.30,
    min_history_bars: int = 260,
    symbols: Optional[list[str]] = None,
    max_symbols: Optional[int] = None,
    prefer: str = "stooq",
) -> dict:
    """Fetch (cached) price history + EDGAR bundles for the sampled universe and write the corpus JSONL.
    Idempotent: every network object is disk-cached, so a rerun only fills gaps."""
    from ..stock_scanner.indicators import calculate_indicators
    from . import history_source as hs
    from .universe_source import cik_by_symbol

    os.makedirs(cache_dir, exist_ok=True)
    if symbols is not None:
        syms, curated_set = symbols, set()
    else:
        syms, curated_set = sample_universe(n_sample, seed)
    if max_symbols:
        syms = syms[:max_symbols]
    ciks = cik_by_symbol()
    # Theme in the corpus comes ONLY from the SEC SIC classification (submissions_source) - an
    # administrative identity independent of outcomes, honest for history. The CURATED theme map
    # stays banned from training forever: those labels exist only for names picked BECAUSE they
    # later won (leak by construction, found 2026-08-01).

    # Pass 1: prices (stooq -> yfinance fallback; auto-switch if stooq starts refusing). Transient
    # source failures ("error") back off exponentially and retry the same symbol; a persistent outage
    # aborts the pass honestly instead of hammering the rest of the list into a poisoned cache
    # (2026-08-01 incident: a mid-run DNS blip briefly branded ~1,200 live symbols as historyless).
    series: dict[str, list] = {}
    stooq_fails = 0
    error_streak = 0
    i = 0
    while i < len(syms):
        sym = syms[i]
        bars, source = hs.load_price_history(sym, cache_dir, prefer=prefer, min_bars=min_history_bars)
        if source == "error":
            error_streak += 1
            if error_streak > 8:
                logger.error("prices: %d consecutive source failures - aborting the fetch pass at "
                             "%d/%d (a rerun resumes from cache)", error_streak, i, len(syms))
                break
            wait = min(60.0, 2.0 ** error_streak)
            logger.warning("prices: source failure on %s (streak %d) - backing off %.0fs",
                           sym, error_streak, wait)
            hs.polite_sleep(wait)
            continue  # retry the SAME symbol after the backoff
        error_streak = 0
        if bars:
            series[sym] = bars
            if source == "stooq":
                stooq_fails = 0
        elif prefer == "stooq":
            stooq_fails += 1
            if stooq_fails >= 25:
                logger.warning("stooq refusing consistently after %d symbols - switching to yfinance-first", i)
                prefer = "yfinance"
                stooq_fails = 0
        if source in ("stooq", "yfinance"):
            hs.polite_sleep(0.15)
        i += 1
        if i % 100 == 0:
            logger.info("prices: %d/%d fetched (%d usable)", i, len(syms), len(series))
    logger.info("prices done: %d/%d symbols with >= %d bars", len(series), len(syms), min_history_bars)

    # Pass 2: EDGAR bundles for priced US names with a CIK.
    bundles: dict[str, Optional[dict]] = {}
    fetched = 0
    for sym in series:
        cik = ciks.get(sym.upper())
        if not cik:
            bundles[sym] = None
            continue
        path_exists = os.path.exists(os.path.join(cache_dir, "edgar", f"{int(cik)}.json"))
        bundles[sym] = hs.fetch_edgar_bundle(cik, cache_dir)
        if not path_exists:
            fetched += 1
            hs.polite_sleep(0.13)  # SEC fair-use: stay well under 10 req/s
            if fetched % 100 == 0:
                logger.info("edgar: %d bundles fetched", fetched)
    logger.info("edgar done: %d symbols with facts", sum(1 for b in bundles.values() if b))

    # Pass 3: submissions bundles (SIC identity for the theme domain; also the Form 4 index the
    # sponsorship reads walk). One cached fetch per CIK.
    from .form4_source import sponsorship_features
    from .submissions_source import load_submissions_bundle, theme_context_from_sic

    sic_themes: dict[str, Optional[dict]] = {}
    subs_bundles: dict[str, Optional[dict]] = {}
    subs_fetched = 0
    for sym in series:
        cik = ciks.get(sym.upper())
        if not cik:
            sic_themes[sym] = None
            subs_bundles[sym] = None
            continue
        path_exists = os.path.exists(os.path.join(cache_dir, "submissions", f"{int(cik)}.json"))
        bundle = load_submissions_bundle(cik, cache_dir)
        subs_bundles[sym] = bundle
        sic_themes[sym] = theme_context_from_sic(
            (bundle or {}).get("sic"), (bundle or {}).get("sic_description"))
        if not path_exists:
            subs_fetched += 1
            hs.polite_sleep(0.13)
            if subs_fetched % 200 == 0:
                logger.info("submissions: %d bundles fetched", subs_fetched)
    n_themed = sum(1 for t in sic_themes.values() if t)
    logger.info("submissions done: %d symbols SIC-themed (hot-theme members only)", n_themed)

    # Pass 4: the benchmark regime series for the narrative domain (causal, so one precomputed
    # date->regime map serves every score date).
    from . import regime_source

    bench_bars, bench_src = hs.load_price_history(regime_source.BENCHMARK_SYMBOL, cache_dir,
                                                  prefer=prefer, min_bars=min_history_bars)
    regime_map = regime_source.regime_by_date(bench_bars) if bench_bars else {}
    logger.info("benchmark %s (%s): %d regime days", regime_source.BENCHMARK_SYMBOL, bench_src, len(regime_map))

    data_end = max((bars[-1].day for bars in series.values()), default=None)
    if data_end is None:
        raise SystemExit("no price data fetched at all - offline?")
    # A window is maturable only when T + ~252 trading days (~370 calendar) fits before data_end.
    last_maturable = (date.fromisoformat(data_end).toordinal() - 385)
    score_dates = [d for d in quarterly_score_dates(FIRST_SCORE_YEAR, data_end)
                   if date.fromisoformat(d).toordinal() <= last_maturable]

    rows: list[dict] = []
    skipped = {"no_idx": 0, "thin_history": 0, "cheap": 0, "no_features": 0, "immature": 0, "no_label": 0}
    for sym, bars in series.items():
        candles = hs.bars_to_candles(sym, bars)
        snapshots = calculate_indicators(candles)
        if len(snapshots) != len(bars):
            # dropna inside the indicator pass can shrink the frame; realign by date
            snap_by_day = {s.candle_time.date().isoformat(): s for s in snapshots}
            bars = [b for b in bars if b.day in snap_by_day]
            snapshots = [snap_by_day[b.day] for b in bars]
        # Delisting proxy compares this series' last bar against ITS OWN observation time, never the
        # freshest symbol's data end (a stale cache is not a delisting).
        sym_data_end = hs.price_cache_fetch_date(sym, cache_dir) or data_end
        for t in score_dates:
            idx = hs.bar_index_at(bars, t)
            if idx is None:
                skipped["no_idx"] += 1
                continue
            if idx < min_history_bars - 1:
                skipped["thin_history"] += 1
                continue
            px = bars[idx].raw_close or bars[idx].close
            if not px or px < min_price:
                skipped["cheap"] += 1
                continue
            # ONE clock for features and entry: the entry bar's date. Using the nominal quarter date
            # let an EDGAR fact filed in the weekend gap enter the features while its price reaction
            # sat inside the outcome window (bounded look-ahead - adversarial-review fix).
            t_entry = bars[idx].day
            regime = regime_source.regime_for_day(regime_map, t_entry)
            # Sponsorship from the PRE-FETCHED Form 4 cache only (fill-form4 job): all-or-nothing
            # per window; before the fill has run this stays None and the domain reads unavailable.
            sponsorship = sponsorship_features(
                ciks.get(sym.upper()), subs_bundles.get(sym), cache_dir,
                as_of=t_entry, cached_only=True,
            )
            feats = hs.assemble_features_asof(
                bars, snapshots, idx,
                edgar_bundle=bundles.get(sym), as_of=t_entry, theme=sic_themes.get(sym),
                market_context={"regime": regime, "source": "benchmark_trend_drawdown"} if regime else None,
                sponsorship=sponsorship,
            )
            if not feats:
                skipped["no_features"] += 1
                continue
            outcome = hs.label_forward(bars, idx, horizon=HORIZON_TRADING_DAYS, data_end=sym_data_end)
            if outcome is None:
                skipped["no_label"] += 1
                continue
            if outcome.get("immature"):
                skipped["immature"] += 1
                continue
            rows.append({
                "symbol": sym,
                "predicted_at": t_entry,
                "cohort": f"{t_entry[:4]}Q{(int(t_entry[5:7]) - 1) // 3 + 1}",
                "curated": sym.upper() in curated_set,
                "features": feats,
                "outcome": {k: outcome[k] for k in ("barrier_hit", "still_listed", "liquidity_grew")},
                "diagnostics": {
                    "max_fwd_return": outcome["max_fwd_return"],
                    "fwd_bars": outcome["fwd_bars"],
                    "entry_close": bars[idx].close,
                    "cap_tier": cap_tier(feats.get("market_cap")),
                    "avg_dollar_volume": feats.get("avg_dollar_volume"),
                },
            })

    corpus_path = os.path.join(cache_dir, CORPUS_FILE)
    with open(corpus_path, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r) + "\n")

    n_winners = sum(1 for r in rows if label_from_outcome(r["outcome"]) == 1)
    n_curated = sum(1 for r in rows if r["curated"])
    meta = {
        "source": CORPUS_SOURCE_LABEL,
        "caveat": SURVIVORSHIP_CAVEAT,
        "corpus_sha256": _corpus_sha256(corpus_path),
        "built_at_data_end": data_end,
        "seed": seed,
        "n_sample_requested": n_sample,
        "n_symbols_priced": len(series),
        "n_symbols_with_rows": len({r["symbol"] for r in rows}),
        "n_symbols_with_edgar": sum(1 for b in bundles.values() if b),
        "score_dates": score_dates,
        "n_rows": len(rows),
        "n_rows_curated": n_curated,
        "n_winners": n_winners,
        "base_rate": round(n_winners / len(rows), 4) if rows else None,
        "skipped": skipped,
        "filters": {"min_price": min_price, "min_history_bars": min_history_bars},
        # Theme provenance: "sec_sic" = deterministic SIC-code map (outcome-independent, honest for
        # history). The value False means no theme at all; the CURATED map is banned from training.
        "theme_injection": "sec_sic",
        "n_symbols_sic_themed": n_themed,
        "regime_source": f"{regime_source.BENCHMARK_SYMBOL} trend/drawdown ({len(regime_map)} days)",
        "n_rows_with_sponsorship": sum(1 for r in rows if "sponsorship" in r["features"]),
        "n_rows_with_regime": sum(1 for r in rows if "market_context" in r["features"]),
        "n_rows_with_theme": sum(1 for r in rows if "theme_context" in r["features"]),
        "label": "first-touch +100%/-80%, 252 trading days, option-4 conjuncts "
                 "(still_listed + liquidity_grew) computed from the forward window",
    }
    with open(os.path.join(cache_dir, CORPUS_META_FILE), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
    logger.info("corpus: %d rows (%d curated), %d winners (base rate %s) -> %s",
                len(rows), n_curated, n_winners, meta["base_rate"], corpus_path)
    return meta


def _corpus_sha256(path: str) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_corpus(cache_dir: str) -> tuple[list[dict], dict]:
    """Load + INTEGRITY-VERIFY the corpus. A report computed from a corpus that violates its own
    metadata is worse than no report (2026-08-01 incident: a stale-cache corpus carried theme labels
    while meta said theme_injection=false, inflating the headline 2.77x -> honest ~1.4x)."""
    corpus_path = os.path.join(cache_dir, CORPUS_FILE)
    rows: list[dict] = []
    with open(corpus_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    with open(os.path.join(cache_dir, CORPUS_META_FILE), encoding="utf-8") as fh:
        meta = json.load(fh)

    expected = meta.get("corpus_sha256")
    if expected:
        actual = _corpus_sha256(corpus_path)
        if actual != expected:
            raise SystemExit(
                f"corpus integrity failure: corpus.jsonl sha256 {actual[:12]}... != meta {expected[:12]}... "
                "- the corpus on disk is not the one the meta describes; rebuild before evaluating."
            )
    theme_mode = meta.get("theme_injection")
    if theme_mode is False:
        contaminated = sum(1 for r in rows if "theme_context" in r.get("features", {}))
        if contaminated:
            raise SystemExit(
                f"corpus integrity failure: {contaminated} rows carry theme_context while meta says "
                "theme_injection=false - stale-cache corpus from an older builder; rebuild it."
            )
    elif theme_mode == "sec_sic":
        bad = sum(1 for r in rows
                  if "theme_context" in r.get("features", {})
                  and r["features"]["theme_context"].get("source") != "sec_sic")
        if bad:
            raise SystemExit(
                f"corpus integrity failure: {bad} theme rows are not SIC-sourced while meta says "
                "theme_injection=sec_sic - a curated/outcome-derived label leaked in; rebuild it."
            )
    if "curated" not in (rows[0] if rows else {"curated": None}):
        raise SystemExit("corpus integrity failure: rows lack the `curated` provenance flag - rebuild.")
    return rows, meta


# --------------------------------------------------------------------------------------------------
# eval - score the frozen models on the matured corpus
# --------------------------------------------------------------------------------------------------

def _score_rows(rows: list[dict], champion_path: str,
                extra_models: Optional[dict] = None) -> dict:
    """Per-row: labels (option-4 and option-1), cohort, cap tier, curated flag, and the probability
    from (a) the deterministic reference scorecard, (b) the frozen champion artifact, and (c) any
    extra frozen artifacts - all through their REAL inference paths."""
    from .classifier import _classify_reference, _predict_trained, load_champion_model
    from .dataset import label_from_barrier

    model = load_champion_model(champion_path)
    extras = {name: load_champion_model(path) for name, path in (extra_models or {}).items()}
    extras = {name: m for name, m in extras.items() if m is not None}
    out: dict = {"y": [], "y_option1": [], "p_champion": [], "p_reference": [],
                 "cohorts": [], "tiers": [], "symbols": [], "t": [], "curated": []}
    for name in extras:
        out[f"p_{name}"] = []
    for r in rows:
        domains = score_domains(r["features"])
        feats, completeness = domain_features(domains)
        vec = to_model_vector(feats, completeness)
        out["y"].append(label_from_outcome(r["outcome"]))
        out["y_option1"].append(label_from_barrier(str(r["outcome"].get("barrier_hit"))))
        out["p_reference"].append(_classify_reference(domains).probability)
        if model is not None:
            out["p_champion"].append(_predict_trained(model, vec))
        for name, m in extras.items():
            out[f"p_{name}"].append(_predict_trained(m, vec))
        out["cohorts"].append(r["cohort"])
        out["tiers"].append(r["diagnostics"]["cap_tier"])
        out["symbols"].append(r["symbol"])
        out["t"].append(r["predicted_at"])
        out["curated"].append(bool(r.get("curated")))
    out["champion_loaded"] = model is not None
    out["champion_version"] = getattr(model, "model_version", None)
    out["champion_dataset"] = getattr(model, "dataset_source", None)
    out["extras_loaded"] = sorted(extras)
    return out


def _metric_block(y: list[int], p: list[float], cohorts: list, k_frac: float = 0.05,
                  symbols: Optional[list[str]] = None, ci: bool = False) -> dict:
    from ..stock_scanner.ml.recovery_model import auc, brier

    if not y:
        return {"n": 0}
    base = sum(y) / len(y)
    prec_k, k = precision_at_k(y, p, k_frac)
    by_cohort = precision_at_k_by_cohort(y, p, cohorts, k_frac)
    # Null annotation: at tiny per-cohort k a zero is EXPECTED under pure chance - a cohort zero is
    # only informative next to its null expectation (k x cohort base rate).
    for pc in by_cohort.get("per_cohort", []):
        pc["expected_hits_null"] = round(pc["k"] * pc["base_rate"], 2)
        if pc["k"] < 3:
            pc["low_k"] = True  # too small to read - suppressed from headline judgements
    block = {
        "n": len(y),
        "n_symbols": len(set(symbols)) if symbols else None,
        "n_positive_symbols": len({s for s, yi in zip(symbols, y) if yi == 1}) if symbols else None,
        "base_rate": round(base, 4),
        "pr_auc": round(average_precision(y, p), 4),
        "roc_auc": round(auc(y, p), 4),
        "brier": round(brier(y, p), 4),
        "ece": round(expected_calibration_error(y, p), 4),
        "precision_at_k": round(prec_k, 4),
        "k": k,
        "lift_at_k": round(prec_k / base, 3) if base > 0 else None,
        # One operating point is a free parameter - show the number is not an artifact of k=5%.
        "k_scan": {
            str(kf): {"precision": round(pk, 4), "k": kk,
                      "lift": round(pk / base, 3) if base > 0 else None}
            for kf in (0.02, 0.05, 0.10) for pk, kk in [precision_at_k(y, p, kf)]
        },
        "by_cohort": by_cohort,
        "calibration": calibration_bins(y, p),
        # ECE above verifies MODERATE calibration only; this block measures WEAK calibration
        # (slope/intercept) + a p-value, per the Van Calster hierarchy.
        "calibration_weak": _weak_calibration(y, p),
    }
    if ci and symbols:
        block["ci_90"] = _symbol_bootstrap_ci(y, p, symbols, k_frac)
    return block


def _symbol_bootstrap_ci(y: list[int], p: list[float], symbols: list[str],
                         k_frac: float, n_boot: int = 300, seed: int = 11) -> dict:
    """5-95% block-bootstrap CIs CLUSTERED BY SYMBOL for the headline metrics. Rows are not
    independent - a symbol's adjacent quarterly windows share most of their forward path, so row-level
    n wildly overstates the evidence; resampling whole symbols is the honest unit."""
    by_sym: dict[str, list[int]] = {}
    for i, s in enumerate(symbols):
        by_sym.setdefault(s, []).append(i)
    keys = sorted(by_sym)
    rng = random.Random(seed)
    stats: dict[str, list[float]] = {"precision_at_k": [], "lift_at_k": [], "pr_auc": []}
    for _ in range(n_boot):
        idx: list[int] = []
        for _k in keys:
            idx.extend(by_sym[keys[rng.randrange(len(keys))]])
        yb = [y[i] for i in idx]
        pb = [p[i] for i in idx]
        base = sum(yb) / len(yb) if yb else 0.0
        if base in (0.0, 1.0):
            continue
        pk, _ = precision_at_k(yb, pb, k_frac)
        stats["precision_at_k"].append(pk)
        stats["lift_at_k"].append(pk / base)
        stats["pr_auc"].append(average_precision(yb, pb))

    def pct(vals: list[float], q: float) -> Optional[float]:
        if not vals:
            return None
        vs = sorted(vals)
        return round(vs[min(len(vs) - 1, int(q * len(vs)))], 4)

    return {name: {"p05": pct(vals, 0.05), "p50": pct(vals, 0.50), "p95": pct(vals, 0.95),
                   "n_boot": len(vals)}
            for name, vals in stats.items()}


def paired_delta_ci(y: list[int], p_a: list[float], p_b: list[float], symbols: list[str],
                    k_frac: float = 0.05, n_boot: int = 300, seed: int = 11) -> dict:
    """Paired symbol-clustered bootstrap of (model B minus model A) on IDENTICAL rows.

    Comparing two separately-bootstrapped CIs for overlap is NOT a valid test of difference: two
    intervals can overlap substantially while the paired difference is decisively one-sided (and the
    overlap test will eventually block a genuinely better challenger, silently). Both models score
    the same rows here, so the honest test is the paired one: each draw resamples SYMBOLS (the same
    clustering unit as _symbol_bootstrap_ci), scores BOTH models on that same resampled set, and
    records the deltas. Gate on ci_90 excluding 0, not on eyeballing two marginal intervals."""
    by_sym: dict[str, list[int]] = {}
    for i, s in enumerate(symbols):
        by_sym.setdefault(s, []).append(i)
    keys = sorted(by_sym)
    rng = random.Random(seed)
    deltas: dict[str, list[float]] = {"lift_at_k": [], "precision_at_k": [], "pr_auc": []}
    for _ in range(n_boot):
        idx: list[int] = []
        for _k in keys:
            idx.extend(by_sym[keys[rng.randrange(len(keys))]])
        yb = [y[i] for i in idx]
        base = sum(yb) / len(yb) if yb else 0.0
        if base in (0.0, 1.0):
            continue
        pa = [p_a[i] for i in idx]
        pb = [p_b[i] for i in idx]
        prec_a, _ = precision_at_k(yb, pa, k_frac)
        prec_b, _ = precision_at_k(yb, pb, k_frac)
        deltas["precision_at_k"].append(prec_b - prec_a)
        deltas["lift_at_k"].append((prec_b - prec_a) / base)
        deltas["pr_auc"].append(average_precision(yb, pb) - average_precision(yb, pa))

    def pct(vals: list[float], q: float) -> Optional[float]:
        if not vals:
            return None
        vs = sorted(vals)
        return round(vs[min(len(vs) - 1, int(q * len(vs)))], 4)

    prec_a_pt, _ = precision_at_k(y, p_a, k_frac)
    prec_b_pt, _ = precision_at_k(y, p_b, k_frac)
    base_pt = sum(y) / len(y) if y else 0.0
    out = {}
    for name, vals in deltas.items():
        lo, mid, hi = pct(vals, 0.05), pct(vals, 0.50), pct(vals, 0.95)
        out[name] = {"p05": lo, "p50": mid, "p95": hi, "n_boot": len(vals),
                     "ci_excludes_zero": (lo is not None and hi is not None
                                          and (lo > 0 or hi < 0))}
    out["point_delta_lift_at_k"] = round((prec_b_pt - prec_a_pt) / base_pt, 4) if base_pt > 0 else None
    out["direction"] = "B_minus_A"
    out["note"] = ("Paired symbol-clustered bootstrap on identical rows. The difference verdict is "
                   "ci_excludes_zero on lift_at_k - never overlap of two marginal CIs.")
    return out


def _weak_calibration(y: list[int], p: list[float]) -> dict:
    """Weak-calibration statistics (Van Calster hierarchy): logistic recalibration slope + intercept
    of y on logit(p), plus Spiegelhalter's z. ECE verifies MODERATE calibration on binned means; it
    says nothing about weak calibration, and the intercept is exactly the corpus-prevalence-vs-
    deployment-prevalence problem measured instead of asserted (slope 1, intercept 0 = ideal)."""
    import math

    eps = 1e-6
    lo = [math.log(max(eps, min(1 - eps, pi)) / (1 - max(eps, min(1 - eps, pi)))) for pi in p]
    if not y or sum(y) in (0, len(y)):
        return {"n": len(y), "slope": None, "intercept": None,
                "spiegelhalter_z": None, "spiegelhalter_p": None}
    # 2-parameter Newton fit: y ~ sigmoid(a + b * logit(p)).
    a, b = 0.0, 1.0
    for _ in range(40):
        g_a = g_b = h_aa = h_ab = h_bb = 0.0
        for xi, yi in zip(lo, y):
            mu = 1.0 / (1.0 + math.exp(-(a + b * xi)))
            r = mu - yi
            wgt = max(mu * (1 - mu), 1e-9)
            g_a += r
            g_b += r * xi
            h_aa += wgt
            h_ab += wgt * xi
            h_bb += wgt * xi * xi
        det = h_aa * h_bb - h_ab * h_ab
        if abs(det) < 1e-12:
            break
        da = (g_a * h_bb - g_b * h_ab) / det
        db = (g_b * h_aa - g_a * h_ab) / det
        a -= da
        b -= db
        if abs(da) < 1e-10 and abs(db) < 1e-10:
            break
    num = sum((yi - pi) * (1 - 2 * pi) for yi, pi in zip(y, p))
    den = sum(((1 - 2 * pi) ** 2) * pi * (1 - pi) for pi in p)
    z = num / math.sqrt(den) if den > 0 else None
    p_val = round(2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2)))), 4) if z is not None else None
    return {"n": len(y), "slope": round(b, 4), "intercept": round(a, 4),
            "spiegelhalter_z": round(z, 4) if z is not None else None, "spiegelhalter_p": p_val}


ATTEMPT_LOG = os.path.join(
    os.path.dirname(__file__), "..", "..", "lyra-evals", "model-attempt-log.jsonl"
)


def _log_attempt(event: str, payload: dict) -> None:
    """Append EVERY modelling attempt (retrain, compare, holdout scoring, promotion decision) to a
    durable ledger - not just promotions. Guards the selection-bias hole the temporal rules cannot
    see: without a trial count, nobody can tell one clean confirmation from the best of forty tries.
    Wall-clock timestamp is deliberate here (this is an audit log, not a model input)."""
    from datetime import datetime, timezone

    rec = {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "event": event, **payload}
    try:
        with open(ATTEMPT_LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, sort_keys=True) + "\n")
    except OSError as exc:  # a failed audit write must be loud, never fatal to the run
        logger.warning("attempt log write failed: %s", exc)


def deployment_restatement(precision: Optional[float], corpus_base: float,
                           deployment_base: float = 0.03) -> Optional[float]:
    """Odds-rescale a top-k precision measured at the corpus base rate to a stated deployment base
    rate (the real universe's multi-bagger prevalence is ~2-4%, not the corpus mixture's) - the
    number that survives contact with the real universe, clearly marked as a restatement."""
    if precision is None or not 0 < corpus_base < 1 or not 0 <= precision < 1:
        return None
    odds = precision / (1 - precision)
    scale = (deployment_base / (1 - deployment_base)) / (corpus_base / (1 - corpus_base))
    adj = odds * scale
    return round(adj / (1 + adj), 4)


def run_eval(cache_dir: str, champion_path: str = CHAMPION_ARTIFACT, k_frac: float = 0.05,
             extra_models: Optional[dict] = None, rows_filter: Optional[str] = None) -> dict:
    """Score every frozen model on the corpus. HEADLINE = the random-sample slice: curated names are
    hindsight picks, quarantined to a disclosure slice. rows_filter: None=all, 'dev' / 'holdout'
    split the corpus on HOLDOUT_START (the holdout is scored ONCE, after all decisions)."""
    rows, meta = load_corpus(cache_dir)
    if rows_filter == "dev":
        rows = [r for r in rows if r["predicted_at"] < HOLDOUT_START]
    elif rows_filter == "holdout":
        rows = [r for r in rows if r["predicted_at"] >= HOLDOUT_START]
    scored = _score_rows(rows, champion_path, extra_models)
    y, y1 = scored["y"], scored["y_option1"]
    cohorts, tiers, symbols, curated = (scored["cohorts"], scored["tiers"],
                                        scored["symbols"], scored["curated"])

    def sub(p: list[float], idx: list[int], ci: bool = False) -> dict:
        return _metric_block([y[i] for i in idx], [p[i] for i in idx], [cohorts[i] for i in idx],
                             k_frac, symbols=[symbols[i] for i in idx], ci=ci)

    all_idx = list(range(len(y)))
    random_idx = [i for i in all_idx if not curated[i]]
    curated_idx = [i for i in all_idx if curated[i]]

    def slices(p: list[float]) -> dict:
        blocks = {
            "random_sample": sub(p, random_idx, ci=True),  # HEADLINE - the honest measurement population
            "all": sub(p, all_idx),
            "curated_disclosure": sub(p, curated_idx),
            # Option-1 (bare first-touch) vs option-4 (quality conjuncts), same rows and model.
            "random_sample_option1_label": _metric_block(
                [y1[i] for i in random_idx], [p[i] for i in random_idx],
                [cohorts[i] for i in random_idx], k_frac,
                symbols=[symbols[i] for i in random_idx]),
        }
        for tier in ("micro", "small", "mid", "large"):
            idx = [i for i in random_idx if tiers[i] == tier]
            blocks[f"random_{tier}"] = sub(p, idx)
        rs = blocks["random_sample"]
        rs["deployment_restatement_precision_at_3pct_base"] = deployment_restatement(
            rs.get("precision_at_k"), rs.get("base_rate") or 0.0)
        return blocks

    label_diag = {
        "option4_excluded_still_listed": sum(
            1 for i in all_idx if y1[i] == 1 and y[i] == 0
            and rows[i]["outcome"].get("still_listed") is False),
        "option4_excluded_liquidity": sum(
            1 for i in all_idx if y1[i] == 1 and y[i] == 0
            and rows[i]["outcome"].get("liquidity_grew") is False),
        "note": "option-4 = first-touch AND still-listed AND liquidity-grew; on a survivor corpus the "
                "still-listed conjunct rarely binds - never present it as survival discipline here.",
    }

    report = {
        "corpus": {k: meta.get(k) for k in ("source", "caveat", "corpus_sha256", "n_rows",
                                            "n_rows_curated", "n_winners", "base_rate",
                                            "built_at_data_end", "n_symbols_priced",
                                            "n_symbols_with_rows")},
        "rows_filter": rows_filter or "all",
        "holdout_start": HOLDOUT_START,
        "label_diagnostics": label_diag,
        "models": {"reference_scorecard": slices(scored["p_reference"])},
        "k_frac": k_frac,
    }
    if scored["champion_loaded"]:
        report["models"]["champion"] = slices(scored["p_champion"])
        report["champion"] = {"version": scored["champion_version"], "dataset": scored["champion_dataset"],
                              "path": os.path.abspath(champion_path)}
    for name in scored["extras_loaded"]:
        report["models"][name] = slices(scored[f"p_{name}"])
    # Paired difference test on the headline slice whenever champion + a challenger share the rows.
    # This (ci_excludes_zero on the delta), NOT overlap of two marginal CIs, is the difference verdict.
    if scored["champion_loaded"]:
        for name in scored["extras_loaded"]:
            report.setdefault("paired_vs_champion", {})[name] = paired_delta_ci(
                [y[i] for i in random_idx],
                [scored["p_champion"][i] for i in random_idx],
                [scored[f"p_{name}"][i] for i in random_idx],
                [symbols[i] for i in random_idx], k_frac)
    if rows_filter == "holdout":
        _log_attempt("holdout_scored", {
            "corpus_sha256": meta.get("corpus_sha256"),
            "champion_version": scored.get("champion_version"),
            "models": sorted(report["models"]),
            "headline_lift": {name: report["models"][name]["random_sample"].get("lift_at_k")
                              for name in report["models"]},
        })
    os.makedirs(os.path.join(cache_dir, "reports"), exist_ok=True)
    suffix = f"-{rows_filter}" if rows_filter else ""
    out_path = os.path.join(cache_dir, "reports", f"eval-report{suffix}.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    logger.info("eval report -> %s", out_path)
    return report


# --------------------------------------------------------------------------------------------------
# retrain - challenger through the unchanged lifecycle
# --------------------------------------------------------------------------------------------------

def corpus_as_ledger_rows(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Corpus rows -> the (predictions, outcomes) shape the ledger produces, so assemble_training_rows /
    load_training_dataset / train_and_export run byte-identically on historical data."""
    predictions: list[dict] = []
    outcomes: list[dict] = []
    for i, r in enumerate(rows):
        pid = f"bt-{i}"
        domains = score_domains(r["features"])
        predictions.append({
            "id": pid,
            "symbol": r["symbol"],
            "predicted_at": r["predicted_at"],
            "payload": {"domains": [d.to_dict() for d in domains]},
        })
        outcomes.append({"prediction_id": pid, **r["outcome"]})
    return predictions, outcomes


def run_retrain(cache_dir: str, out_path: str = CHALLENGER_ARTIFACT, folds: int = 6,
                estimator: str = "logistic") -> dict:
    """Train the challenger on the DEVELOPMENT set only (predicted_at < HOLDOUT_START) with curated
    hindsight picks EXCLUDED - they may never teach the model, only be disclosed in eval slices."""
    from .train import ModelFloorError, train_and_export

    rows, meta = load_corpus(cache_dir)
    n_total = len(rows)
    rows = [r for r in rows if not r.get("curated") and r["predicted_at"] < HOLDOUT_START]
    logger.info("retrain set: %d of %d rows (curated + holdout excluded, estimator=%s)",
                len(rows), n_total, estimator)
    predictions, outcomes = corpus_as_ledger_rows(rows)
    provenance = (
        f"Trained on the {CORPUS_SOURCE_LABEL} historical corpus DEV split: {len(rows)} point-in-time "
        f"rows (curated hindsight names and score dates >= {HOLDOUT_START} excluded from training), "
        f"quarterly score dates from {meta['score_dates'][0]}, matured 12-month first-touch outcomes. "
        f"{SURVIVORSHIP_CAVEAT} Walk-forward purged + embargoed on the real timeline (calendar-day "
        "spans). Research only, never advice."
    )
    try:
        payload = train_and_export(
            out_path=out_path,
            predictions=predictions,
            outcomes=outcomes,
            folds=folds,
            source_label=CORPUS_SOURCE_LABEL,
            provenance_note=provenance,
            model_version=("emerging-winner-classifier-real-v1" if estimator == "logistic"
                           else f"emerging-winner-classifier-real-v1-{estimator}"),
            trained_at=meta["built_at_data_end"],  # deterministic: the corpus data-end, not wall clock
            estimator=estimator,
            # The incumbent champion's stored metrics were measured on SYNTHETIC data - comparing a
            # real-data walk-forward against them is apples-to-oranges, so the regression-vs-incumbent
            # check is meaningless here; the ABSOLUTE floors still apply, enforced below.
            force=True,
        )
    except ModelFloorError:
        raise
    m = payload["metrics"]
    logger.info(
        "challenger: PR-AUC %s ROC-AUC %s ECE %s precision@k %s (worst cohort %s) lift %sx base %s n_oos %s",
        m.get("oos_pr_auc"), m.get("oos_auc"), m.get("ece"), m.get("precision_at_k"),
        m.get("precision_at_k_by_cohort", {}).get("worst"), m.get("lift_at_k"),
        m.get("base_rate"), m.get("n_oos"),
    )
    if not payload["floor"]["passed"]:
        logger.warning("challenger FAILED absolute floors: %s - artifact written for inspection at %s "
                       "but MUST NOT be promoted", payload["floor"]["reasons"], out_path)
    _log_attempt("retrain", {
        "corpus_sha256": meta.get("corpus_sha256"),
        "estimator": estimator,
        "out_path": os.path.abspath(out_path),
        "wf_lift_at_k": m.get("lift_at_k"),
        "wf_roc_auc": m.get("oos_auc"),
        "floor_passed": bool(payload["floor"]["passed"]),
    })
    return payload


def run_compare(cache_dir: str, k_frac: float = 0.05) -> dict:
    """Champion (synthetic-trained) vs challenger (real-trained) on IDENTICAL held-out real data: the
    challenger's walk-forward OOS windows within the DEV split, curated hindsight names excluded
    (they may not teach OR flatter either side). The champion never trained on any real row, so
    scoring it on the same windows is a fair protocol ON THIS CORPUS - it is not an estimate of live
    edge. The one-shot `holdout` command is the confirmation step."""
    from ..stock_scanner.ml.recovery_model import _standardization, fit_logistic
    from .classifier import _predict_trained, load_champion_model
    from .train import (
        PURGE_EMBARGO_CALENDAR_DAYS,
        PURGE_HORIZON_CALENDAR_DAYS,
        _predict,
        _purged_train_indices,
    )

    rows, meta = load_corpus(cache_dir)
    champion = load_champion_model(CHAMPION_ARTIFACT)
    if champion is None:
        raise SystemExit("no champion artifact - nothing to compare against")

    rows = [r for r in rows if not r.get("curated") and r["predicted_at"] < HOLDOUT_START]
    ordered = sorted(rows, key=lambda r: r["predicted_at"])
    X10, comps, y, times, cohorts, tiers = [], [], [], [], [], []
    for r in ordered:
        domains = score_domains(r["features"])
        feats, completeness = domain_features(domains)
        X10.append(feats)
        comps.append(completeness)
        y.append(label_from_outcome(r["outcome"]))
        times.append(float(date.fromisoformat(r["predicted_at"]).toordinal()))
        cohorts.append(r["cohort"])
        tiers.append(r["diagnostics"]["cap_tier"])
    X = [to_model_vector(f, c) for f, c in zip(X10, comps)]

    folds = 6
    n = len(X)
    fold_size = max(1, n // folds)
    oos = {"y": [], "p_champ": [], "p_chall": [], "cohort": [], "tier": [], "symbol": []}
    for f in range(1, folds):
        train_end = f * fold_size
        test_end = (f + 1) * fold_size if f < folds - 1 else n
        # times are CALENDAR ordinals, so the purge span must be calendar days (adversarial-review fix).
        keep = _purged_train_indices(times, train_end, PURGE_HORIZON_CALENDAR_DAYS, PURGE_EMBARGO_CALENDAR_DAYS)
        Xtr = [X[i] for i in keep]
        ytr = [y[i] for i in keep]
        if not Xtr or sum(ytr) == 0:
            continue
        mean, std = _standardization(Xtr)
        w, b = fit_logistic(Xtr, ytr, mean, std)
        for j in range(train_end, test_end):
            oos["y"].append(y[j])
            oos["p_champ"].append(_predict_trained(champion, X[j]))
            oos["p_chall"].append(_predict(mean, std, w, b, X[j]))
            oos["cohort"].append(cohorts[j])
            oos["tier"].append(tiers[j])
            oos["symbol"].append(ordered[j]["symbol"])

    def block(p: list[float]) -> dict:
        return _metric_block(oos["y"], p, oos["cohort"], k_frac, symbols=oos["symbol"], ci=True)

    def tier_block(p: list[float], tier: str) -> dict:
        idx = [i for i, t in enumerate(oos["tier"]) if t == tier]
        return _metric_block([oos["y"][i] for i in idx], [p[i] for i in idx],
                             [oos["cohort"][i] for i in idx], k_frac,
                             symbols=[oos["symbol"][i] for i in idx])

    comparison = {
        "note": (
            "DEV split, curated names excluded. The challenger is scored only on its purged "
            "(calendar-day) walk-forward test windows. CAUTION reading the incumbent's side: since "
            "the real-v1 promotion the deployed champion has TRAINED on dev rows, so its dev "
            "numbers here are in-sample-flattered - from gen-2 onward the only fair "
            "champion-vs-challenger fight is the one-shot HOLDOUT, never this dev view."
        ),
        "n_oos": len(oos["y"]),
        "champion": {"all": block(oos["p_champ"]),
                     "small": tier_block(oos["p_champ"], "small"), "micro": tier_block(oos["p_champ"], "micro")},
        "challenger": {"all": block(oos["p_chall"]),
                       "small": tier_block(oos["p_chall"], "small"), "micro": tier_block(oos["p_chall"], "micro")},
        # The valid difference test: paired symbol-clustered bootstrap of (challenger - champion)
        # on these identical rows. Never judge the fight by overlap of the two marginal CIs above.
        "paired_delta_challenger_minus_champion": paired_delta_ci(
            oos["y"], oos["p_champ"], oos["p_chall"], oos["symbol"], k_frac),
        "corpus_caveat": meta["caveat"],
        "corpus_sha256": meta.get("corpus_sha256"),
    }
    _log_attempt("compare", {
        "corpus_sha256": meta.get("corpus_sha256"),
        "champion_lift": comparison["champion"]["all"].get("lift_at_k"),
        "challenger_lift": comparison["challenger"]["all"].get("lift_at_k"),
        "paired_delta_lift_ci90": {
            k: comparison["paired_delta_challenger_minus_champion"]["lift_at_k"].get(k)
            for k in ("p05", "p95", "ci_excludes_zero")},
    })
    out_path = os.path.join(cache_dir, "reports", "champion-vs-challenger.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(comparison, fh, indent=2)
    logger.info("comparison -> %s", out_path)
    return comparison


METRICS_HISTORY = os.path.join(
    os.path.dirname(__file__), "..", "..", "lyra-evals", "model-metrics-history.jsonl"
)
MODEL_EVIDENCE = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "lib", "generated", "model-evidence.json"
)

# Editorial grades - regraded per cycle alongside lyra-evals/MODEL-REPORT-CARD.md (the prose home).
# They ride in the evidence export so the product surface and the report card can never disagree.
EVIDENCE_GRADES = {
    "graded_at_corpus": "a297e8ad",  # gen-2 (theme via SEC SIC + market regime lit)
    "dimensions": [
        {"dimension": "Accuracy (real, out-of-time)", "grade": "B-",
         "why": "Gen-2 holdout: lift 1.94x CI90[1.55, 2.29] at top-5%, worst quarterly cohort 0.20 "
                "(no more zero-hit regimes). Still a survivor-biased optimistic bound - a strong "
                "research-queue edge, not a tradeable signal."},
        {"dimension": "Calibration", "grade": "A-",
         "why": "ECE 0.017 on the untouched gen-2 holdout; level near-perfect (calibration-in-the-"
                "large -0.05) and the 3%-base restatement transfers (median ECE 0.006 across 50 "
                "prevalence-shift draws). Measured gap to A: recalibration slope 0.755 CI90[0.57, "
                "0.98] - the spread is mildly overconfident; a slope-corrected artifact rides the "
                "gen-3 standing loop, and live-ledger validation remains."},
        {"dimension": "Process sophistication", "grade": "A",
         "why": "Purged walk-forward, one-shot holdout per corpus generation, symbol-clustered CIs, "
                "drift fixtures, corpus integrity hashes, audited promotion, the nightly outcome-"
                "maturation loop-closer, and a scheduled monthly re-eval cadence."},
        {"dimension": "Estimator sophistication", "grade": "C-",
         "why": "Two families now run the full honest lifecycle. On gen-2 dev walk-forward the "
                "depth-2 boosted trees beat the linear retrain (lift 1.34x vs 1.27x, ROC 0.585 vs "
                "0.548, no zero-hit cohorts) but failed the 1.5x floor and never threatened the "
                "frozen champion - the seat is unearned until a gen-3 fair fight is won."},
        {"dimension": "Data depth", "grade": "C-",
         "why": "7 of 10 domains now carry real data in the corpus (theme via SEC SIC, market regime, "
                "quarterly EDGAR fundamentals); Form 4 insider flow is live and its historical fill is "
                "running. Still survivor-biased with no delisted names - the binding constraint."},
        {"dimension": "Honesty of presentation", "grade": "A",
         "why": "Every caveat travels with every number; surfacing stays gated."},
    ],
}


def export_model_evidence(cache_dir: str) -> dict:
    """Compose src/lib/generated/model-evidence.json - the machine-readable evidence pack the product
    surface renders BEHIND the projections: what was tested, on what data (hash-bound), what won, what
    was refuted, the uncertainty, the leakage story and the grades. Regenerated by `record` after
    every eval cycle so the surface can never quietly outlive its evidence."""
    def read(name: str) -> Optional[dict]:
        path = os.path.join(cache_dir, "reports", name)
        if not os.path.exists(path):
            return None
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    dev = read("eval-report-dev.json")
    hold = read("eval-report-holdout.json")
    comp = read("champion-vs-challenger.json")
    if not dev or not hold:
        raise SystemExit("evidence export needs eval-report-dev.json and eval-report-holdout.json - run eval + holdout first")
    with open(os.path.join(cache_dir, CORPUS_META_FILE), encoding="utf-8") as fh:
        meta = json.load(fh)

    def rs(report: dict, model: str) -> Optional[dict]:
        return (report.get("models", {}).get(model) or {}).get("random_sample")

    def verdict_row(model_key: str, label: str, split: str, block: Optional[dict],
                    status: str) -> Optional[dict]:
        if not block or not block.get("n"):
            return None
        ci = (block.get("ci_90") or {}).get("lift_at_k") or {}
        return {
            "model": model_key, "label": label, "split": split, "status": status,
            "lift": block.get("lift_at_k"), "ci90": [ci.get("p05"), ci.get("p95")],
            "rocAuc": block.get("roc_auc"), "ece": block.get("ece"),
            "precisionAtK": block.get("precision_at_k"), "baseRate": block.get("base_rate"),
            "n": block.get("n"), "worstCohort": (block.get("by_cohort") or {}).get("worst"),
        }

    champion_art = {}
    try:
        with open(os.path.abspath(CHAMPION_ARTIFACT), encoding="utf-8") as fh:
            champion_art = json.load(fh)
    except (OSError, ValueError):
        pass
    champ_version = champion_art.get("modelVersion", "champion")
    champ_is_real = "real" in champ_version or (champion_art.get("dataset", {}).get("source", "")
                                                .startswith("historical"))
    challenger_meta: dict = {}
    try:
        with open(os.path.abspath(CHALLENGER_ARTIFACT), encoding="utf-8") as fh:
            challenger_meta = json.load(fh)
    except (OSError, ValueError):
        pass
    chall_status = ("promoted" if challenger_meta.get("promotion")
                    else ("challenger_not_promoted" if not challenger_meta.get("floor", {}).get("passed")
                          else "challenger"))

    verdict = [r for r in [
        # The DEPLOYED champion, judged where the judgement is fair: the untouched holdout. (Its dev
        # numbers are in-sample once a real-data champion has been promoted - never shown as verdict.)
        verdict_row("champion", f"deployed champion ({champ_version})", "holdout",
                    rs(hold, "champion"),
                    "promoted" if champ_is_real else "refuted"),
        # The latest retrained challenger (this cycle's), on the same holdout + its honest dev WF.
        verdict_row("challenger", "latest challenger (this cycle's retrain)", "holdout",
                    rs(hold, "challenger_real_v1"), chall_status),
        verdict_row("challenger", "latest challenger (this cycle's retrain)", "dev_walk_forward",
                    (comp or {}).get("challenger", {}).get("all"), chall_status),
        verdict_row("reference_scorecard", "reference scorecard (hand-designed)", "holdout",
                    rs(hold, "reference_scorecard"), "refuted_as_ranker"),
        verdict_row("reference_scorecard", "reference scorecard (hand-designed)", "dev",
                    rs(dev, "reference_scorecard"), "refuted_as_ranker"),
    ] if r]
    baseline_weights = None
    baseline_path = os.path.join(cache_dir, "previous-champion.json")
    if os.path.exists(baseline_path):
        try:
            with open(baseline_path, encoding="utf-8") as fh:
                baseline_weights = json.load(fh).get("weights")
        except (OSError, ValueError):
            baseline_weights = None

    # The deep-dive blocks (k-scan, calibration, cohorts, restatement) describe the DEPLOYED
    # champion - the model whose numbers the product actually serves.
    hold_rs = rs(hold, "champion") or rs(hold, "challenger_real_v1") or {}
    evidence = {
        "generatedFromCorpus": {
            "sha256": meta.get("corpus_sha256"), "dataEnd": meta.get("built_at_data_end"),
            "rows": meta.get("n_rows"), "curatedRows": meta.get("n_rows_curated"),
            "symbols": meta.get("n_symbols_with_rows"), "baseRate": meta.get("base_rate"),
            "holdoutStart": hold.get("holdout_start"), "label": meta.get("label"),
        },
        "caveat": meta.get("caveat"),
        "verdict": verdict,
        "kScan": hold_rs.get("k_scan"),
        "calibration": {
            "real_v1": hold_rs.get("calibration"),  # the deployed champion's holdout reliability
            "prior_champion": None,  # the refuted synthetic incumbent left the reports at gen-2
        },
        "cohorts": {
            "dev": [c for c in (((comp or {}).get("challenger", {}).get("all") or {})
                                .get("by_cohort") or {}).get("per_cohort", [])
                    if c.get("k", 0) >= 3],
            "holdout": [c for c in (hold_rs.get("by_cohort") or {}).get("per_cohort", [])
                        if c.get("k", 0) >= 3],
        },
        "weights": {
            "features": champion_art.get("featureOrder"),
            "current": champion_art.get("weights"),
            "baselineSynthetic": baseline_weights,
            "note": "Standardised logistic weights. Zeros are domains whose data pipelines are unbuilt - "
                    "honestly dead, never faked.",
        },
        # The historical record of how the first honest number was earned (gen-1, 2026-08-01).
        # Deliberately literal - it documents that cycle forever; later cycles append to the
        # metrics-history ledger instead of rewriting this story.
        "leakage": [
            {"label": "first run", "lift": 2.77, "note": "stale-cache corpus; curated theme labels leaked"},
            {"label": "theme leak removed", "lift": 1.47, "note": "symbol-identity leak stripped"},
            {"label": "curated names quarantined", "lift": 1.35, "note": "14 hindsight picks out of training + headline"},
            {"label": "purge units fixed", "lift": 1.31, "note": "calendar-day purge spans; honest gen-1 dev number"},
            {"label": "one-shot holdout (gen-1)", "lift": 1.72, "note": "untouched 2024-2025 confirmation",
             "confirm": True},
        ],
        "deploymentRestatement": {
            "base": 0.03,
            "precision": hold_rs.get("deployment_restatement_precision_at_3pct_base"),
            "note": "Odds-rescaled top-pick precision at a realistic ~3% deployment base rate.",
        },
        "labelDiagnostics": dev.get("label_diagnostics"),
        "promotion": champion_art.get("promotion"),
        "grades": EVIDENCE_GRADES,
        "evidenceDocs": [
            "lyra-modelling/research/2026-08-01-real-history-backtest-and-real-v1-champion.md",
            "lyra-evals/MODEL-REPORT-CARD.md",
            "lyra-modelling/NORTH-STAR.md",
        ],
    }
    out = os.path.abspath(MODEL_EVIDENCE)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(evidence, fh, indent=2)
        fh.write("\n")
    logger.info("model evidence -> %s (%d verdict rows)", out, len(verdict))
    return evidence


def record_metrics_history(cache_dir: str, note: str = "") -> dict:
    """Append one dated line per model to the metrics-over-time ledger (lyra-evals/) so every future
    retrain is graded against the last - the improvement loop's memory. Reads the latest dev + holdout
    eval reports; the corpus hash makes every entry traceable to its exact data."""
    entry: dict = {"note": note}
    for kind in ("dev", "holdout"):
        path = os.path.join(cache_dir, "reports", f"eval-report-{kind}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            report = json.load(fh)
        entry.setdefault("recorded_at_data_end", report["corpus"].get("built_at_data_end"))
        entry.setdefault("corpus_sha256", report["corpus"].get("corpus_sha256"))
        models = {}
        for name, blocks in report.get("models", {}).items():
            rs = blocks.get("random_sample") or {}
            if not rs.get("n"):
                continue
            models[name] = {k: rs.get(k) for k in
                            ("n", "base_rate", "pr_auc", "roc_auc", "ece",
                             "precision_at_k", "lift_at_k")}
            models[name]["worst_cohort_p_at_k"] = (rs.get("by_cohort") or {}).get("worst")
            models[name]["lift_ci90"] = (rs.get("ci_90") or {}).get("lift_at_k")
        entry[kind] = models
    out = os.path.abspath(METRICS_HISTORY)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")
    logger.info("metrics history: appended -> %s", out)
    return entry


def fill_form4(cache_dir: str, *, since: str = "2015-06-01", max_docs_total: Optional[int] = None) -> dict:
    """One-time (resumable) historical fill of the Form 4 document cache for every corpus symbol -
    the job that turns the sponsorship domain from live-only into a corpus feature. Reads the
    per-CIK filing indexes already cached by the submissions pass, fetches every Form 4 filed since
    `since`, parses and caches it forever. Fully resumable: cached documents are never refetched, so
    an interrupted run just continues. SEC fair-use pacing throughout."""
    from . import history_source as hs
    from .form4_source import fetch_form4_parsed
    from .universe_source import cik_by_symbol

    ciks = cik_by_symbol()
    subs_dir = os.path.join(cache_dir, "submissions")
    prices_dir = os.path.join(cache_dir, "prices")
    symbols = [f[:-5] for f in os.listdir(prices_dir)] if os.path.isdir(prices_dir) else []
    todo: list[tuple[int, dict]] = []
    for sym in sorted(symbols):
        cik = ciks.get(sym.upper())
        if not cik:
            continue
        path = os.path.join(subs_dir, f"{int(cik)}.json")
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                bundle = json.load(fh)
        except Exception:  # noqa: BLE001
            continue
        for entry in bundle.get("form4_index", []):
            if entry.get("filed", "") >= since:
                todo.append((cik, entry))
    already = fetched = failed = 0
    form4_dir = os.path.join(cache_dir, "form4")
    os.makedirs(form4_dir, exist_ok=True)
    for i, (cik, entry) in enumerate(todo):
        key = entry["accession"].replace("-", "")
        if os.path.exists(os.path.join(form4_dir, f"{key}.json")):
            already += 1
            continue
        if max_docs_total is not None and fetched >= max_docs_total:
            break
        parsed = fetch_form4_parsed(cik, entry["accession"], entry.get("doc", ""), cache_dir)
        if parsed is None:
            failed += 1
        else:
            fetched += 1
        hs.polite_sleep(0.18)  # SEC courtesy: ~5 req/s sustained for a long job
        if (fetched + failed) % 500 == 0 and (fetched + failed):
            logger.info("form4 fill: %d/%d indexed docs (fetched %d, cached %d, failed %d)",
                        i + 1, len(todo), fetched, already, failed)
    summary = {"indexed": len(todo), "fetched": fetched, "already_cached": already, "failed": failed}
    logger.info("form4 fill done: %s", summary)
    return summary


def promote_challenger(challenger_path: str = CHALLENGER_ARTIFACT,
                       champion_path: str = CHAMPION_ARTIFACT,
                       force_reason: Optional[str] = None) -> None:
    """Explicit promotion: copy the challenger artifact over the champion path. Refuses when the
    challenger failed its absolute floors - UNLESS an explicit `force_reason` documents why missing
    the floor is still a strict improvement (the intended case: the incumbent is REFUTED on the same
    real data with CI separation, so keeping it because the honest challenger missed an aspirational
    floor would deploy the worse model). A forced promotion is stamped into the artifact - loud,
    auditable, never silent. The old champion survives in git history."""
    with open(challenger_path, encoding="utf-8") as fh:
        payload = json.load(fh)
    # Archive the displaced champion into the cache so the evidence export can always show the
    # weight comparison against what was replaced (git history keeps it too; this keeps it handy).
    champ_abs = os.path.abspath(champion_path)
    if os.path.exists(champ_abs):
        try:
            with open(champ_abs, encoding="utf-8") as fh:
                displaced = fh.read()
            prev_path = os.path.join(os.path.abspath(DEFAULT_CACHE_DIR), "previous-champion.json")
            os.makedirs(os.path.dirname(prev_path), exist_ok=True)
            with open(prev_path, "w", encoding="utf-8") as fh:
                fh.write(displaced)
        except OSError:
            pass
    if not payload.get("floor", {}).get("passed"):
        if not force_reason:
            _log_attempt("promote_refused", {
                "challenger_path": os.path.abspath(challenger_path),
                "model_version": payload.get("modelVersion"),
                "reason": "failed floors, no force_reason",
                "floor": payload.get("floor"),
            })
            raise SystemExit(f"challenger at {challenger_path} did not pass its floors - not promoting "
                             "(pass an explicit force_reason to override with documentation)")
        payload["promotion"] = {
            "forced_over_floor": True,
            "reason": force_reason,
            "promoted_over": "incumbent champion artifact (see git history)",
        }
        logger.warning("FORCED promotion over a failed floor - reason recorded in the artifact: %s",
                       force_reason)
    with open(champion_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")
    logger.info("promoted %s -> %s (modelVersion %s, dataset %s)",
                challenger_path, champion_path, payload.get("modelVersion"),
                payload.get("dataset", {}).get("source"))
    _log_attempt("promote", {
        "challenger_path": os.path.abspath(challenger_path),
        "model_version": payload.get("modelVersion"),
        "forced_over_floor": bool(payload.get("promotion", {}).get("forced_over_floor")),
        "force_reason": force_reason,
    })


# --------------------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------------------

def _print_models(report: dict, slice_name: str = "random_sample") -> None:
    for name, blocks in report["models"].items():
        a = blocks.get(slice_name) or blocks.get("all") or {}
        if not a.get("n"):
            print(f"{name}: no rows in slice {slice_name}")
            continue
        ci = (a.get("ci_90") or {}).get("lift_at_k") or {}
        ci_txt = f" CI90[{ci.get('p05')},{ci.get('p95')}]" if ci else ""
        print(f"{name} [{slice_name}]: n={a['n']} base={a['base_rate']} PR-AUC={a['pr_auc']} "
              f"ROC-AUC={a['roc_auc']} P@k={a['precision_at_k']} lift={a['lift_at_k']}x{ci_txt} "
              f"worst-cohort={a['by_cohort'].get('worst')} ECE={a['ece']}")


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Emerging Winner real-history backtest")
    parser.add_argument("command",
                        choices=["build", "eval", "retrain", "compare", "holdout", "promote", "record",
                                 "fill-form4"])
    parser.add_argument("--cache-dir", default=DEFAULT_CACHE_DIR)
    parser.add_argument("--sample", type=int, default=1400)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--max-symbols", type=int, default=None)
    parser.add_argument("--k-frac", type=float, default=0.05)
    parser.add_argument("--prefer", default="stooq", choices=["stooq", "yfinance"])
    parser.add_argument("--force-reason", default=None,
                        help="promote only: documented justification for promoting over a failed floor")
    parser.add_argument("--estimator", default="logistic", choices=["logistic", "boosted_stumps"],
                        help="retrain only: estimator family for the challenger (gen-3 bake-off seam)")
    parser.add_argument("--out", default=CHALLENGER_ARTIFACT,
                        help="retrain only: artifact output path (use a scratch path for bake-off runs)")
    args = parser.parse_args(argv)

    cache_dir = os.path.abspath(args.cache_dir)
    if args.command == "build":
        meta = build_corpus(cache_dir, n_sample=args.sample, seed=args.seed,
                            max_symbols=args.max_symbols, prefer=args.prefer)
        print(json.dumps({k: meta[k] for k in ("n_rows", "n_rows_curated", "n_winners", "base_rate",
                                               "n_symbols_priced", "skipped")}, indent=2))
    elif args.command == "eval":
        extra = {"challenger_real_v1": CHALLENGER_ARTIFACT} if os.path.exists(CHALLENGER_ARTIFACT) else None
        report = run_eval(cache_dir, k_frac=args.k_frac, extra_models=extra, rows_filter="dev")
        _print_models(report)
    elif args.command == "retrain":
        payload = run_retrain(cache_dir, out_path=args.out, estimator=args.estimator)
        m = payload["metrics"]
        bc = m.get("precision_at_k_by_cohort", {})
        print(f"challenger (dev walk-forward): PR-AUC={m.get('oos_pr_auc')} ROC-AUC={m.get('oos_auc')} "
              f"ECE={m.get('ece')} P@k={m.get('precision_at_k')} lift={m.get('lift_at_k')}x "
              f"base={m.get('base_rate')} worst-cohort={bc.get('worst')} n_oos={m.get('n_oos')}")
        print("purge:", m.get("purge"))
        print("floor:", payload["floor"])
    elif args.command == "compare":
        comparison = run_compare(cache_dir, k_frac=args.k_frac)
        for side in ("champion", "challenger"):
            a = comparison[side]["all"]
            ci = (a.get("ci_90") or {}).get("lift_at_k") or {}
            print(f"{side}: PR-AUC={a['pr_auc']} ROC-AUC={a['roc_auc']} P@k={a['precision_at_k']} "
                  f"lift={a['lift_at_k']}x CI90[{ci.get('p05')},{ci.get('p95')}] "
                  f"worst-cohort={a['by_cohort'].get('worst')}")
    elif args.command == "holdout":
        # ONE-SHOT confirmation on the untouched quarters. Run after all decisions are frozen.
        extra = {"challenger_real_v1": CHALLENGER_ARTIFACT} if os.path.exists(CHALLENGER_ARTIFACT) else None
        report = run_eval(cache_dir, k_frac=args.k_frac, extra_models=extra, rows_filter="holdout")
        _print_models(report)
    elif args.command == "promote":
        promote_challenger(force_reason=args.force_reason)
    elif args.command == "record":
        entry = record_metrics_history(cache_dir)
        evidence = export_model_evidence(cache_dir)
        print(json.dumps(entry, indent=2)[:1200])
        print(f"evidence: {len(evidence['verdict'])} verdict rows -> src/lib/generated/model-evidence.json")
    elif args.command == "fill-form4":
        print(json.dumps(fill_form4(cache_dir), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
