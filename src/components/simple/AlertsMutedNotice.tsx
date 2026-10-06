import Link from 'next/link';
import { BellOff, ArrowRight } from 'lucide-react';
import { describeMute } from '@/lib/alert-health';
import type { AlertHealth } from '@/lib/setup-status';
import { UnmuteAlertsButton } from '@/components/simple/UnmuteAlertsButton';

/**
 * Says, at the top of the home page, that alerts are muted - because a mute that nobody can see
 * is indistinguishable from a product that does not work. The operator's own account sat muted
 * for eleven weeks, ticked as "alerts set up", before this existed.
 *
 * Renders nothing unless an indefinite mute is on.
 */
export function AlertsMutedNotice({ alerts }: { alerts: AlertHealth | undefined }) {
  const mute = describeMute(alerts);
  if (!mute) return null;

  return (
    <section
      role="status"
      className="flex items-start gap-3 rounded-panel border border-accent-border/60 bg-accent-tint p-4"
    >
      <BellOff size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{mute.title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-2">{mute.detail}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <UnmuteAlertsButton />
          <Link
            href="/account/notifications"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent transition hover:underline"
          >
            Choose what reaches you first <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
