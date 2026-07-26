'use client';

import { ArrowRight, Bell, ListChecks, ShieldCheck, Target, Wallet } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME } from '@/lib/brand';
import type { OnboardingState } from '@/lib/onboarding';

/**
 * Post-signup fast-path beat. A visitor who explored the read-only demo tour and then created an
 * account lands here instead of replaying the whole reveal -> primer -> questionnaire: their FULL
 * demo setup was snapshotted (demo-carryover) and rehydrated, so one tap saves it to the account.
 * "Review & edit" drops them into the normal (prefilled) questionnaire if they want to change it.
 */

const STRATEGY_LABELS: Record<string, string> = {
  'momentum-recovery': 'Momentum recovery',
  'breakout': 'Breakout',
  'trend-follow': 'Trend following',
  'mean-reversion': 'Mean reversion',
};

function strategyLabel(id?: string): string {
  if (!id) return 'Your strategy';
  return STRATEGY_LABELS[id] ?? id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DemoCarryoverConfirm({
  state,
  saving,
  error,
  onSave,
  onReview,
}: {
  state: OnboardingState;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onReview: () => void;
}) {
  const holdings = state.portfolio.length;
  const customTickers = (state.marketUniverse?.customTickers ?? []).filter(Boolean).length;
  const watchTickers = new Set([
    ...state.watchlist.map((w) => w.symbol.toUpperCase().trim()),
    ...(state.marketUniverse?.customTickers ?? []).map((t) => t.toUpperCase().trim()).filter(Boolean),
  ]).size;

  const rows = [
    holdings > 0
      ? { icon: Wallet, label: `${holdings} ${holdings === 1 ? 'holding' : 'holdings'}`, sub: 'your portfolio, valued in context' }
      : null,
    watchTickers > 0
      ? { icon: ListChecks, label: `${watchTickers} watchlist ${watchTickers === 1 ? 'ticker' : 'tickers'}`, sub: customTickers > 0 ? 'including the names you typed' : 'tracked for setups' }
      : null,
    { icon: Target, label: strategyLabel(state.strategy?.strategyId), sub: 'the lens the score is tuned to' },
    state.alerts
      ? { icon: Bell, label: 'Alert preferences', sub: 'what to flag, and how loud' }
      : null,
  ].filter(Boolean) as { icon: typeof Wallet; label: string; sub: string }[];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F6F2] text-[#0E1E3A]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#1E63FF]/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-32 h-96 w-96 rounded-full bg-[#5BC8FF]/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#0E1E3A_1px,transparent_1px)] opacity-[0.04] [background-size:22px_22px]" />
      </div>

      <div
        className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        <div className="w-full">
          <div className="mb-5 flex items-center gap-2.5">
            <BrandLogo size={34} />
            <span className="text-[17px] font-semibold tracking-tight text-[#0E1E3A]">{BRAND_NAME}</span>
          </div>

          <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight md:text-4xl">
            Welcome back.<br />
            <span className="bg-gradient-to-r from-[#1E63FF] to-[#5BC8FF] bg-clip-text text-transparent">
              Your demo setup is ready to keep.
            </span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5A6B82]">
            Everything you built while exploring is here. Save it to your account and it follows you
            across devices, with notifications switched on. Nothing to re-enter.
          </p>

          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/70 bg-white/60 p-4 shadow-[0_24px_70px_-30px_rgba(14,30,58,0.35)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            <ul className="relative space-y-3">
              {rows.map((row, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF] text-white shadow-[0_8px_18px_-6px_rgba(30,99,255,0.65)] ring-1 ring-white/40">
                    <row.icon size={16} strokeWidth={2} />
                  </span>
                  <p className="text-sm leading-snug">
                    <span className="font-semibold text-[#0E1E3A]">{row.label}</span>
                    <span className="text-[#5A6B82]"> - {row.sub}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#07090c] shadow-[0_12px_30px_-10px_rgba(67,209,139,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving your setup…' : <>Save to my account <ArrowRight size={16} /></>}
            </button>
            <button
              type="button"
              onClick={onReview}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-[#0E1E3A]/10 bg-white/70 px-5 py-3 text-sm font-medium text-[#0E1E3A] backdrop-blur transition hover:border-[#1E63FF]/30 disabled:opacity-60"
            >
              Review &amp; edit
            </button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#8290a0]">
            <ShieldCheck size={12} /> Saved privately to your account - visible only to you, never sold.
          </p>
        </div>
      </div>
    </main>
  );
}
