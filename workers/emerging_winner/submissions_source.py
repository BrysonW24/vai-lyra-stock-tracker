"""
SEC EDGAR submissions per CIK - the identity-safe source that lights up TWO dark domains:

  * THEME: every issuer's SIC industry code (authoritative, CIK-keyed, assigned by the SEC) maps
    deterministically into the hot-theme vocabulary. Unlike the curated theme map - which was
    hand-picked with knowledge of who later won and is therefore banned from training - a SIC code
    is an administrative classification independent of outcomes, so it is honest for BOTH live scans
    and the historical corpus. (Caveat, stated not hidden: we read today's SIC; issuers rarely
    change SIC, but a reclassified company carries its current code into history.)
  * SPONSORSHIP (Form 4 index): the same submissions payload lists every filing with its date and
    accession number, giving a point-in-time Form 4 index per company - the key the insider-flow
    source (form4_source) uses to fetch only the documents it needs.

One fetch per CIK serves both, disk-cached. Pure derivations are separated from network fetches
(repo convention) and unit-tested without the network.
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Optional

from .universe_source import DEFAULT_UA

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"

# SIC -> hot-theme vocabulary. DELIBERATELY narrow: only codes whose industry IS the theme.
# No "software -> ai" stretches - a claim the classification cannot support is a mislabel, and the
# theme domain's whole job is structural membership, not vibes. Codes grouped by theme:
SIC_THEME_MAP: dict[int, list[str]] = {
    # Semiconductors + their manufacturing equipment
    3674: ["semiconductors"],           # Semiconductors & related devices
    3559: ["semiconductors"],           # Special industry machinery (semicap: AMAT/LRCX/KLAC class)
    # Aerospace / space / defence
    3721: ["aerospace", "defence"],     # Aircraft
    3724: ["aerospace", "defence"],     # Aircraft engines
    3728: ["aerospace", "defence"],     # Aircraft parts
    3760: ["space", "defence"],         # Guided missiles & space vehicles
    3761: ["space", "defence"],
    3764: ["space", "defence"],         # Space propulsion units
    3769: ["space", "defence"],         # Space vehicle equipment
    3812: ["defence"],                  # Search, detection, navigation, guidance systems
    3480: ["defence"],                  # Ordnance & accessories
    # Power / energy infrastructure
    4911: ["power"],                    # Electric services
    4931: ["power"],                    # Electric & other services combined
    3612: ["power", "infrastructure"],  # Power distribution & specialty transformers
    3621: ["power"],                    # Motors & generators
    1311: ["energy"],                   # Crude petroleum & natural gas
    2911: ["energy"],                   # Petroleum refining
    3511: ["power"],                    # Turbines & turbine generator sets
    # Compute / communications infrastructure
    3571: ["compute"],                  # Electronic computers
    3572: ["compute", "infrastructure"],  # Computer storage devices
}


def fetch_submissions(cik: int, *, timeout: int = 30, ua: Optional[str] = None) -> Optional[dict]:
    """Best-effort GET of the SEC submissions JSON for a CIK. None on any failure (offline,
    rate-limited, unknown CIK) so callers degrade to 'unavailable', never crash."""
    try:
        url = SUBMISSIONS_URL.format(cik=int(cik))
        req = urllib.request.Request(url, headers={"User-Agent": ua or os.environ.get("SEC_USER_AGENT", DEFAULT_UA)})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted SEC host
            return json.load(resp)
    except Exception:  # noqa: BLE001 - any failure means no submissions, stays unavailable
        return None


def compact_submissions(subs: Optional[dict]) -> dict:
    """Extract ONLY what the domains need from a submissions payload (which can be ~1MB): the SIC
    identity and the Form 4 filing index [(filingDate, accessionNumber)]."""
    if not subs:
        return {}
    out: dict = {}
    sic = subs.get("sic")
    try:
        out["sic"] = int(str(sic).strip()) if sic not in (None, "") else None
    except ValueError:
        out["sic"] = None
    out["sic_description"] = subs.get("sicDescription") or None
    recent = subs.get("filings", {}).get("recent", {})
    forms = recent.get("form") or []
    dates = recent.get("filingDate") or []
    accessions = recent.get("accessionNumber") or []
    docs = recent.get("primaryDocument") or []
    form4s: list[dict] = []
    for i, form in enumerate(forms):
        if form not in ("4", "4/A"):
            continue
        if i >= len(dates) or i >= len(accessions):
            continue
        form4s.append({
            "filed": str(dates[i]),
            "accession": str(accessions[i]),
            "doc": str(docs[i]) if i < len(docs) else "",
        })
    out["form4_index"] = form4s
    return out


def load_submissions_bundle(cik: int, cache_dir: str, *, timeout: int = 30,
                            ua: Optional[str] = None) -> Optional[dict]:
    """Compact submissions bundle for a CIK, disk-cached (identity + Form 4 index)."""
    os.makedirs(os.path.join(cache_dir, "submissions"), exist_ok=True)
    path = os.path.join(cache_dir, "submissions", f"{int(cik)}.json")
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                return data if data else None  # {} cached = known-empty
        except Exception:  # noqa: BLE001 - bad cache -> refetch
            pass
    bundle = compact_submissions(fetch_submissions(cik, timeout=timeout, ua=ua))
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(bundle, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass
    return bundle or None


def theme_context_from_sic(sic: Optional[int], sic_description: Optional[str] = None) -> Optional[dict]:
    """Pure: SIC code -> the theme_context the theme domain reads, or None when the code does not
    map into the hot-theme vocabulary (absent beats a present-but-zero read - an unmapped SIC means
    'hot-theme membership unknown', not 'no theme strength')."""
    if sic is None:
        return None
    themes = SIC_THEME_MAP.get(int(sic))
    if not themes:
        return None
    ctx: dict = {"themes": list(themes), "source": "sec_sic", "sic": int(sic)}
    if sic_description:
        ctx["sic_description"] = sic_description
    return ctx
