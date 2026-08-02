import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Terms of Service - ${BRAND_NAME}`,
  description: `The terms you agree to when using ${BRAND_NAME}.`,
};

const SUPPORT_EMAIL = 'support@vivacityai.com.au';

// PanelCard section (PATTERNS.md): soft glass panel, uppercase ink-title heading, ink-2 prose.
// Legal wording inside is verbatim - this wrapper is presentation only.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="terminal-panel-soft rounded-panel mt-4 p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/**
 * Terms of Service.
 *
 * Created 2026-07-20 alongside /support - both routes 307'd to /welcome, identically to a
 * nonsense path, so neither existed. A finance-category app needs its no-advice position
 * stated plainly somewhere durable, not only inside marketing copy.
 */
export default function TermsPage() {
  const updated = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main className="min-h-screen bg-ground text-ink">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex items-center justify-between">
          <BrandLogo size={26} showWordmark />
          <Link href="/welcome" className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-sm text-ink-2 transition hover:text-ink">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink-title">Terms of Service</h1>
        <p className="mt-1 text-xs text-ink-dim">Last updated {updated}</p>

        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          These terms apply when you use {BRAND_NAME}. By using it, you agree to them.
        </p>

        <Section title="Not financial advice">
          <p>
            {BRAND_NAME} is informational research software. It is <strong className="text-ink">not
            financial product advice</strong> and does not take your objectives, financial situation or
            needs into account.
          </p>
          <p>
            {BRAND_NAME} does not recommend trades, does not place orders, does not hold funds, and is
            not connected to any brokerage. Any decision you make with your money is yours alone. Consider
            obtaining advice from a licensed financial adviser before acting.
          </p>
        </Section>

        <Section title="About the data">
          <p>
            Scores are computed from published price and volume data using standard technical indicators.
            Market data may be delayed and may contain errors or gaps from upstream providers.
          </p>
          <p>
            Past movement does not indicate future performance. A momentum score describes what prices
            have already done; it does not predict what they will do.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>Do not use {BRAND_NAME} to break the law, and do not attempt to disrupt, overload, scrape at
            scale, or reverse engineer the service.</p>
        </Section>

        <Section title="Availability">
          <p>
            {BRAND_NAME} is provided on an as-is basis. We do not guarantee uninterrupted availability,
            and features may change or be withdrawn.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the extent permitted by law, we are not liable for any loss arising from your use of
            {' '}{BRAND_NAME}, including trading or investment losses. Nothing in these terms excludes any
            rights you have under the Australian Consumer Law that cannot lawfully be excluded.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms. Continuing to use {BRAND_NAME} after a change means you accept the
            updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-info underline underline-offset-2 transition hover:text-blue-focus">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="flex gap-4 pt-1">
            <Link href="/privacy" className="text-blue-info underline underline-offset-2 transition hover:text-blue-focus">
              Privacy Policy
            </Link>
            <Link href="/support" className="text-blue-info underline underline-offset-2 transition hover:text-blue-focus">
              Support
            </Link>
          </p>
        </Section>
      </div>
    </main>
  );
}
