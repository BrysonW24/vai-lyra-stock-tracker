# USAspending name bridge - feasibility probe for the government domain

Date: 2026-08-02. Status: empirical feasibility probe, no feature built. Question: can we
map public-company identities (SEC EDGAR titles, CIK-anchored, from `company_tickers.json`)
to USAspending.gov recipients via EXACT normalized-name matching, reliably enough to feed
`domain_government` in `workers/emerging_winner/domains.py` (today: "no USAspending /
SAM.gov awards pipeline yet")? Method and raw numbers below; verdict at the end.

## Method

- Universe source: `https://www.sec.gov/files/company_tickers.json` (10,412 tickers on
  2026-08-02), fetched with a research User-Agent.
- 25 probes in two groups: 15 likely federal contractors, 10 consumer/retail/app
  companies as a false-positive control.
- Normalization: uppercase; strip EDGAR state markers (`/DE/`); strip punctuation; drop
  leading `THE`; iteratively strip trailing suffix tokens (INC, CORP, CORPORATION, CO,
  COMPANY, LTD, PLC, LP, LLC, HOLDINGS, HOLDING, GROUP, USA, ...).
- Per probe, two USAspending calls (paced ~1.4 req/s, ~72 API calls total, no auth):
  - `POST /api/v2/autocomplete/recipient/` `{search_text, limit: 10}` - candidate names.
    Note: this endpoint now returns `uei: null` always (fields deprecated), so it is only
    useful for name discovery, not identity.
  - `POST /api/v2/recipient/` `{keyword, limit: 50, sort: "amount"}` - the real identity
    surface: recipient records with UEI, DUNS, recipient_level (P parent / C child / R),
    and lifetime obligation amount.
- "Exact match" = at least one returned recipient whose name normalizes byte-equal to the
  probe's normalized EDGAR title.
- For 5 matches, dated award history verified via
  `POST /api/v2/search/spending_by_award/`'s sibling
  `POST /api/v2/search/spending_by_transaction/` with fields
  `["Action Date", "Transaction Amount", "Recipient Name", "Award ID", "Awarding Agency"]`.

## Match table (all 25 probes)

Ambiguity = distinct recipient name strings that normalize to the probe's form (from the
top-50 keyword page). UEIs = distinct UEIs across those exact-normalized rows. Top amount
= largest lifetime obligation on any exact-normalized recipient record.

| Ticker | EDGAR title | Normalized | Match | Ambiguity | UEIs | Has UEI | Top amount |
|---|---|---|---|---|---|---|---|
| LMT | LOCKHEED MARTIN CORP | LOCKHEED MARTIN | yes | 2 | 29 | yes | 63.0B |
| NOC | NORTHROP GRUMMAN CORP /DE/ | NORTHROP GRUMMAN | yes | 1 | 1 | yes | 11.8B |
| GD | GENERAL DYNAMICS CORP | GENERAL DYNAMICS | yes | 1 | 1 | yes | 6.5B |
| LHX | L3HARRIS TECHNOLOGIES, INC. /DE/ | L3HARRIS TECHNOLOGIES | yes | 3 | 30 | yes | 6.2B |
| HII | HUNTINGTON INGALLS INDUSTRIES, INC. | HUNTINGTON INGALLS INDUSTRIES | yes | 1 | 1 | yes | 7.7B |
| BA | BOEING CO | BOEING | yes | 2 | 28 | yes | 26.0B |
| RTX | RTX Corp | RTX | yes | 2 | 3 | yes | 19.7B |
| LDOS | Leidos Holdings, Inc. | LEIDOS | yes | 3 | 17 | yes | 10.7B |
| BAH | Booz Allen Hamilton Holding Corp | BOOZ ALLEN HAMILTON | yes | 5 | 33 | yes | 6.7B |
| CACI | CACI INTERNATIONAL INC /DE/ | CACI INTERNATIONAL | yes | 1 | 1 | yes | 4.5B |
| SAIC | Science Applications International Corp | SCIENCE APPLICATIONS INTERNATIONAL | yes | 2 | 33 | yes | 4.0B |
| KTOS | KRATOS DEFENSE & SECURITY SOLUTIONS, INC. | KRATOS DEFENSE & SECURITY SOLUTIONS | yes | 1 | 2 | yes | 0 |
| AVAV | AeroVironment Inc | AEROVIRONMENT | yes | 3 | 5 | yes | 638.2M |
| RKLB | Rocket Lab Corp | ROCKET LAB | yes | 1 | 1 | yes | 25.4M |
| PLTR | Palantir Technologies Inc. | PALANTIR TECHNOLOGIES | yes | 1 | 1 | yes | 1.8B |
| LULU | lululemon athletica inc. | LULULEMON ATHLETICA | no | 0 | 0 | no | 0 |
| CMG | CHIPOTLE MEXICAN GRILL INC | CHIPOTLE MEXICAN GRILL | no | 0 | 0 | no | 0 |
| ETSY | ETSY INC | ETSY | no | 0 | 0 | no | 0 |
| DPZ | DOMINOS PIZZA INC | DOMINOS PIZZA | yes | 1 | 0 | no | 0 |
| CROX | Crocs, Inc. | CROCS | yes | 2 | 0 | no | 0 |
| WING | Wingstop Inc. | WINGSTOP | yes | 2 | 0 | no | 0 |
| ELF | e.l.f. Beauty, Inc. | E L F BEAUTY | no | 0 | 0 | no | 0 |
| CELH | Celsius Holdings, Inc. | CELSIUS | yes | 7 | 1 | yes | 0 |
| SHAK | Shake Shack Inc. | SHAKE SHACK | yes | 2 | 0 | no | 0 |
| DUOL | Duolingo, Inc. | DUOLINGO | yes | 1 | 1 | yes | 0 |

Contractor group: 15/15 exact-normalized matched, all with UEI-bearing recipient records.

## False-positive rate on the control group

Three tiers, because the raw number is misleading on its own:

- **Raw string match: 6/10 (60%).** DPZ, CROX, WING, CELH, SHAK, DUOL all found a
  recipient whose name normalizes to the EDGAR title.
- **After requiring a UEI on the matched record: 2/10 (20%).** The DPZ / CROX / WING /
  SHAK matches are UEI-less, $0 name shells - overwhelmingly franchisee DBA records
  (autocomplete shows the tell: "MEMAW'S SHAKE SHACK LLC", "ALFIEMATEN INC. DBA
  WINGSTOP", "1660 INC DBA DOMINOS PIZZA", "ARLIND'S SHAKE SHACK"). A UEI-required
  filter removes all four.
- **Wrong-company matches that survive the UEI filter: 1/10 (10%).** CELH is the real
  failure: stripping HOLDINGS from "Celsius Holdings, Inc." leaves the dictionary word
  CELSIUS, which exact-matches "CELSIUS GROUP" (a UEI-bearing, unrelated entity) plus six
  other Celsius-named strangers. DUOL's match ("DUOLINGO INC", UEI, $0 obligations) is
  almost certainly the actual company registered in SAM with no contract dollars - a true
  identity match that is harmless because the award totals are zero.

So the honest failure class is: suffix-stripping a two-token name down to one generic
dictionary token. Guard: never accept a match whose normalized form is a single common
word, or require a second corroborating signal (state/city from EDGAR submissions vs the
recipient profile) for one-token names.

## Dated award data: retrievable, with one big caveat

`POST /api/v2/search/spending_by_transaction/` returns exactly what point-in-time
discipline needs: per-transaction `Action Date`, `Transaction Amount`, `Recipient Name`,
`Award ID`, `Awarding Agency`, filterable by `time_period` (start/end on action date) and
sortable by Action Date. Verified live for Lockheed (DoD rows through 2025-12-31), Leidos
(DoD + GSA), Palantir, Rocket Lab (NASA + DoD), Kratos. Filtering to `action_date <= T`
is directly supported, so no lookahead leakage.

The caveat: the `recipient_search_text` filter is TOKEN-FUZZY, not exact. Querying
"PALANTIR TECHNOLOGIES" returned transactions for "PALANTIR USG INC"; querying "KRATOS
DEFENSE & SECURITY SOLUTIONS" returned "KRATOS ANTENNA SOLUTIONS CORPORATION". Good for
recall, fatal for precision if trusted blindly. An implementation must either
post-filter transactions on normalized `Recipient Name`, or better, resolve identity
first via `/api/v2/recipient/` and then filter awards by `recipient_id` (the recipient
hash), which `spending_by_award` supports natively.

## Identity risks found

1. **Subsidiary booking (false-negative severity).** Kratos is the proof: the parent
   name matches cleanly (2 UEIs at P level) but carries $0 lifetime obligations; the
   actual awards sit under "KRATOS ANTENNA SOLUTIONS CORPORATION" and sibling subs.
   Exact parent-name matching would score KTOS, a genuine defense contractor, as having
   near-zero federal business. Same pattern at Palantir ("PALANTIR USG INC" holds the
   DoD flow) and Rocket Lab ("ROCKET LAB NATIONAL SECURITY LLC" exists beside "ROCKET
   LAB USA INC"). Totals from exact matching are a floor, not the truth.
2. **Many UEIs per company name.** Lockheed Martin: 29 distinct UEIs across records
   normalizing to LOCKHEED MARTIN (272 keyword hits total); Booz Allen 33; SAIC 33;
   Boeing 28. USAspending's P/C hierarchy helps (parent rows roll up children), but a
   single company is a cloud of recipient records, not one row.
3. **Name-variant spelling.** "LOCKHEED MARTIN CORP" vs "LOCKHEED MARTIN CORPORATION"
   both exist as separate recipient records; normalization handles this class well.
4. **Franchise/DBA shells.** Consumer brand names exist as recipient strings created by
   unrelated small entities (the whole control-group story). UEI + nonzero obligations
   filters them out.
5. **Generic-word collisions after suffix stripping.** CELSIUS (from Celsius Holdings)
   is the one dangerous survivor; single-token normalized names need a stricter rule.
6. **Holding-company renames.** EDGAR titles move (Rocket Lab Corp was Rocket Lab USA,
   Inc.); the awards stay under the old operating-company name. Stripping USA as a
   suffix happened to bridge this one, but the class exists.
7. **Substring noise is not a risk with exact compare.** ETSY's keyword search returned
   1,236 hits (BETSY, NETSYNC...) and exact-normalized matching correctly kept zero.

## Verdict

Exact normalized-name matching is viable as a first honest pass, provided three cheap
guards ride along: (1) require the matched recipient record to carry a UEI, (2) require
either nonzero lifetime obligations or treat $0 matches as "registered, no awards",
and (3) refuse single-generic-token normalized names without a corroborating signal.
With those guards the probe shows 15/15 recall on true contractors and a 10% residual
wrong-company rate on adversarially chosen consumer names, whose worst-case damage is
attaching $0-obligation records anyway. Unmatched must stay None - never fuzzy-fill.
On the 991-name Gen-4 corpus, expect roughly 40-60% of names to resolve to a UEI-bearing
recipient at all (most small caps are not SAM-registered), and only around 15-30% to
carry nonzero contract dollars; both numbers are fine because `domain_government` is
designed to report "unavailable" honestly. Expect systematic undercounting for
conglomerates that book awards through subsidiaries (the KTOS pattern) - ship v1 with
totals labelled as a floor. Recommended implementation shape: a nightly bridge job that
(a) normalizes EDGAR titles, (b) resolves each through `/api/v2/recipient/` keyword
search + exact-normalized compare + the three guards, (c) persists a CIK -> [recipient_id,
UEI, name] mapping table with a matched/unmatched/ambiguous status per CIK, and then
(d) a separate award-fetch job that queries `spending_by_award` or
`spending_by_transaction` BY recipient_id (never by search text) with
`action_date <= T` windows, feeding `award_count` and `contract_value_usd` into the
government domain context. A later v2 can widen recall by walking parent-child recipient
hierarchies to capture subsidiary awards; that is an enhancement, not a prerequisite.

## Reproduction notes

- Probe scripts and raw JSON live in the session scratchpad (not committed):
  `probe_full.py`, `probe_results.json`, `award_verify.json`.
- Endpoints: `POST /api/v2/autocomplete/recipient/`, `POST /api/v2/recipient/`,
  `POST /api/v2/search/spending_by_transaction/` on `https://api.usaspending.gov`.
  No auth; ~72 total calls paced under 2 req/s.
- The `/api/v2/recipient/` `page_metadata.total` is a useful ambiguity prior: 272 hits
  for LOCKHEED MARTIN keyword, 546 for LEIDOS, 3 for the full Kratos name.
