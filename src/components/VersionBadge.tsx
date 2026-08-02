import Link from 'next/link';
import { APP_VERSION, APP_VERSION_DATE, formatVersionDate } from '@/lib/version';

/**
 * The current app version (optionally with its release date) as a small pill, linking to the in-app
 * changelog (/whats-new). Shown on the landing page so you can tell at a glance whether the deploy has
 * updated, and in the app. `variant` adapts it to the light landing surface vs the dark console.
 */
export function VersionBadge({
  variant = 'dark',
  showDate = false,
  className = '',
}: {
  variant?: 'light' | 'dark';
  showDate?: boolean;
  className?: string;
}) {
  // 'light' serves the light landing surface: blue-tint doubles as near-navy TEXT there,
  // white stays literal (the token palette is dark-console-first and has no light-surface set).
  const styles =
    variant === 'light'
      ? 'border-blue-tint/15 bg-white/60 text-blue-tint hover:border-blue/40'
      : 'border-line-strong bg-panel text-ink-2 hover:border-line-hair';
  return (
    <Link
      href="/whats-new"
      title={`Released ${formatVersionDate(APP_VERSION_DATE)} - see what's new`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide transition ${styles} ${className}`}
    >
      <span className={variant === 'light' ? 'text-blue' : 'text-positive'}>●</span>
      v{APP_VERSION}
      {showDate && <span className="opacity-60">· {formatVersionDate(APP_VERSION_DATE)}</span>}
    </Link>
  );
}
