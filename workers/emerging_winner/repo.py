"""
Persistence for the Emerging Winner Engine - writes runs + predictions to the immutable shadow-live
ledger (migration 056). Demo-safe: with no Supabase env it is disabled and every method is a no-op, so
`python -m workers.emerging_winner.main` runs keyless and simply prints (matching the whole product's
demo-first ethos).

Writes use the service-role key (bypasses RLS). Never expose the service-role key to the frontend.
"""
from __future__ import annotations

import logging
import os

from .engine import EmergingWinnerResult

logger = logging.getLogger("emerging_winner.repo")


class EmergingWinnerRepo:
    def __init__(self) -> None:
        self.client = None
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if url and key:
            try:
                from supabase import create_client
                self.client = create_client(url, key)
            except Exception as exc:  # pragma: no cover - env/dependency issue degrades to demo
                logger.warning("Supabase client unavailable, running in demo mode: %s", exc)
                self.client = None

    @property
    def enabled(self) -> bool:
        return self.client is not None

    def create_run(self, engine_version: str) -> str | None:
        if not self.client:
            return None
        res = (
            self.client.table("emerging_winner_runs")
            .insert({"engine_version": engine_version})
            .execute()
        )
        return str(res.data[0]["id"]) if res.data else None

    def save_predictions(self, run_id: str, results: list[EmergingWinnerResult]) -> int:
        """Append predictions to the immutable ledger. Returns the count written (0 in demo mode)."""
        if not self.client or not run_id:
            return 0
        rows = []
        for r in results:
            d = r.to_dict()
            rows.append({
                "run_id": run_id,
                "symbol": r.symbol,
                "engine_version": r.engine_version,
                "winner_similarity": d["winner_similarity"],
                "probability": d["probability"],
                "ordinal_stage": r.ordinal_stage,
                "stage_label": r.stage_label,
                "archetype": r.archetype,
                "archetype_confidence": r.archetype_confidence,
                "confidence": r.confidence,
                "completeness": d["completeness"],
                "domain_composite": d["domain_composite"],
                "risk_verdict": r.risk["verdict"],
                "risk_penalty": r.risk["penalty"],
                "priority_score": d["priority_score"],
                "action": r.action,
                "surfaced": r.surfaced,
                "timing_state": r.timing_state,
                "payload": d,
            })
        # Insert in chunks to stay well under any request-size limit; announce if we ever cap.
        written = 0
        for i in range(0, len(rows), 200):
            chunk = rows[i:i + 200]
            self.client.table("emerging_winner_predictions").insert(chunk).execute()
            written += len(chunk)
        return written

    def finish_run(self, run_id: str | None, results: list[EmergingWinnerResult]) -> None:
        if not self.client or not run_id:
            return
        surfaced = sum(1 for r in results if r.surfaced)
        blocked = sum(1 for r in results if not r.surfaced)
        # The runs header is mutable (only the ledger of predictions is immutable).
        self.client.table("emerging_winner_runs").update({
            "candidate_count": len(results),
            "surfaced_count": surfaced,
            "blocked_count": blocked,
        }).eq("id", run_id).execute()

    # --- reads (monitoring + training-dataset assembly) -------------------------------------------

    def fetch_predictions(self, limit: int = 1000) -> list[dict]:
        """Most-recent predictions from the immutable ledger (for monitoring + PIT training rows). []
        in demo mode. Includes id + payload so features@T can be rebuilt."""
        if not self.client:
            return []
        res = (
            self.client.table("emerging_winner_predictions")
            .select("id, symbol, predicted_at, probability, winner_similarity, ordinal_stage, "
                    "stage_label, completeness, payload")
            .order("predicted_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(res.data or [])

    def fetch_outcomes(self, limit: int = 5000) -> list[dict]:
        """Matured first-touch outcomes (the label side). [] in demo mode."""
        if not self.client:
            return []
        res = (
            self.client.table("emerging_winner_outcomes")
            .select("prediction_id, symbol, horizon_days, forward_return_pct, barrier_hit")
            .limit(limit)
            .execute()
        )
        return list(res.data or [])
