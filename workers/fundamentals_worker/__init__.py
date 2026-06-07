"""
Horizon-2 FUNDAMENTALS worker.

Ingests company fundamentals, computes valuation metrics deterministically,
and persists to Supabase.

Demo-safe: returns deterministic demo fundamentals when FINNHUB_API_KEY is absent.
"""

__all__ = []
