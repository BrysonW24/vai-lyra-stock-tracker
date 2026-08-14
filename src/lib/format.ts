import { formatDistanceToNowStrict } from 'date-fns';
import type { SignalStatus } from '@/types/scanner';

export function formatNumber(value: number, digits = 1): string {
  // Non-finite input reads as MISSING, never as a plausible zero - '0.0' masked upstream
  // data errors as real readings (RSI 0.0 looks like extreme oversold; 2026-08-11 audit).
  if (!Number.isFinite(value)) {
    return '-';
  }

  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatPercent(value: number, digits = 1): string {
  // '-' not '-%': unmeasured reads as missing, never as a unit with no number.
  if (!Number.isFinite(value)) return '-';
  return `${formatNumber(value, digits)}%`;
}

export function formatSignedNumber(value: number, digits = 1): string {
  // Unmeasured reads as missing, not as a signed zero-ish artefact ("+-" / "--").
  if (!Number.isFinite(value)) return '-';
  const formatted = formatNumber(Math.abs(value), digits);
  return `${value >= 0 ? '+' : '-'}${formatted}`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '-';
  return `${formatSignedNumber(value, digits)}%`;
}

export function formatCurrency(value: number, currency = 'USD'): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
}

/**
 * Compact currency for tight chips: $13,137.60 -> $13.1K, $1,234,567 -> $1.2M.
 * Small values keep full precision so prices still read normally.
 */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return formatCurrency(value);
}

export function relativeTime(isoDate: string | null): string {
  if (!isoDate) {
    return 'Not sent yet';
  }

  const date = new Date(isoDate);
  // Future instants read "in 10 hours", not "10 hours ago" - the unconditional suffix
  // inverted calendar events admitted by the wire's grace window (2026-08-11 audit).
  if (date.getTime() > Date.now()) {
    return `in ${formatDistanceToNowStrict(date)}`;
  }

  return `${formatDistanceToNowStrict(date)} ago`;
}

export function statusLabel(status: SignalStatus): string {
  const labels: Record<SignalStatus, string> = {
    strong_setup: 'Strong Setup',
    watchlist_setup: 'Watchlist Setup',
    no_signal: 'No Signal',
    weakening: 'Weakening',
    invalidated: 'Invalidated',
    overextended: 'Overextended',
  };

  return labels[status];
}

export function statusClass(status: SignalStatus): string {
  const classes: Record<SignalStatus, string> = {
    strong_setup: 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]',
    watchlist_setup: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
    no_signal: 'border-[#263241] bg-[#121923] text-[#8190a0]',
    weakening: 'border-[#854d0e] bg-[#2a1f0f] text-[#f8c46b]',
    invalidated: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]',
    overextended: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]',
  };

  return classes[status];
}

export function toneClass(value: number): string {
  if (value > 0) {
    return 'text-[#43d18b]';
  }

  if (value < 0) {
    return 'text-[#ff6b6b]';
  }

  return 'text-[#8190a0]';
}

export function trendArrow(value: number): string {
  if (value > 0) {
    return '↑';
  }

  if (value < 0) {
    return '↓';
  }

  return '→';
}

/**
 * Display form of a ticker symbol: trims the ASX exchange suffix so a holding
 * stored as "CBA.AX" (the full symbol is kept for data/fetching) reads simply as
 * "CBA". US class-share dots (e.g. BRK.B) are preserved - only ".AX" is stripped.
 */
export function displaySymbol(symbol: string): string {
  return symbol.replace(/\.AX$/i, '');
}
