import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Privacy Policy - ${BRAND_NAME}`,
  description: `How ${BRAND_NAME} collects, uses, and protects your data.`,
};

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

export default function PrivacyPage() {
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

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink-title">Privacy Policy</h1>
        <p className="mt-1 text-xs text-ink-dim">Last updated {updated}</p>

        <p className="mt-4 text-sm leading-relaxed text-ink-2">
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
          <p>To provide the service: personalise signals to what you own and watch, generate your daily brief, and deliver the alerts you opt into.</p>
          <p>When you use AI assistance, Lyra sends only the grounded dashboard/profile context needed for that response to the selected AI provider. Beta AI may use a server-side hosted OpenAI key, and any optional bring-your-own key stays browser-local.</p>
          <p>Free answers are written by an open-source model hosted by Cloudflare or Groq. Your question and the conversation so far are sent to whichever of them answers, together with what Lyra uses to ground the answer.</p>
          <p>Without an account, that is the market scan only. Your holdings, watchlist, cash and goal settings stay on your device unless you switch on &quot;Include my book&quot; in the chat; while it is on, each question carries your holdings with their quantities and average prices, your watchlist and its targets, and the cash, monthly contribution, position limit and goal you entered. With an account, each question carries your holdings and their profit or loss, your watchlist, your cash, goal, horizon and risk settings and, if you have chat memory switched on, your recent earlier questions and answers.</p>
          <p>Tapping &quot;Explain this setup&quot; sends that ticker&apos;s figures and nothing about you; tapping &quot;Write this brief in plain English&quot; sends the lines of the brief as shown. Cloudflare states that it neither trains on nor keeps this content; Groq states that it does not train on it and may keep request logs for up to 30 days. Neither is sent your name or email address. If you would rather they saw nothing, add your own model key in AI settings and your requests go only to the provider you chose.</p>
        </Section>

        <Section title="Your rights">
          <p>You can access and correct your information at any time in the app. You can delete your account, which cascades to remove your associated data (portfolio, watchlist, alerts, settings, and analytics references).</p>
          <p>{BRAND_NAME} operates with regard to the Australian Privacy Principles. You may request access to, correction of, or deletion of your data.</p>
        </Section>

        <Section title="Changes & contact">
          <p>We may update this policy as the product evolves; material changes will be reflected on this page. Questions about your data can be raised through the app.</p>
        </Section>

        <p className="mt-8 border-t border-line pt-4 text-[11px] text-ink-dim">
          {BRAND_NAME} provides information and analysis only. Nothing here is financial advice.
        </p>
      </div>
    </main>
  );
}
