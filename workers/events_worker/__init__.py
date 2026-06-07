"""
Horizon-2 EVENTS + IPO worker package.

Ingests calendar events (earnings, macro, product, conference) AND IPO calendar data,
computes deterministic event-risk levels, and persists to Supabase.

SINGLE-OPERATOR, research software (NOT advice).
Demo-safe: works with ZERO API keys (built-in demo events + IPOs).
Flips live only when FINNHUB_API_KEY env is present.
"""
