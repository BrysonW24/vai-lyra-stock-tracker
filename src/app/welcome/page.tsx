import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ArrowRight, BellRing, Gauge, Newspaper, ShieldCheck, Wallet } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { VersionBadge } from '@/components/VersionBadge';
import { BrandHeroGlass } from '@/components/BrandHeroGlass';
import { ArtisticTradingView } from '@/components/ArtisticTradingView';
import { PortfolioTile, BriefTile, AlertTile } from '@/components/FeatureTiles';
import { FutureStateAI } from '@/components/FutureStateAI';
import { ExchangeStrip } from '@/components/ExchangeStrip';
import { UltimateGoals } from '@/components/landing/UltimateGoals';
import { StackSection } from '@/components/landing/StackSection';
import { BRAND_NAME } from '@/lib/brand';
import { getWelcomeEntry } from '@/lib/welcome-entry';

export const metadata: Metadata = {
  // absolute: the landing page opts out of the root "%s · Lyra" template (no double brand).
  title: { absolute: `${BRAND_NAME} - see the setup first` },
  description: 'US tech signals - scored, explained, and overlaid on your book.',
};

// Light premium "Vivacity.ai" brand surface - the calm front door before the dark command
// centre. See onboarding-aesthetic-prompt.md. Palette grounded in the classic Vivacity mark:
// cream #F7F6F2 · navy #0E1E3A · electric blue #1E63FF · icy cyan #5BC8FF.
export default async function WelcomePage() {
  // When Supabase auth is configured, account creation is the start of setup (sign up -> confirm ->
  // onboard), and middleware gates /onboarding behind a signed-in user. In demo mode there's no auth,
  // so the CTA goes straight to onboarding (which the demo middleware allows). Picking the right
  // target here is what makes "Set up my console" actually work instead of bouncing to /welcome.
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const soloOnboarded = !supabaseConfigured && (await cookies()).get('lyra_onboarded')?.value === '1';
  const { href: setupHref, label: setupLabel } = getWelcomeEntry(supabaseConfigured, soloOnboarded);
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F6F2] text-[#0E1E3A]">
      {/* Ambient brand glow + light geometric texture - premium, never busy */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#1E63FF]/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-[#5BC8FF]/15 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-96 w-96 rounded-full bg-[#9CC2FF]/20 blur-3xl" />
        {/* Subtle dot-grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#0E1E3A_1px,transparent_1px)] opacity-[0.04] [background-size:22px_22px]" />
        {/* Glow anchoring the corner emanation */}
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#1E63FF]/15 blur-3xl" />
        {/* Radar emanation from the top-right corner - arcs + fine rays sweeping into view */}
        <svg className="absolute right-0 top-0 h-[34rem] w-[34rem]" viewBox="0 0 400 400" fill="none" aria-hidden="true">
          {[110, 180, 250, 320, 390].map((r) => (
            <circle key={r} cx="400" cy="0" r={r} stroke="#1E63FF" strokeOpacity="0.12" strokeWidth="1" />
          ))}
          {[[0, 90], [0, 250], [150, 400], [320, 400]].map(([x, y]) => (
            <line key={`${x}-${y}`} x1="400" y1="0" x2={x} y2={y} stroke="#1E63FF" strokeOpacity="0.08" strokeWidth="1" />
          ))}
          <circle cx="400" cy="0" r="6" fill="#1E63FF" fillOpacity="0.2" />
        </svg>
      </div>

      {/* Safe-area padding: the iOS shell sets contentInset 'never', so the web layer owns
          the insets. Only the VERTICAL pads fold env() in here (py-6) - body already carries
          padding-left/right: env(safe-area-inset-left/right) in globals.css, so repeating the
          horizontal insets here would double-pad the landscape notch ears. px-5 stays flat. */}
      <div
        className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        {/* Top bar - classic Vivacity.ai mark + Lyra product lockup, version badge on the right */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={34} />
            <span className="text-[17px] font-semibold tracking-tight text-[#0E1E3A]">{BRAND_NAME}</span>
          </div>
          <VersionBadge variant="light" showDate />
        </header>

        {/* Hero */}
        <section className="grid gap-x-10 gap-y-4 py-10 lg:flex-1 lg:items-center lg:grid-cols-2">
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
              See the setup<br /><span className="bg-gradient-to-r from-[#1E63FF] to-[#5BC8FF] bg-clip-text text-transparent">before everyone else.</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#5A6B82]">
              A deterministic console for US tech that finds <span className="font-medium text-[#1E63FF]">beaten-down names turning up</span> - not breakouts - scored, explained, and personal to your book.
            </p>

            {/* Glassmorphic value props on light - frosted white */}
            <div className="relative mt-6 max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white/60 p-4 shadow-[0_24px_70px_-30px_rgba(14,30,58,0.35)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
              <ul className="relative space-y-3">
                {[
                  { icon: Gauge, lead: <>The <span className="text-[#1E63FF]">maths</span> makes the call</>, body: 'every setup scored on RSI, MACD, trend & volume.' },
                  { icon: Wallet, lead: <>Your <span className="text-[#1E63FF]">book</span>, in context</>, body: 'your holdings and watchlist overlaid on every signal.' },
                  { icon: Newspaper, lead: <><span className="text-[#1E63FF]">Clarity</span>, every morning</>, body: "what's setting up, why it matters, what to watch." },
                  {
                    icon: BellRing,
                    lead: <><span className="text-[#1E63FF]">{supabaseConfigured ? 'Alerts' : 'Changes'}</span> worth your attention</>,
                    body: supabaseConfigured
                      ? 'strong setups and risk flags - delivered to your chosen channel.'
                      : 'strong setups and risk flags - visible when you open the console.',
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF] text-white shadow-[0_8px_18px_-6px_rgba(30,99,255,0.65)] ring-1 ring-white/40">
                      <item.icon size={16} strokeWidth={2} />
                    </span>
                    <p className="text-sm leading-snug">
                      <span className="font-semibold text-[#0E1E3A]">{item.lead}</span>
                      <span className="text-[#5A6B82]"> - {item.body}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href={setupHref} className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#07090c] shadow-[0_12px_30px_-10px_rgba(67,209,139,0.6)] transition hover:brightness-110">
                {setupLabel} <ArrowRight size={16} />
              </Link>
              {supabaseConfigured && (
                <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-md border border-[#0E1E3A]/10 bg-white/70 px-5 py-3 text-sm font-medium text-[#0E1E3A] backdrop-blur transition hover:border-[#1E63FF]/30">
                  Sign in
                </Link>
              )}
              {supabaseConfigured && (
                // See-before-signup doctrine: a cold visitor can walk the real console read-only
                // (via the lyra_demo cookie the middleware honours) before creating an account.
                <Link
                  href="/api/demo"
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-md border border-[#1E63FF]/25 bg-[#1E63FF]/5 px-5 py-3 text-sm font-medium text-[#1E63FF] backdrop-blur transition hover:border-[#1E63FF]/50"
                >
                  Explore the demo first
                </Link>
              )}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#8290a0]">
              <ShieldCheck size={12} /> Research only - not financial advice. {BRAND_NAME} never trades for you.
            </p>
            {!supabaseConfigured && (
              // Solo deployment: say the quiet part out loud - it is the whole point of this build.
              <>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8290a0]">
                  <ShieldCheck size={12} /> Solo build - no sign-in. First visit starts guided setup; after that, you enter your console directly.
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8290a0]">
                  <ShieldCheck size={12} /> Your book and trade log stay in this browser. AI uses the provider key you add.
                </p>
                <div className="mt-3 max-w-md rounded-xl border border-[#1E63FF]/15 bg-white/55 p-3 text-[11px] leading-relaxed text-[#5A6B82]">
                  <p>
                    <span className="font-semibold text-[#0E1E3A]">Solo:</span>{' '}
                    device-local data, no account, BYOK AI, and no background
                    notification delivery.
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-[#0E1E3A]">Community:</span>{' '}
                    sign-in, private cloud sync, and account-backed notification
                    channels.{' '}
                    <a
                      href="https://lyra.vivacityai.com.au"
                      className="font-semibold text-[#1E63FF] hover:underline"
                    >
                      Open Community
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Glass-perspective brand hero - matches the Vivacity.ai brand-image style */}
          <div id="hero-preview" className="-mt-14 flex min-w-0 scroll-mt-6 justify-center lg:mt-0 lg:justify-end">
            <BrandHeroGlass />
          </div>
        </section>

        {/* Why Lyra - artistic trading view + premium feature rows */}
        <section id="why" className="scroll-mt-6 py-12">
          <div className="mb-7 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1E63FF]">Why {BRAND_NAME}</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0E1E3A] md:text-3xl">The market, made <span className="text-[#1E63FF]">readable</span>.</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5A6B82]">Deterministic signals, your book overlaid, explained in plain English - the maths makes the call.</p>
          </div>
          <ExchangeStrip />
          <div className="grid items-stretch gap-5 lg:grid-cols-[1.35fr_1fr]">
            <ArtisticTradingView />
            <div id="lyra-tiles" className="grid scroll-mt-6 content-between gap-4">
              <PortfolioTile />
              <BriefTile />
              <AlertTile soloMode={!supabaseConfigured} />
            </div>
          </div>
        </section>

        {/* Future state - AI / LLM intelligence layer */}
        <section id="future" className="scroll-mt-6 pb-12">
          <FutureStateAI soloMode={!supabaseConfigured} />
        </section>

        {/* The ultimate goal - six flip cards, honest statuses (ported from the Setup Companion) */}
        <section id="goal" className="scroll-mt-6 pb-12">
          <UltimateGoals soloMode={!supabaseConfigured} />
        </section>

        {/* The stack - every technology with an honest cost badge */}
        <section id="stack" className="scroll-mt-6 pb-12">
          <StackSection soloMode={!supabaseConfigured} />
        </section>

        {/* Footer */}
        <footer className="mt-auto flex flex-col items-center gap-3 border-t border-[#0E1E3A]/10 pt-5 text-center text-[11px] text-[#8290a0]">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition hover:text-[#0E1E3A]">Privacy</Link>
            <Link href={setupHref} className="transition hover:text-[#0E1E3A]">{setupLabel}</Link>
          </div>
          <p>© {new Date().getFullYear()} {BRAND_NAME}. Research software, not a broker.</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#5A6772]">Built by</span>
            <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-md border border-black/5 bg-white shadow-sm">
              <Image src="/brand/vivacity-logo-classic.png" alt="Vivacity.ai" width={16} height={16} />
            </span>
            <span className="text-[11px] font-semibold text-[#0E1E3A]">Vivacity.ai</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
