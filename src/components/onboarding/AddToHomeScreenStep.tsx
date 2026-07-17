'use client';

import Image from 'next/image';
import { Smartphone, Share, SquarePlus, BellRing, ArrowRight, CheckCircle2 } from 'lucide-react';
import { detectInstallPlatformFromBrowser } from '@/lib/install-platform';

/**
 * "Put Lyra on your Home Screen" - the final onboarding beat before the console. Functional,
 * not cosmetic: on iPhone, alert push notifications ONLY work once Lyra is installed to the
 * Home Screen, so the alerts the questionnaire just configured depend on this step. iOS gets
 * a real screenshot walkthrough (privacy-cropped), Android gets the Chrome steps. An
 * already-installed app gets a short "you're already set" confirmation - NEVER a silent skip:
 * an invisible beat makes the journey feel like it lost a step (founder-reported).
 */

const IOS_STEPS: Array<{ caption: React.ReactNode; src: string; width: number; height: number; alt: string }> = [
  {
    caption: (
      <>Tap the <span className="font-semibold text-[#eef3f8]">menu button</span> in Safari&apos;s toolbar, then tap{' '}
      <span className="font-semibold text-[#eef3f8]">Share</span>.</>
    ),
    src: '/onboarding/a2hs-1-menu.png',
    width: 640,
    height: 878,
    alt: 'Safari menu open with the Share row at the top',
  },
  {
    caption: (
      <>Scroll down the share sheet and tap{' '}
      <span className="font-semibold text-[#eef3f8]">Add to Home Screen</span>.</>
    ),
    src: '/onboarding/a2hs-2-share-sheet.png',
    width: 640,
    height: 461,
    alt: 'Share sheet actions list with Add to Home Screen at the bottom',
  },
  {
    caption: (
      <>Leave <span className="font-semibold text-[#eef3f8]">Open as Web App</span> switched on and tap{' '}
      <span className="font-semibold text-[#eef3f8]">Add</span>.</>
    ),
    src: '/onboarding/a2hs-3-add.png',
    width: 640,
    height: 514,
    alt: 'Add to Home Screen confirmation with the Lyra icon, Open as Web App on, and the Add button',
  },
  {
    caption: (
      <>That&apos;s it - <span className="font-semibold text-[#eef3f8]">Lyra lives on your Home Screen</span>, one tap
      away, with alerts that can reach you.</>
    ),
    src: '/onboarding/a2hs-4-installed.png',
    width: 560,
    height: 560,
    alt: 'The Lyra app icon installed on an iPhone Home Screen',
  },
];

export function AddToHomeScreenStep({ onDone }: { onDone: () => void }) {
  const platform = detectInstallPlatformFromBrowser();

  // Already running from the Home Screen: confirm it instead of teaching it - same beat count
  // as every other journey, with the payoff shot standing in for the walkthrough.
  if (platform === 'installed') {
    return (
      <div className="min-h-screen overflow-y-auto bg-[#07090c] text-[#eef3f8]">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#1d7f55]/50 bg-[#0d251b] text-[#43d18b] shadow-[0_0_40px_-12px_rgba(67,209,139,0.55)]">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Already on your Home Screen</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#a8b5c2]">
            You&apos;re running Lyra as an installed app - one tap away, full screen, and alerts can reach this phone.
          </p>
          <Image
            src="/onboarding/a2hs-4-installed.png"
            width={560}
            height={560}
            alt="The Lyra app icon installed on an iPhone Home Screen"
            className="mt-5 w-56 rounded-xl border border-[#1b2530]"
          />
          <button
            type="button"
            onClick={onDone}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1d7f55] bg-[#0d251b] px-4 py-3 text-[14px] font-semibold text-[#43d18b] transition hover:bg-[#103626]"
          >
            <SquarePlus size={16} /> Open my console <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#07090c] text-[#eef3f8]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#8aa2ff]/30 bg-[#101a2e] text-[#8aa2ff] shadow-[0_0_40px_-12px_rgba(138,162,255,0.55)]">
            <Smartphone size={26} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">One last thing - put Lyra on your Home Screen</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#a8b5c2]">
            One tap from your phone, full screen, no browser chrome.
          </p>
          <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg border border-[#5a4a1a] bg-[#231a08] px-3 py-2 text-left text-[11px] leading-snug text-[#f3a33a]">
            <BellRing size={13} className="mt-0.5 shrink-0" />
            <span>On iPhone, the alerts you just set up can only reach your phone once Lyra is on your Home Screen.</span>
          </p>
          <p className="mt-2 text-[11px] leading-snug text-[#6f7d8a]">
            Heads-up: the Home Screen app runs its own fresh session. Create your account here first - then sign in
            from the installed app and everything you just set up carries over.
          </p>
        </div>

        {/* Platform-specific instructions */}
        {platform === 'ios' && (
          <ol className="mt-6 space-y-5">
            {IOS_STEPS.map((step, i) => (
              <li key={step.src} className="rounded-xl border border-[#1b2530] bg-[#0b1016] p-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#8aa2ff]/40 bg-[#101a2e] font-mono text-[12px] font-bold text-[#8aa2ff]">
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed text-[#a8b5c2]">{step.caption}</p>
                </div>
                <Image
                  src={step.src}
                  width={step.width}
                  height={step.height}
                  alt={step.alt}
                  className="mt-3 w-full rounded-lg border border-[#263241]"
                  priority={i === 0}
                />
              </li>
            ))}
          </ol>
        )}

        {platform === 'android' && (
          <ol className="mt-6 space-y-3">
            <li className="flex items-start gap-2.5 rounded-xl border border-[#1b2530] bg-[#0b1016] p-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#8aa2ff]/40 bg-[#101a2e] font-mono text-[12px] font-bold text-[#8aa2ff]">1</span>
              <p className="text-[13px] leading-relaxed text-[#a8b5c2]">
                Tap Chrome&apos;s <span className="font-semibold text-[#eef3f8]">⋮ menu</span> (top right).
              </p>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl border border-[#1b2530] bg-[#0b1016] p-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#8aa2ff]/40 bg-[#101a2e] font-mono text-[12px] font-bold text-[#8aa2ff]">2</span>
              <p className="text-[13px] leading-relaxed text-[#a8b5c2]">
                Tap <span className="font-semibold text-[#eef3f8]">Add to Home screen</span> (or{' '}
                <span className="font-semibold text-[#eef3f8]">Install app</span>), then confirm.
              </p>
            </li>
          </ol>
        )}

        {platform === 'other' && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#1b2530] bg-[#0b1016] p-4">
            <Share size={15} className="mt-0.5 shrink-0 text-[#8aa2ff]" />
            <p className="text-[13px] leading-relaxed text-[#a8b5c2]">
              You&apos;re on a computer. Open <span className="font-mono text-[12px] text-[#eef3f8]">{typeof window !== 'undefined' ? window.location.host : 'Lyra'}</span>{' '}
              on your phone and this step will walk you through it there - that&apos;s where the alerts land.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onDone}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1d7f55] bg-[#0d251b] px-4 py-3 text-[14px] font-semibold text-[#43d18b] transition hover:bg-[#103626]"
          >
            <SquarePlus size={16} /> Done - open my console <ArrowRight size={15} />
          </button>
          <button type="button" onClick={onDone} className="min-h-[44px] text-[12px] text-[#6f7d8a] underline decoration-[#3a4754] underline-offset-4 transition hover:text-[#c8d3de]">
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}
