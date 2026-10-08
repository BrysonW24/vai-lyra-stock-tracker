import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, ShieldCheck, X } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { SubscribeForm } from '@/components/subscribe/SubscribeForm';
import { BRAND_NAME } from '@/lib/brand';
import { subscribeAvailability } from '@/lib/subscribe-server';

export const metadata: Metadata = {
  title: { absolute: `${BRAND_NAME} - the evening AI briefing, no account needed` },
  description: 'What moved in AI for investors, checked against the original sources, on Telegram or by email around 8pm Sydney.',
};

export const dynamic = 'force-dynamic';

interface SubscribePageProps {
  searchParams: Promise<{ confirmed?: string; unsubscribed?: string }>;
}

/**
 * The front door for people who do not want the app: one URL, three questions, Telegram or email.
 * Public (middleware allows /subscribe), light brand surface like /welcome. The confirmation and
 * unsubscribe links land back here with a one-line result.
 */
export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const { confirmed, unsubscribed } = await searchParams;
  const availability = subscribeAvailability();
  const banner =
    confirmed === '1'
      ? { ok: true, text: 'Confirmed - the briefing starts on the next weekday evening. Every email carries an unsubscribe link.' }
      : confirmed === '0'
        ? { ok: false, text: 'That confirmation link did not work - it may have expired or already been used. Subscribe again below.' }
        : unsubscribed === '1'
          ? { ok: true, text: 'Unsubscribed - Lyra will not email you again. Come back any time.' }
          : unsubscribed === '0'
            ? { ok: false, text: 'That unsubscribe link did not work. Reply to any briefing email and we will take you off by hand.' }
            : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F6F2] text-[#0E1E3A]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#1E63FF]/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-[#5BC8FF]/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#0E1E3A_1px,transparent_1px)] opacity-[0.04] [background-size:22px_22px]" />
      </div>

      <div
        className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <header className="flex items-center justify-between">
          <Link href="/welcome" className="flex items-center gap-2.5">
            <BrandLogo size={34} />
            <span className="text-[17px] font-semibold tracking-tight text-[#0E1E3A]">{BRAND_NAME}</span>
          </Link>
          <span className="text-xs text-[#5A6B82]">AI briefing · evenings</span>
        </header>

        <section className="py-10">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
            What moved in AI,
            <br />
            <span className="bg-gradient-to-r from-[#1E63FF] to-[#5BC8FF] bg-clip-text text-transparent">in your pocket by 8pm.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[#5A6B82]">
            Model releases, AI deals and listings, chips and data centres, the private companies worth knowing - researched from the web each evening and{' '}
            <span className="font-medium text-[#1E63FF]">checked against the original sources</span> before it reaches you. Your holdings first. No account, no app to learn.
          </p>

          {banner && (
            <p
              className={`mt-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                banner.ok ? 'border-[#43d18b]/40 bg-[#43d18b]/10 text-[#0E1E3A]' : 'border-[#f3a33a]/50 bg-[#f3a33a]/10 text-[#8a5a10]'
              }`}
              role="status"
            >
              {banner.ok ? <Check size={16} className="mt-0.5 shrink-0 text-[#1a9b62]" /> : <X size={16} className="mt-0.5 shrink-0" />}
              {banner.text}
            </p>
          )}

          <div className="relative mt-8 overflow-hidden rounded-2xl border border-white/70 bg-white/60 p-5 shadow-[0_24px_70px_-30px_rgba(14,30,58,0.35)] backdrop-blur-xl md:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            <SubscribeForm telegram={availability.telegram} email={availability.email} />
          </div>

          <div className="mt-8 grid gap-3 text-sm text-[#5A6B82] md:grid-cols-3">
            {[
              ['Source-checked', 'Every figure must appear on the page it was taken from, or the item is dropped before anyone sees it.'],
              ['Yours first', 'Items that touch what you hold lead; then the topics you chose; then the rest.'],
              ['Easy to leave', 'Reply STOP in Telegram, or tap the unsubscribe link in any email. Nothing to delete.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-[#0E1E3A]/10 bg-white/50 p-4">
                <p className="font-semibold text-[#0E1E3A]">{title}</p>
                <p className="mt-1 text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 flex items-center gap-1.5 text-[11px] text-[#5A6B82]">
            <ShieldCheck size={12} /> Research only - not financial advice. {BRAND_NAME} never trades for you. Want the full console?{' '}
            <Link href="/welcome" className="text-[#1E63FF] hover:underline">
              See the app
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
