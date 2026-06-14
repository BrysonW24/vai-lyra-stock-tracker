'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createInitialOnboardingState,
  SETUP_PATHS,
  ONBOARDING_STEPS,
  OnboardingState,
  SetupPath,
  PortfolioHolding,
  WatchlistItem,
  calculateSetupCompleteness,
} from '@/lib/onboarding';
import { syncOperatorProfile } from '@/lib/sync-onboarding';
import { saveLocalHoldings } from '@/lib/local-portfolio';
import { saveOnboardingSummary } from '@/lib/onboarding-summary';
import { loadOnboardingProgress, saveOnboardingProgress, clearOnboardingProgress } from '@/lib/onboarding-progress';
import { isSupabaseConfigured, createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { WelcomeHero } from '@/components/onboarding/WelcomeHero';
import { OperatorProfileForm } from '@/components/onboarding/OperatorProfileForm';
import { MarketUniverseSelector } from '@/components/onboarding/MarketUniverseSelector';
import { WatchlistBuilder } from '@/components/onboarding/WatchlistBuilder';
import { PortfolioBuilderTable } from '@/components/onboarding/PortfolioBuilderTable';
import { CapitalContextForm } from '@/components/onboarding/CapitalContextForm';
import { AlertPreferencePanel } from '@/components/onboarding/AlertPreferencePanel';
import { SetupSummaryCard } from '@/components/onboarding/SetupSummaryCard';
import { TradeSnapshotExplainer } from '@/components/onboarding/TradeSnapshotExplainer';
import { MomentumPulse } from '@/components/onboarding/MomentumPulse';
import { TickerConstellation } from '@/components/onboarding/TickerConstellation';
import { GlassPortfolioStack } from '@/components/onboarding/GlassPortfolioStack';
import { StrategyPicker, type StrategyValue } from '@/components/onboarding/StrategyPicker';
import { AiInsightStep } from '@/components/onboarding/AiInsightStep';
import { ActivationSequence } from '@/components/activation/ActivationSequence';
import { LyraReveal } from '@/components/activation/LyraReveal';
import { SceneSlider } from '@/components/activation/SceneSlider';
import { SetupCompleteBeat } from '@/components/activation/SetupCompleteBeat';

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [phase, setPhase] = useState<'reveal' | 'primer' | 'questionnaire' | 'complete'>('reveal');
  const [hydrated, setHydrated] = useState(false);

  // Mount: resume from a saved checkpoint if one exists (so a returning user picks up where they
  // left off), otherwise start a fresh setup. Done in an effect (client-only) to avoid an SSR/
  // hydration mismatch from reading localStorage.
  useEffect(() => {
    const saved = loadOnboardingProgress();
    if (saved) {
      setState(saved.state);
      setCurrentStep(saved.currentStep);
      setPhase(saved.phase);
    } else {
      setState(createInitialOnboardingState('full_setup'));
    }
    setHydrated(true);
  }, []);

  // Checkpoint progress on every change so it's resumable; cleared on completion.
  useEffect(() => {
    if (hydrated && state && phase !== 'complete') {
      saveOnboardingProgress({ state, currentStep, phase, savedAt: new Date().toISOString() });
    }
  }, [hydrated, state, currentStep, phase]);

  if (!hydrated || !state) {
    return null;
  }

  // Grand-opening Lyra reveal, then the feature primer, then the setup questionnaire.
  if (phase === 'reveal') {
    return <LyraReveal onDone={() => setPhase('primer')} />;
  }
  if (phase === 'primer') {
    return <ActivationSequence mode="intro" onDone={() => setPhase('questionnaire')} />;
  }
  if (phase === 'complete') {
    return <SetupCompleteBeat />;
  }

  // Disqualifier: a user who has never traded skips the portfolio (5) and
  // trade-snapshot (6) steps, since they have no holdings to enter.
  const neverTraded = state.profile?.tradedBefore === 'no';
  const effectiveSteps = neverTraded
    ? SETUP_PATHS[state.path].steps.filter((s) => s !== 5 && s !== 6)
    : SETUP_PATHS[state.path].steps;

  const stepIndex = effectiveSteps.indexOf(currentStep);
  const totalStepsInPath = effectiveSteps.length;
  const isLastStep = stepIndex === totalStepsInPath - 1;

  const handleChoosePath = (path: SetupPath) => {
    const steps = SETUP_PATHS[path].steps;
    // Mark Welcome (steps[0]) complete and advance to the first real step of the chosen path.
    setState({ ...createInitialOnboardingState(path), completedSteps: [steps[0]] });
    setCurrentStep(steps[1] ?? steps[0]);
  };

  const handleNext = () => {
    // Position-based within the effective (possibly disqualifier-trimmed) step list.
    const idx = effectiveSteps.indexOf(currentStep);
    const next = idx >= 0 ? effectiveSteps[idx + 1] ?? null : null;

    setState({ ...state, completedSteps: Array.from(new Set([...state.completedSteps, currentStep])) });
    if (next !== null) {
      setCurrentStep(next);
    }
  };

  const handleBack = () => {
    const idx = effectiveSteps.indexOf(currentStep);
    const prevStep = idx > 0 ? effectiveSteps[idx - 1] : null;
    if (prevStep !== null) {
      setCurrentStep(prevStep);
    } else {
      // First step: go back to the landing page we came from.
      router.push('/welcome');
    }
  };

  const handleFinish = async () => {
    // Show the success beat immediately; it navigates to the command centre when done.
    setPhase('complete');
    // Onboarding done - drop the resumable checkpoint so a re-visit starts clean.
    clearOnboardingProgress();
    // Sync operator profile and onboarding progress if Supabase is configured.
    if (isSupabaseConfigured() && state.profile) {
      const completeness = calculateSetupCompleteness(state);
      try {
        await syncOperatorProfile(state.profile, completeness.percentage);
      } catch (error) {
        console.warn('Failed to sync operator profile:', error);
        // Continue anyway - localStorage is the fallback.
      }
    }

    // Mark the account onboarded so the mandatory-onboarding gate releases.
    if (isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase?.auth.updateUser({ data: { onboarded: true } });
      } catch (error) {
        console.warn('Failed to mark account onboarded:', error);
      }
    } else {
      // Demo mode has no auth backend - persist the onboarded flag in a cookie the
      // middleware reads so the mandatory-onboarding gate releases on every route.
      document.cookie = 'lyra_onboarded=1; path=/; max-age=31536000; samesite=lax';
    }

    // Submit watchlist items
    for (const item of state.watchlist) {
      try {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: item.symbol,
            targetPrice: item.targetBuyPrice,
            targetSignalScore: item.targetSignalScore,
            notes: item.notes,
          }),
        });
      } catch (error) {
        console.error(`Failed to add ${item.symbol} to watchlist:`, error);
      }
    }

    // Submit portfolio holdings (ticker-only entries are valid per spec)
    for (const holding of state.portfolio) {
      try {
        await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: holding.symbol,
            quantity: holding.quantity || 1, // Default to 1 if not specified
            averageBuyPrice: holding.averageBuyPrice || 0, // Default to 0 if not specified
            purchaseDate: holding.purchaseDate,
            notes: holding.notes,
          }),
        });
      } catch (error) {
        console.error(`Failed to add ${holding.symbol} to portfolio:`, error);
      }
    }

    // Demo mode has no DB, so /api/portfolio above no-ops. Persist the entered holdings
    // locally so the command centre surfaces the user's real book, not the demo one.
    saveLocalHoldings(
      state.portfolio.map((holding) => ({
        symbol: holding.symbol,
        quantity: holding.quantity || 1,
        averageBuyPrice: holding.averageBuyPrice || 0,
        purchaseDate: holding.purchaseDate,
        notes: holding.notes,
      })),
    );

    // Snapshot the choices so the command centre personalises (no perpetual "New here?").
    saveOnboardingSummary({
      onboarded: true,
      tradedBefore: state.profile?.tradedBefore === 'no' ? 'no' : 'yes',
      portfolioCount: state.portfolio.length,
      watchlistCount: state.watchlist.length,
      experienceLevel: state.profile?.experienceLevel,
      riskComfort: state.profile?.riskComfort,
    });

    // Navigation to the command centre is handled by SetupCompleteBeat (shown above).
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: // Welcome
        return (
          <WelcomeHero onChoosePath={handleChoosePath} />
        );

      case 2: // Operator Profile
        return (
          <OperatorProfileForm
            profile={state.profile!}
            onChange={(profile) => setState({ ...state, profile })}
            onNext={handleNext}
          />
        );

      case 3: // Market Universe
        return (
          <MarketUniverseSelector
            selection={state.marketUniverse!}
            onChange={(selection) => setState({ ...state, marketUniverse: selection })}
            onNext={handleNext}
          />
        );

      case 10: // Trading Strategy
        return (
          <StrategyPicker
            value={state.strategy! as StrategyValue}
            onChange={(strategy) => setState({ ...state, strategy })}
            onNext={handleNext}
          />
        );

      case 4: // Watchlist - dedicated step
        return (
          <WatchlistBuilder
            watchlist={state.watchlist}
            onChange={(watchlist) => setState({ ...state, watchlist })}
            onNext={handleNext}
          />
        );

      case 5: // Holdings / portfolio - dedicated step (auto-skipped for never-traded)
        return (
          <PortfolioBuilderTable
            portfolio={state.portfolio}
            onChange={(portfolio) => setState({ ...state, portfolio })}
            onNext={handleNext}
          />
        );

      case 6: // Trade Snapshots
        return <TradeSnapshotExplainer onNext={handleNext} />;

      case 7: // Capital Context
        return (
          <CapitalContextForm
            capital={state.capital || {}}
            onChange={(capital) => setState({ ...state, capital })}
            onNext={handleNext}
          />
        );

      case 8: // Alerts
        return (
          <AlertPreferencePanel
            alerts={state.alerts!}
            onChange={(alerts) => setState({ ...state, alerts })}
            onNext={handleNext}
          />
        );

      case 11: // AI insights (optional)
        return <AiInsightStep onNext={handleNext} />;

      case 9: // Summary / Ready
        return <SetupSummaryCard state={state} onFinish={handleFinish} />;

      default:
        return <div>Unknown step</div>;
    }
  };

  const getVisual = () => {
    switch (currentStep) {
      case 1:
        return <MomentumPulse />;
      case 3:
        return <TickerConstellation />;
      case 5:
        return <GlassPortfolioStack />;
      default:
        return undefined;
    }
  };

  return (
    <OnboardingShell
      currentStep={currentStep}
      stepNumber={stepIndex + 1}
      totalSteps={totalStepsInPath}
      canGoBack={true}
      onBack={handleBack}
      visual={getVisual()}
      mobileVisual={currentStep === 1 || currentStep === 3 /* Welcome + Market Universe have headroom for a compact strip */}
    >
      <SceneSlider sceneIndex={stepIndex}>{renderStep()}</SceneSlider>
    </OnboardingShell>
  );
}
