'use client';

import Image from 'next/image';
import { Smartphone, Share, SquarePlus, BellRing, ArrowRight, CheckCircle2 } from 'lucide-react';
import { detectInstallPlatformFromBrowser } from '@/lib/install-platform';
import { isNativeShell } from '@/lib/native/platform';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * "Put Lyra on your Home Screen" - the final onboarding beat before the console. Functional,
 * not cosmetic: on iPhone, account-backed push notifications only work once Lyra is installed
 * to the Home Screen. Solo still benefits from one-tap, full-screen access but does not claim
 * background delivery. iOS gets a real screenshot walkthrough (privacy-cropped), Android gets
 * the Chrome steps. An
 * already-installed app gets a short "you're already set" confirmation - NEVER a silent skip:
 * an invisible beat makes the journey feel like it lost a step (founder-reported).
 */

const IOS_STEPS: Array<{ caption: React.ReactNode; src: string; width: number; height: number; alt: string; imgClass?: string }> = [
  {
    caption: (
      <>Tap the <span className="font-semibold text-ink">menu button</span> in Safari&apos;s toolbar, then tap{' '}
      <span className="font-semibold text-ink">Share</span>.</>
    ),
    src: '/onboarding/a2hs-1-menu.png',
    width: 640,
    height: 878,
    alt: 'Safari menu open with the Share row at the top',
    // Tall menu shot reads better small and centered than full-bleed (founder note).
    imgClass: 'mx-auto w-56',
  },
  {
    caption: (
      <>Scroll down the share sheet and tap{' '}
      <span className="font-semibold text-ink">Add to Home Screen</span>.</>
    ),
    src: '/onboarding/a2hs-2-share-sheet.png',
    width: 640,
    height: 461,
    alt: 'Share sheet actions list with Add to Home Screen at the bottom',
  },
  {
    caption: (
      <>Leave <span className="font-semibold text-ink">Open as Web App</span> switched on and tap{' '}
      <span className="font-semibold text-ink">Add</span>.</>
    ),
    src: '/onboarding/a2hs-3-add.png',
    width: 640,
    height: 514,
    alt: 'Add to Home Screen confirmation with the Lyra icon, Open as Web App on, and the Add button',
  },
  {
    caption: (
      <>That&apos;s it - <span className="font-semibold text-ink">Lyra lives on your Home Screen</span>, one tap
      away in a full-screen app window.</>
    ),
    src: '/onboarding/a2hs-4-installed.png',
    width: 560,
    height: 560,
    alt: 'The Lyra app icon installed on an iPhone Home Screen',
  },
];

export function AddToHomeScreenStep({ onDone }: { onDone: () => void }) {
  const platform = detectInstallPlatformFromBrowser();
  const soloMode = !isSupabaseConfigured();

  // Inside the native iOS shell there is nothing to install - teaching "Add to Home Screen"
  // would be nonsense. Same beat count as every other journey (never a silent skip), with a
  // confirmation standing in for the walkthrough. Direct isNativeShell() call is safe here:
  // this component only mounts client-side, after user interaction (same idiom as the
  // detectInstallPlatformFromBrowser call above).
  if (isNativeShell()) {
    return (
      <div className="min-h-screen overflow-y-auto bg-ground text-ink">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-panel border border-positive/40 bg-positive-tint text-positive shadow-[0_0_40px_-12px_rgba(67,209,139,0.55)]">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">You&apos;re already in the Lyra app</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            No install needed - Lyra is on this phone, one tap away, full screen.
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-cell border border-positive/40 bg-positive-tint px-4 py-3 text-[14px] font-semibold text-positive transition hover:bg-positive/20"
          >
            <SquarePlus size={16} /> Open my console <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // Already running from the Home Screen: confirm it instead of teaching it - same beat count
  // as every other journey, with the payoff shot standing in for the walkthrough.
  if (platform === 'installed') {
    return (
      <div className="min-h-screen overflow-y-auto bg-ground text-ink">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-panel border border-positive/40 bg-positive-tint text-positive shadow-[0_0_40px_-12px_rgba(67,209,139,0.55)]">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Already on your Home Screen</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            {soloMode
              ? 'You’re running Solo as an installed app - one tap away, full screen, with this device’s local console.'
              : 'You’re running Lyra as an installed app - one tap away, full screen, and alerts can reach this phone.'}
          </p>
          <Image
            src="/onboarding/a2hs-4-installed.png"
            width={560}
            height={560}
            alt="The Lyra app icon installed on an iPhone Home Screen"
            className="mt-5 w-56 rounded-panel border border-line"
          />
          <button
            type="button"
            onClick={onDone}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-cell border border-positive/40 bg-positive-tint px-4 py-3 text-[14px] font-semibold text-positive transition hover:bg-positive/20"
          >
            <SquarePlus size={16} /> Open my console <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-ground text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-panel border border-pending/30 bg-blue-tint text-pending shadow-[0_0_40px_-12px_rgba(138,162,255,0.55)]">
            <Smartphone size={26} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">One last thing - put Lyra on your Home Screen</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            One tap from your phone, full screen, no browser chrome.
          </p>
          <p className="mt-2 inline-flex items-start gap-1.5 rounded-cell border border-accent-border/60 bg-accent-tint px-3 py-2 text-left text-[11px] leading-snug text-accent">
            <BellRing size={13} className="mt-0.5 shrink-0" />
            <span>
              {soloMode
                ? 'Solo does not send background alerts. Installing it gives you faster access to the in-console signals stored on this device.'
                : 'On iPhone, the alerts you just set up can only reach your phone once Lyra is on your Home Screen.'}
            </span>
          </p>
          <p className="mt-2 text-[11px] leading-snug text-ink-dim">
            {soloMode
              ? 'Solo has no account or cloud sync. If the installed app opens with fresh storage, repeat the short setup there and add your AI key on that device.'
              : 'Heads-up: the Home Screen app runs its own fresh session. Create your account here first - then sign in from the installed app and everything you just set up carries over.'}
          </p>
        </div>

        {/* Platform-specific instructions */}
        {platform === 'ios' && (
          <ol className="mt-6 space-y-5">
            {IOS_STEPS.map((step, i) => (
              <li key={step.src} className="rounded-panel border border-line bg-chrome p-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-pending/40 bg-blue-tint font-mono text-[12px] font-bold text-pending">
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed text-ink-2">{step.caption}</p>
                </div>
                <Image
                  src={step.src}
                  width={step.width}
                  height={step.height}
                  alt={step.alt}
                  className={`mt-3 rounded-cell border border-line-strong ${step.imgClass ?? 'w-full'}`}
                  priority={i === 0}
                />
              </li>
            ))}
          </ol>
        )}

        {platform === 'android' && (
          <ol className="mt-6 space-y-3">
            <li className="flex items-start gap-2.5 rounded-panel border border-line bg-chrome p-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-pending/40 bg-blue-tint font-mono text-[12px] font-bold text-pending">1</span>
              <p className="text-[13px] leading-relaxed text-ink-2">
                Tap Chrome&apos;s <span className="font-semibold text-ink">⋮ menu</span> (top right).
              </p>
            </li>
            <li className="flex items-start gap-2.5 rounded-panel border border-line bg-chrome p-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-pending/40 bg-blue-tint font-mono text-[12px] font-bold text-pending">2</span>
              <p className="text-[13px] leading-relaxed text-ink-2">
                Tap <span className="font-semibold text-ink">Add to Home screen</span> (or{' '}
                <span className="font-semibold text-ink">Install app</span>), then confirm.
              </p>
            </li>
          </ol>
        )}

        {platform === 'other' && (
          <div className="mt-6 flex items-start gap-2.5 rounded-panel border border-line bg-chrome p-4">
            <Share size={15} className="mt-0.5 shrink-0 text-pending" />
            <p className="text-[13px] leading-relaxed text-ink-2">
              You&apos;re on a computer. Open <span className="font-mono text-[12px] text-ink">{typeof window !== 'undefined' ? window.location.host : 'Lyra'}</span>{' '}
              on your phone and this step will walk you through it there
              {soloMode
                ? ' - each browser or installed app keeps its own local Solo data.'
                : ' - that’s where the alerts land.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onDone}
            className="inline-flex w-full items-center justify-center gap-2 rounded-cell border border-positive/40 bg-positive-tint px-4 py-3 text-[14px] font-semibold text-positive transition hover:bg-positive/20"
          >
            <SquarePlus size={16} /> Done - open my console <ArrowRight size={15} />
          </button>
          <button type="button" onClick={onDone} className="min-h-[44px] text-[12px] text-ink-dim underline decoration-line-hair underline-offset-4 transition hover:text-ink-2">
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}
