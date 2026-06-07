import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Privacy Policy - ${BRAND_NAME}`,
  description: `How ${BRAND_NAME} collects, uses, and protects your data.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8d3de]">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#a8b5c2]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
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

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-xs text-[#6f7d8a]">Last updated {updated}</p>

        <p className="mt-4 text-sm leading-relaxed text-[#a8b5c2]">
          {BRAND_NAME} is research software for tracking US technology-stock momentum. It is not a broker, does not hold funds, and never places trades. This policy explains what we collect, why, and the control you have over it.
        </p>

        <Section title="What we collect">
          <p>Account details you provide at sign-up: email address and display name.</p>
          <p>Preferences you set: profile/onboarding answers, base currency, dashboard settings, and any optional community membership flag.</p>
          <p>Data you enter: your portfolio holdings and watchlist items.</p>
          <p>Delivery destination, only if you set up alerts: a Telegram chat ID or WhatsApp number. This is where alerts are sent and is visible only to you.</p>
          <p>Anonymous, aggregate usage analytics (via Vercel Web Analytics) - page views and interaction counts. No cookies, and no profiling of individuals.</p>
        </Section>

        <Section title="What we do not collect">
          <p>We do not collect bank, brokerage, or payment credentials. We do not access your trading accounts. We do not sell your data or use it for advertising.</p>
        </Section>

        <Section title="How your data is stored and protected">
          <p>Your private data is stored in a Postgres database (Supabase) protected by Row Level Security, which means each row is scoped to your account - other users cannot read or write your portfolio, watchlist, alerts, or settings.</p>
          <p>Server-side secrets (bot tokens, service keys) are never exposed to the browser. Market data (candles, indicators, signals) is shared, anonymous, and not linked to any user.</p>
        </Section>

        <Section title="How we use it">
          <p>To provide the service: personalise signals to what you own and watch, generate your daily brief, and deliver the alerts you opt into. We do not send your portfolio to any AI provider unless you explicitly enable AI assistance.</p>
        </Section>

        <Section title="Your rights">
          <p>You can access and correct your information at any time in the app. You can delete your account, which cascades to remove your associated data (portfolio, watchlist, alerts, settings, and analytics references).</p>
          <p>{BRAND_NAME} operates with regard to the Australian Privacy Principles. You may request access to, correction of, or deletion of your data.</p>
        </Section>

        <Section title="Changes & contact">
          <p>We may update this policy as the product evolves; material changes will be reflected on this page. Questions about your data can be raised through the app.</p>
        </Section>

        <p className="mt-8 border-t border-[#1b2530] pt-4 text-[11px] text-[#6f7d8a]">
          {BRAND_NAME} provides information and analysis only. Nothing here is financial advice.
        </p>
      </div>
    </main>
  );
}
