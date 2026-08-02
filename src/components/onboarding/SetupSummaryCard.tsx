'use client';

import { Loader2 } from 'lucide-react';

import { OnboardingState, calculateSetupCompleteness } from '@/lib/onboarding';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface SetupSummaryCardProps {
  state: OnboardingState;
  onFinish: () => void;
  isSaving?: boolean;
}

export function SetupSummaryCard({ state, onFinish, isSaving }: SetupSummaryCardProps) {
  const soloMode = !isSupabaseConfigured();
  const completeness = calculateSetupCompleteness(state);
  const profile = state.profile;
  const beginnerLearningLabel = {
    plain_english: 'plain English',
    real_examples: 'real examples',
    step_by_step: 'step by step',
    just_signal: 'brief signals',
  }[profile?.beginnerLearningStyle ?? 'plain_english'];
  const beginnerHorizonLabel = {
    few_months: 'short horizon',
    year_or_two: '1-2 years',
    many_years: 'long term',
    unsure: 'horizon undecided',
  }[profile?.beginnerHorizon ?? 'unsure'];
  const profileStr =
    profile?.tradedBefore === 'no'
      ? ['new investor', beginnerLearningLabel, beginnerHorizonLabel].join(' · ')
      : profile?.experienceLevel
        ? [profile.experienceLevel, profile.investingStyle, profile.preferredTimeframe].filter(Boolean).join(' · ')
        : 'New to investing';
  const enriched = state.portfolio.filter((h) => h.quantity && h.averageBuyPrice).length;
  const alertsOn = [state.alerts?.strongSetupAlerts, state.alerts?.portfolioRiskAlerts, state.alerts?.dailyDigest].filter(
    Boolean,
  ).length;

  const rows: { label: string; value: string }[] = [
    { label: 'Profile', value: profileStr },
    { label: 'Coverage', value: 'US + ASX equities · hourly' },
    {
      label: 'Watchlist',
      value: state.watchlist.length ? `${state.watchlist.length} ticker${state.watchlist.length === 1 ? '' : 's'}` : 'none yet',
    },
    {
      label: 'Portfolio',
      value: state.portfolio.length
        ? `${state.portfolio.length} holding${state.portfolio.length === 1 ? '' : 's'}${enriched ? ` · ${enriched} priced` : ''}`
        : 'none yet',
    },
    {
      label: soloMode ? 'Signals' : 'Alerts',
      value: soloMode ? 'in-console only' : `${alertsOn} of 3 on`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-cell border border-line-strong bg-panel">
        <div className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{r.label}</span>
              <span className="truncate font-mono text-[12px] tabular-nums text-ink-title">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-cell border border-accent/60 bg-accent-tint/60 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Setup completeness</span>
          <span className="font-mono text-base font-bold tabular-nums text-accent">{completeness.percentage}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-line-strong bg-panel">
          <div className="h-full bg-gradient-to-r from-accent/70 to-accent" style={{ width: `${completeness.percentage}%` }} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-2">
          {soloMode
            ? 'Ready to scan. You can add holdings and trade snapshots anytime; Solo shows signal changes when you open the console.'
            : 'Ready to scan. You can add holdings, trade snapshots and tune alerts anytime from the dashboard.'}
        </p>
      </div>

      <button
        onClick={onFinish}
        disabled={isSaving}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSaving && <Loader2 size={16} className="animate-spin" />}
        {isSaving ? 'Starting scanner...' : 'Open command centre'}
      </button>
    </div>
  );
}
