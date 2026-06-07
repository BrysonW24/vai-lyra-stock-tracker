"""
Horizon-2 NEWS INTELLIGENCE worker.

Ingests company news, scores sentiment and relevance deterministically,
computes hype indices, and persists to Supabase.

Demo-safe: returns ~25 deterministic demo items when FINNHUB_API_KEY is absent.
"""

__all__ = []
