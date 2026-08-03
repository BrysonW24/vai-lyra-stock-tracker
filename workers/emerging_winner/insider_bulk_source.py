"""
Bulk insider ingestion - the SEC's quarterly Form 3/4/5 Data Sets, for HISTORY at scale.

Why this exists (BUILD-BACKLOG T1): per-document Form 4 fetching does not scale past ~1,000
names. Backfilling 991 companies cost 20 hours and drew two SEC throttle waves. The SEC also
publishes the same filings as pre-parsed quarterly TSV bundles (~14 MB per quarter, every
issuer): one quarter of bulk data covers 4,700+ companies, where the entire per-document
backfill covered 991. That is the unlock for BUILD-BACKLOG T2 (universe 991 -> ~8,000), which
is in turn the fix for the statistical-power problem that refused generation 3's challenger.

Division of labour, deliberately:
  * BULK (this module) feeds HISTORY - the corpus. Immutable: a closed quarter never changes.
  * The raw-XML parser (`form4_source`) stays the LIVE path, so today's scan reads filings the
    same way it always has. Bulk lags a quarter and cannot serve "what filed this morning".
  Both must produce the SAME feature shape - pinned by test, because train/serve drift here
  would be invisible and fatal.

Point-in-time discipline: FILING_DATE is the as-of key, never TRANS_DATE. An insider's trade on
the 2nd that reaches the SEC on the 4th was not knowable on the 3rd. Every window filters on
`filed <= as_of`, matching `form4_source.insider_window`.

Honesty properties carried over from the other sources: immutable disk cache; a transient
failure returns None and is NEVER cached; a genuinely empty answer IS cached as empty; a
`cached_only` read never touches the network and is all-or-nothing (a partial answer is None,
never a fabricated partial).
"""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

BULK_URL = ("https://www.sec.gov/files/structureddata/data/"
            "insider-transactions-data-sets/{quarter}_form345.zip")
DEFAULT_UA = "lyra-research admin@vivacity.dev"

# Open-market transactions only. P = open-market purchase, S = open-market sale. Everything else
# (A grants, F tax withholding, M option exercises, J other) is compensation plumbing, not
# conviction, and including it is the classic way to turn this signal into noise.
OPEN_MARKET_CODES = {"P", "S"}

_MONTHS = {m: i + 1 for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}


def parse_sec_date(raw: Optional[str]) -> Optional[str]:
    """SEC bulk dates are DD-MON-YYYY ('29-MAR-2024'). Return ISO, or None if unparseable -
    a row we cannot date is a row we cannot use point-in-time, so it is dropped, never guessed."""
    if not raw:
        return None
    parts = raw.strip().split("-")
    if len(parts) != 3:
        return None
    dd, mon, yyyy = parts
    m = _MONTHS.get(mon.upper()[:3])
    if not m:
        return None
    try:
        return date(int(yyyy), m, int(dd)).isoformat()
    except ValueError:
        return None


def quarters_between(start: str, end: str) -> list[str]:
    """['2015q3', '2015q4', ...] inclusive. Inputs are 'YYYYqN'."""
    def parse(q: str) -> tuple[int, int]:
        y, n = q.lower().split("q")
        return int(y), int(n)
    (y0, q0), (y1, q1) = parse(start), parse(end)
    out = []
    y, q = y0, q0
    while (y, q) <= (y1, q1):
        out.append(f"{y}q{q}")
        q += 1
        if q > 4:
            y, q = y + 1, 1
    return out


def _zip_path(cache_dir: str, quarter: str) -> str:
    return os.path.join(cache_dir, "insider-bulk", "zips", f"{quarter}_form345.zip")


def download_quarter(quarter: str, cache_dir: str, *, timeout: int = 180,
                     cached_only: bool = False) -> Optional[str]:
    """Fetch one quarterly bundle into the immutable cache; returns its path, or None on a
    transient failure (never cached). A closed quarter is immutable, so a cached file is never
    refetched."""
    path = _zip_path(cache_dir, quarter)
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        return path
    if cached_only:
        return None
    os.makedirs(os.path.dirname(path), exist_ok=True)
    url = BULK_URL.format(quarter=quarter)
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": os.environ.get("SEC_USER_AGENT", DEFAULT_UA)})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed SEC host
            blob = resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
        logger.warning("insider bulk %s: transient fetch failure (%s) - not cached", quarter, exc)
        return None
    if not blob.startswith(b"PK"):
        logger.warning("insider bulk %s: response is not a zip - not cached", quarter)
        return None
    tmp = path + ".part"
    with open(tmp, "wb") as fh:
        fh.write(blob)
    os.replace(tmp, path)
    logger.info("insider bulk %s: cached %.1f MB", quarter, len(blob) / 1e6)
    return path


def _read_tsv(z: zipfile.ZipFile, name: str):
    with z.open(name) as fh:
        yield from csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8", errors="replace"),
                                  delimiter="\t")


def parse_quarter(path: str) -> dict[str, list[dict]]:
    """One quarterly zip -> {issuer_cik: [transaction, ...]}.

    A transaction carries everything the feature layer needs and nothing it does not:
    filed (as-of key), trans_date, code, shares, price, usd, acquired ('A'/'D'), the owner's CIK
    (so distinct-insider CLUSTERS are countable), their relationship flags, and shares held after
    (so purchase size relative to an insider's own stake is computable)."""
    z = zipfile.ZipFile(path)
    subs: dict[str, dict] = {}
    for r in _read_tsv(z, "SUBMISSION.tsv"):
        filed = parse_sec_date(r.get("FILING_DATE"))
        cik = (r.get("ISSUERCIK") or "").lstrip("0")
        if filed and cik:
            subs[r["ACCESSION_NUMBER"]] = {
                "filed": filed, "cik": cik,
                "symbol": (r.get("ISSUERTRADINGSYMBOL") or "").strip().upper() or None,
            }
    owners: dict[str, list[dict]] = {}
    for r in _read_tsv(z, "REPORTINGOWNER.tsv"):
        rel = (r.get("RPTOWNER_RELATIONSHIP") or "")
        owners.setdefault(r["ACCESSION_NUMBER"], []).append({
            "owner_cik": (r.get("RPTOWNERCIK") or "").lstrip("0") or None,
            "is_officer": "Officer" in rel,
            "is_director": "Director" in rel,
            "is_ten_pct": "TenPercent" in rel,
            "title": (r.get("RPTOWNER_TITLE") or "").strip() or None,
        })

    def num(v) -> Optional[float]:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    out: dict[str, list[dict]] = {}
    for r in _read_tsv(z, "NONDERIV_TRANS.tsv"):
        code = (r.get("TRANS_CODE") or "").strip().upper()
        if code not in OPEN_MARKET_CODES:
            continue
        acc = r["ACCESSION_NUMBER"]
        sub = subs.get(acc)
        if not sub:
            continue
        shares, price = num(r.get("TRANS_SHARES")), num(r.get("TRANS_PRICEPERSHARE"))
        if shares is None or shares <= 0:
            continue
        own = (owners.get(acc) or [{}])[0]
        out.setdefault(sub["cik"], []).append({
            "filed": sub["filed"],
            "trans_date": parse_sec_date(r.get("TRANS_DATE")),
            "code": code,
            "acquired": (r.get("TRANS_ACQUIRED_DISP_CD") or "").strip().upper() or None,
            "shares": shares,
            "price": price,
            "usd": round(shares * price, 2) if price is not None else None,
            "owner_cik": own.get("owner_cik"),
            "is_officer": bool(own.get("is_officer")),
            "is_director": bool(own.get("is_director")),
            "is_ten_pct": bool(own.get("is_ten_pct")),
            "shares_after": num(r.get("SHRS_OWND_FOLWNG_TRANS")),
            "accession": acc,
        })
    return out


def compile_quarters(cache_dir: str, quarters: list[str], *, cached_only: bool = False) -> dict:
    """Download (unless cached_only) + parse the given quarters, then write ONE json per issuer
    CIK holding every open-market transaction we know about, sorted by filed date. Idempotent:
    re-running merges by accession + owner + transaction rather than duplicating."""
    by_cik: dict[str, dict[tuple, dict]] = {}
    done, missing = [], []
    for q in quarters:
        path = download_quarter(q, cache_dir, cached_only=cached_only)
        if not path:
            missing.append(q)
            continue
        for cik, txns in parse_quarter(path).items():
            slot = by_cik.setdefault(cik, {})
            for t in txns:
                slot[(t["accession"], t["owner_cik"], t["trans_date"], t["shares"], t["code"])] = t
        done.append(q)
    out_dir = os.path.join(cache_dir, "insider-bulk", "by-cik")
    os.makedirs(out_dir, exist_ok=True)
    written = 0
    for cik, slot in by_cik.items():
        path = os.path.join(out_dir, f"{cik}.json")
        merged = dict(slot)
        if os.path.exists(path):  # merge with prior quarters already compiled
            try:
                with open(path, encoding="utf-8") as fh:
                    for t in json.load(fh).get("transactions", []):
                        merged.setdefault(
                            (t["accession"], t.get("owner_cik"), t.get("trans_date"),
                             t.get("shares"), t.get("code")), t)
            except (OSError, ValueError):
                pass
        txns = sorted(merged.values(), key=lambda t: (t["filed"], t["accession"]))
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"cik": cik, "n": len(txns), "transactions": txns}, fh)
        written += 1
    logger.info("insider bulk: compiled %d quarters -> %d issuer files (missing quarters: %s)",
                len(done), written, missing or "none")
    return {"quarters_done": done, "quarters_missing": missing, "issuers": written}


def load_issuer_transactions(cik, cache_dir: str) -> Optional[list[dict]]:
    """Every cached open-market transaction for an issuer, or None when this CIK was never
    compiled (honestly unknown, never an empty-looking zero)."""
    if cik is None:
        return None
    path = os.path.join(cache_dir, "insider-bulk", "by-cik", f"{str(cik).lstrip('0')}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh).get("transactions", [])
    except (OSError, ValueError):
        return None


def insider_features_asof(cik, cache_dir: str, as_of: str, *, window_days: int = 90) -> Optional[dict]:
    """The rich insider feature block as it was knowable at `as_of`.

    This is the BUILD-BACKLOG T3 payload: the per-document path compressed 201,494 filings into
    two numbers (net USD and a filing count). These are the features the literature actually
    finds predictive - buy CLUSTERS across distinct insiders, role (officer conviction differs
    from 10%-owner rebalancing), size relative to the insider's own stake, and recency.

    Window is half-open `(as_of - window_days, as_of]` on FILED date, matching
    form4_source.insider_window. Returns None when the issuer was never compiled."""
    txns = load_issuer_transactions(cik, cache_dir)
    if txns is None:
        return None
    try:
        end = date.fromisoformat(as_of)
    except (TypeError, ValueError):
        return None
    start = end - timedelta(days=window_days)
    win = [t for t in txns
           if t.get("filed") and start < date.fromisoformat(t["filed"]) <= end]
    buys = [t for t in win if t["code"] == "P"]
    sells = [t for t in win if t["code"] == "S"]
    buy_usd = sum(t["usd"] for t in buys if t.get("usd"))
    sell_usd = sum(t["usd"] for t in sells if t.get("usd"))
    prior = [t for t in txns
             if t.get("filed") and date.fromisoformat(t["filed"]) <= end and t["code"] == "P"]
    last_buy = max((t["filed"] for t in prior), default=None)

    def stake_frac(t) -> Optional[float]:
        after, sh = t.get("shares_after"), t.get("shares")
        if after and sh and after > 0:
            return min(1.0, sh / after)
        return None

    fracs = [f for f in (stake_frac(t) for t in buys) if f is not None]
    return {
        # --- the two the old path had, preserved so the shapes stay comparable ---
        "insider_net_buy_usd": round(buy_usd - sell_usd, 2),
        "form4_filings_90d": len({t["accession"] for t in win}),
        # --- CLUSTER: the effect the literature documents ---
        "distinct_buyers": len({t["owner_cik"] for t in buys if t.get("owner_cik")}),
        "distinct_sellers": len({t["owner_cik"] for t in sells if t.get("owner_cik")}),
        # --- ROLE: an officer buying is not a 10% owner rebalancing ---
        "officer_buys": sum(1 for t in buys if t["is_officer"]),
        "director_buys": sum(1 for t in buys if t["is_director"]),
        "ten_pct_buys": sum(1 for t in buys if t["is_ten_pct"]),
        # --- CONVICTION SIZE + BALANCE ---
        "buy_usd": round(buy_usd, 2),
        "sell_usd": round(sell_usd, 2),
        "buy_sell_usd_ratio": round(buy_usd / sell_usd, 4) if sell_usd > 0 else None,
        "max_buy_stake_frac": round(max(fracs), 4) if fracs else None,
        # --- RECENCY ---
        "days_since_last_buy": (end - date.fromisoformat(last_buy)).days if last_buy else None,
        "window_days": window_days,
        "as_of": as_of,
        "source": "sec_bulk_form345",
    }
