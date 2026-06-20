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
  const styles =
    variant === 'light'
      ? 'border-[#0E1E3A]/15 bg-white/60 text-[#0E1E3A] hover:border-[#1E63FF]/40'
      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754]';
  return (
    <Link
      href="/whats-new"
      title={`Released ${formatVersionDate(APP_VERSION_DATE)} - see what's new`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide transition ${styles} ${className}`}
    >
      <span className={variant === 'light' ? 'text-[#1E63FF]' : 'text-[#43d18b]'}>●</span>
      v{APP_VERSION}
      {showDate && <span className="opacity-60">· {formatVersionDate(APP_VERSION_DATE)}</span>}
    </Link>
  );
}
