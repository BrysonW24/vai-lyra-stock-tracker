import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Mail } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Support - ${BRAND_NAME}`,
  description: `Get help with ${BRAND_NAME}, report a problem, or request account deletion.`,
};

const SUPPORT_EMAIL = 'support@vivacityai.com.au';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8d3de]">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#a8b5c2]">{children}</div>
    </section>
  );
}

/**
 * Support page.
 *
 * Required by App Store Connect: every submission must carry a support URL, and a reviewer
 * opens it. This route did not exist until 2026-07-20 - /support returned a 307 to /welcome,
 * byte-identical to a nonsense path, so a status-code check reported it healthy while there
 * was nothing there.
 */
export default function SupportPage() {
  const updated = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main className="min-h-screen bg-[#070a0e] text-[#eef3f8]">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex items-center justify-between">
          <BrandLogo size={26} showWordmark />
          <Link href="/welcome" className="inline-flex items-center gap-1.5 text-sm text-[#a8b5c2] transition hover:text-[#eef3f8]">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-xs text-[#6f7d8a]">Last updated {updated}</p>

        <p className="mt-4 text-sm leading-relaxed text-[#a8b5c2]">
          {BRAND_NAME} is research software for tracking stock momentum. If something is broken,
          confusing, or wrong, we want to hear about it.
        </p>

        <div className="mt-6 rounded-xl border border-[#1b2732] bg-[#0c1218] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#eef3f8]">
            <Mail size={15} /> Contact us
          </div>
          <p className="mt-2 text-sm text-[#a8b5c2]">
            Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#5aa9ff] underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>
            . We aim to reply within two business days.
          </p>
        </div>

        <Section title="Reporting a problem">
          <p>To help us reproduce an issue quickly, include:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>What you were doing when it happened</li>
            <li>The ticker or screen involved, if relevant</li>
            <li>Your device and OS version</li>
            <li>A screenshot, if you have one</li>
          </ul>
        </Section>

        <Section title="Common questions">
          <p>
            <strong className="text-[#eef3f8]">Do I need an account?</strong> No. {BRAND_NAME} runs
            without one. Creating an account only adds syncing across devices.
          </p>
          <p>
            <strong className="text-[#eef3f8]">Where do the scores come from?</strong> A deterministic
            engine computes every number from published price and volume data using standard technical
            indicators. The optional AI layer only phrases the result in readable language; it never
            invents or adjusts a score.
          </p>
          <p>
            <strong className="text-[#eef3f8]">Is market data live?</strong> Market data may be delayed
            depending on the source. {BRAND_NAME} is a research tool, not a trading terminal.
          </p>
          <p>
            <strong className="text-[#eef3f8]">Is this financial advice?</strong> No. {BRAND_NAME} is
            informational research software. It does not take your personal circumstances into account,
            does not recommend trades, does not place orders, and is not connected to any brokerage.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            If you have not created an account, your data stays on your device. Removing the app removes
            it.
          </p>
          <p>
            If you have an account, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#5aa9ff] underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>{' '}
            from your registered address and we will delete it and confirm when it is done.
          </p>
        </Section>

        <Section title="More">
          <p className="flex gap-4">
            <Link href="/privacy" className="text-[#5aa9ff] underline underline-offset-2">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[#5aa9ff] underline underline-offset-2">
              Terms of Service
            </Link>
          </p>
        </Section>
      </div>
    </main>
  );
}
