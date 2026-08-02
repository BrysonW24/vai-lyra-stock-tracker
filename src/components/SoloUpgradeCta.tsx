'use client';

import { ArrowUpRight } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { shouldShowSoloUpgradeCta, soloUpgradeCtaEnabled } from '@/lib/flags';
import { communitySignupHref } from '@/lib/community';

/**
 * A Solo-only prompt to create a Community account for the capabilities Solo cannot offer on its
 * own (background notification delivery, cloud sync across devices).
 *
 * Renders ONLY when BOTH are true: this is a Solo deployment (no Supabase) AND the control is
 * armed (`soloUpgradeCtaEnabled`, i.e. NEXT_PUBLIC_SOLO_UPGRADE_CTA=1). Off by default, so it is
 * invisible until the founder switches it on per-deployment. The accounted build never shows it.
 */
export function SoloUpgradeCta({ headline, sub }: { headline?: string; sub?: string } = {}) {
  if (!shouldShowSoloUpgradeCta(isSupabaseConfigured(), soloUpgradeCtaEnabled())) return null;

  return (
    <div className="mt-3 rounded-panel border border-blue/30 bg-blue-tint p-3">
      <p className="text-sm font-semibold text-ink">
        {headline ?? 'Want notifications? Create a free account'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        {sub ??
          'Your Solo setup stays in this browser. A free Community account adds push, Telegram, WhatsApp and scheduled digests - plus private cloud sync across your devices.'}
      </p>
      <a
        href={communitySignupHref('solo')}
        className="mt-2.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-cell border border-blue/40 bg-blue/30 px-3 py-2 text-xs font-medium text-blue-info transition hover:bg-blue/40"
      >
        Create my account <ArrowUpRight size={13} />
      </a>
    </div>
  );
}
