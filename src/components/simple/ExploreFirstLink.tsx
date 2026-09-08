'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

/**
 * "Look around first" - the deferred-onboarding door.
 *
 * Onboarding used to be a wall: nothing in the app opened until all ten beats were done.
 * The founder's call (2026-09-09) was to stop front-loading it - let people see the thing,
 * then offer the questions. This sets the explore cookie the middleware honours and drops
 * the visitor on the calm home page, where Simple view's checklist carries the beats.
 *
 * Nothing is skipped or lost: each beat still deep-links back into the real onboarding,
 * saves to the account, and ticks off when the underlying data actually exists.
 */
export function ExploreFirstLink({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = 'lyra_explore=1; path=/; max-age=31536000; samesite=lax';
        router.push('/');
      }}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-md border border-[#0E1E3A]/10 bg-white/70 px-5 py-3 text-sm font-medium text-[#0E1E3A] backdrop-blur transition hover:border-[#1E63FF]/30'
      }
    >
      Look around first <ArrowRight size={15} />
    </button>
  );
}
