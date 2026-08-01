"""
SEC Form 4 insider flow - the SPONSORSHIP domain's first real data, CIK-safe like everything EDGAR.

Why this source matters: insider net buying is among the few public signals with genuine
asset-pricing evidence behind it, and Form 4 is its primary record - filed within 2 business days
of the trade, indexed per issuer CIK (no name matching, no mis-attribution risk).

Shape of the pipeline:
  1. The submissions bundle (submissions_source) carries the per-CIK Form 4 INDEX - filing dates +
     accession numbers - so we know exactly which documents exist without fetching any of them.
  2. For a window (trailing 90 days live; any [start, end] historically) we fetch ONLY those
     documents, parse the non-derivative open-market transactions (codes P = purchase, S = sale),
     and sum signed dollar value into `insider_net_buy_usd`.
  3. Parsed documents are disk-cached forever (a filed Form 4 never changes), so the historical
     corpus fill is a one-time fetch job, and nightly live scans touch only new filings.

Honesty notes:
  * A present index with NO filings in the window is a REAL zero (insiders reportably did nothing),
    not missing data - it is emitted as 0.0. Only a missing bundle/index reads as unavailable.
  * Grants, awards, option exercises and other non-discretionary codes are EXCLUDED - only open
    market P/S carry intent.
  * Point-in-time by `filed`: a backtest window uses filings FILED inside it, the same knowledge
    discipline as the EDGAR fundamentals.
"""
from __future__ import annotations

import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from typing import Optional

from .universe_source import DEFAULT_UA

FORM4_DOC_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/{doc}"

# Only discretionary open-market codes carry intent; everything else (A grants, M exercises,
# F tax withholding, G gifts...) is excluded from the net-buy read.
_BUY_SELL_CODES = {"P", "S"}


def _strip_xsl(doc: str) -> str:
    """primaryDocument often points at the styled view ('xslF345X05/form4.xml'); the raw XML is the
    same filename without the xsl prefix directory."""
    return doc.split("/")[-1] if doc else doc


def parse_form4_xml(text: str) -> dict:
    """Pure: one Form 4 XML -> {net_usd, buy_usd, sell_usd, n_transactions}. Unparseable or
    non-transactional documents produce zeros with n_transactions=0 (never a crash, never a guess)."""
    out = {"net_usd": 0.0, "buy_usd": 0.0, "sell_usd": 0.0, "n_transactions": 0}
    try:
        # Strip default namespaces so element names match regardless of schema version.
        cleaned = re.sub(r'xmlns="[^"]+"', "", text, count=1)
        root = ET.fromstring(cleaned)
    except ET.ParseError:
        return out

    def num(el) -> Optional[float]:
        if el is None:
            return None
        v = el.findtext("value") or el.text
        try:
            return float(str(v).replace(",", "").strip())
        except (TypeError, ValueError):
            return None

    for tx in root.iter("nonDerivativeTransaction"):
        code = (tx.findtext("transactionCoding/transactionCode") or "").strip().upper()
        if code not in _BUY_SELL_CODES:
            continue
        shares = num(tx.find("transactionAmounts/transactionShares"))
        price = num(tx.find("transactionAmounts/transactionPricePerShare"))
        acq = (tx.findtext("transactionAmounts/transactionAcquiredDisposedCode/value")
               or tx.findtext("transactionAmounts/transactionAcquiredDisposedCode") or "").strip().upper()
        if shares is None or price is None or acq not in ("A", "D"):
            continue
        usd = shares * price
        out["n_transactions"] += 1
        if acq == "A":
            out["buy_usd"] += usd
            out["net_usd"] += usd
        else:
            out["sell_usd"] += usd
            out["net_usd"] -= usd
    for k in ("net_usd", "buy_usd", "sell_usd"):
        out[k] = round(out[k], 2)
    return out


def fetch_form4_parsed(cik: int, accession: str, doc: str, cache_dir: str, *,
                       timeout: int = 30, ua: Optional[str] = None,
                       cached_only: bool = False) -> Optional[dict]:
    """Fetch + parse one Form 4, disk-cached forever (filed documents are immutable). None only on
    a fetch failure (transient - not cached), so a rate-limited night never poisons the cache.
    `cached_only=True` never touches the network - the corpus assembler uses it so historical
    sponsorship reads come exclusively from the pre-fetched fill (offline, reproducible)."""
    os.makedirs(os.path.join(cache_dir, "form4"), exist_ok=True)
    key = accession.replace("-", "")
    path = os.path.join(cache_dir, "form4", f"{key}.json")
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:  # noqa: BLE001 - bad cache -> refetch
            pass
    if cached_only:
        return None
    url = FORM4_DOC_URL.format(cik=int(cik), accession_nodash=key, doc=_strip_xsl(doc))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": ua or os.environ.get("SEC_USER_AGENT", DEFAULT_UA)})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted SEC host
            text = resp.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001 - transient fetch failure: do NOT cache as empty
        return None
    parsed = parse_form4_xml(text)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(parsed, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass
    return parsed


def insider_window(form4_index: list[dict], *, end: str, window_days: int = 90) -> list[dict]:
    """Pure: the index entries FILED inside (end - window_days, end] - the point-in-time window."""
    try:
        end_d = date.fromisoformat(str(end)[:10])
    except ValueError:
        return []
    start = (end_d - timedelta(days=window_days)).isoformat()
    return [e for e in form4_index or [] if start < e.get("filed", "") <= str(end)[:10]]


def sponsorship_features(cik: Optional[int], bundle: Optional[dict], cache_dir: str, *,
                         as_of: str, window_days: int = 90, max_docs: int = 6,
                         ua: Optional[str] = None, cached_only: bool = False) -> Optional[dict]:
    """The sponsorship dict the domain reads, or None when the Form 4 index itself is unavailable.

    A known-empty window is a REAL 0.0 (insiders reportably traded nothing). When more filings exist
    than `max_docs`, the MOST RECENT ones are read and the count notes the truncation - a bounded
    read is labelled, never silently passed off as complete. `cached_only=True` (corpus assembly)
    reads exclusively from the pre-fetched document cache and requires the WHOLE window to be
    readable - a partially-cached window is unavailable, never a biased partial sum."""
    if not cik or not bundle or "form4_index" not in bundle:
        return None
    window = insider_window(bundle["form4_index"], end=as_of, window_days=window_days)
    if not window:
        return {"insider_net_buy_usd": 0.0, "form4_filings_90d": 0}
    window = sorted(window, key=lambda e: e["filed"], reverse=True)
    if cached_only:
        # Point-in-time corpus read: every document in the window or nothing. A partial sum whose
        # missing docs correlate with anything (fetch order, filing size) is a quiet bias.
        net = 0.0
        for entry in window:
            parsed = fetch_form4_parsed(cik, entry["accession"], entry.get("doc", ""), cache_dir,
                                        cached_only=True)
            if parsed is None:
                return None
            net += parsed["net_usd"]
        return {"insider_net_buy_usd": round(net, 2), "form4_filings_90d": len(window)}
    truncated = len(window) > max_docs
    net = 0.0
    read = 0
    for entry in window[:max_docs]:
        parsed = fetch_form4_parsed(cik, entry["accession"], entry.get("doc", ""), cache_dir, ua=ua)
        if parsed is None:
            continue  # transient miss - skip, never fabricate
        net += parsed["net_usd"]
        read += 1
    if read == 0:
        return None  # nothing could actually be read this run - unavailable beats a fake zero
    out = {"insider_net_buy_usd": round(net, 2), "form4_filings_90d": len(window)}
    if truncated:
        out["form4_read_truncated_to"] = max_docs
    return out
