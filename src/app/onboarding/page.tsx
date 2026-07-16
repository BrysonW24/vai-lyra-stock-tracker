'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createInitialOnboardingState,
  SETUP_PATHS,
  OnboardingState,
  SetupPath,
  WatchlistItem,
  calculateSetupCompleteness,
} from '@/lib/onboarding';
import { syncOperatorProfile } from '@/lib/sync-onboarding';
import { saveLocalHoldings, loadLocalHoldings } from '@/lib/local-portfolio';
import { saveLocalWatchlist, loadLocalWatchlist } from '@/lib/local-watchlist';
import { saveAlertPrefs, type AlertMode } from '@/lib/alert-prefs';
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

/** Fire-and-forget activation beacon (closed slug set; server no-ops in demo/anon). */
function logActivation(event: string, detail: { step?: number; path?: string } = {}): void {
  try {
    void fetch('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...detail }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry must never break the flow */
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [phase, setPhase] = useState<'reveal' | 'primer' | 'questionnaire' | 'complete'>('reveal');
  const [isSaving, setIsSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      const fresh = createInitialOnboardingState('full_setup');
      // Demo-to-account migration: a user who explored demo mode arrives here (post sign-up)
      // with a local book and watchlist in this browser. Prefill setup with them so finishing
      // onboarding uploads the demo data to the account instead of forcing a from-scratch
      // re-entry - previously everything they built in demo was simply lost.
      if (isSupabaseConfigured()) {
        const localHoldings = loadLocalHoldings();
        if (localHoldings.length > 0) {
          fresh.portfolio = localHoldings.map((holding) => ({
            symbol: holding.symbol,
            quantity: holding.quantity,
            averageBuyPrice: holding.averageBuyPrice,
            purchaseDate: holding.purchaseDate,
            notes: holding.notes,
          }));
        }
        const localWatch = loadLocalWatchlist();
        if (localWatch.length > 0) {
          fresh.watchlist = localWatch.map((item) => ({
            symbol: item.symbol,
            targetBuyPrice: item.targetBuyPrice,
            notes: item.notes,
          }));
        }
      }
      setState(fresh);
      logActivation('onboarding_started');
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

  const handleChoosePath = (path: SetupPath) => {
    const steps = SETUP_PATHS[path].steps;
    // Mark Welcome (steps[0]) complete and advance to the first real step of the chosen path.
    setState({ ...createInitialOnboardingState(path), completedSteps: [steps[0]] });
    setCurrentStep(steps[1] ?? steps[0]);
    logActivation('path_chosen', { path });
  };

  const handleNext = () => {
    // Position-based within the effective (possibly disqualifier-trimmed) step list.
    const idx = effectiveSteps.indexOf(currentStep);
    const next = idx >= 0 ? effectiveSteps[idx + 1] ?? null : null;

    setState({ ...state, completedSteps: Array.from(new Set([...state.completedSteps, currentStep])) });
    logActivation('step_completed', { step: currentStep, path: state.path });
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
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    // Collect REAL (non-demo) save failures. A 401 (server-side cookie not valid) or a 5xx must
    // NOT be swallowed - if any real failure lands we keep the resumable checkpoint and let the
    // user retry, instead of showing "You're all set" while their book silently dropped. Demo-mode
    // ({demo:true}) responses are expected and never count as failures.
    const realFailures: string[] = [];

    // Post one watchlist item; returns 'ok' | 'demo' | 'failed'. Demo never blocks completion.
    const postWatchlist = async (item: WatchlistItem): Promise<'ok' | 'demo' | 'failed'> => {
      try {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: item.symbol,
            targetPrice: item.targetBuyPrice,
            targetSignalScore: item.targetSignalScore,
            referencePrice: item.lastPrice,
            movementAlertPcts: item.alertPcts,
            notes: item.notes,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (body?.demo) return 'demo';
        // Treat a "already in your watchlist" duplicate as a soft success - the symbol is saved.
        if (typeof body?.error === 'string' && /already in your watchlist/i.test(body.error)) return 'ok';
        if (res.ok && body?.ok) return 'ok';
        console.error(`Failed to add ${item.symbol} to watchlist:`, body?.error || `HTTP ${res.status}`);
        return 'failed';
      } catch (error) {
        console.error(`Failed to add ${item.symbol} to watchlist:`, error);
        return 'failed';
      }
    };

    try {
      // Sync operator profile + capital + strategy + alerts so AI can ground on user constraints.
      if (isSupabaseConfigured() && state.profile) {
        const completeness = calculateSetupCompleteness(state);
        const result = await syncOperatorProfile(state.profile, completeness.percentage, {
          capital: state.capital,
          alerts: state.alerts,
          strategy: state.strategy,
        });
        if (!result.ok && !result.demo) {
          console.error('[onboarding] profile/capital/alerts did not save to the cloud:', result.error);
          realFailures.push('your profile and preferences');
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

      // Submit watchlist items, capturing each HTTP result so a 401 is not swallowed.
      let watchlistFailures = 0;
      for (const item of state.watchlist) {
        const outcome = await postWatchlist(item);
        if (outcome === 'failed') watchlistFailures += 1;
      }
      if (watchlistFailures > 0) {
        realFailures.push(`${watchlistFailures} watchlist ${watchlistFailures === 1 ? 'ticker' : 'tickers'}`);
      }

      // Persist the tickers the user TYPED in the market-universe step. These were collected but
      // never saved anywhere - convert them into watchlist inserts (deduped against tickers already
      // in the watchlist) using the same endpoint above so they are not silently lost.
      // NOTE: selectedCategories are intentionally NOT wired to a radar filter yet (deferred).
      const alreadyWatched = new Set(state.watchlist.map((w) => w.symbol.toUpperCase().trim()));
      const customTickers = (state.marketUniverse?.customTickers ?? [])
        .map((t) => t.toUpperCase().trim())
        .filter(Boolean)
        .filter((t) => !alreadyWatched.has(t));
      const dedupedCustomTickers = Array.from(new Set(customTickers));
      let customFailures = 0;
      for (const symbol of dedupedCustomTickers) {
        const outcome = await postWatchlist({ symbol });
        if (outcome === 'failed') customFailures += 1;
      }
      if (customFailures > 0) {
        realFailures.push(`${customFailures} typed ${customFailures === 1 ? 'ticker' : 'tickers'}`);
      }

      // Submit portfolio holdings using the atomic REPLACE endpoint, capturing the result.
      if (state.portfolio.length > 0) {
        try {
          const res = await fetch('/api/portfolio', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              holdings: state.portfolio.map(h => ({
                symbol: h.symbol,
                quantity: h.quantity || 1, // Will be validated by UI and API
                averageBuyPrice: h.averageBuyPrice || 0, // Will be validated by UI and API
                purchaseDate: h.purchaseDate,
                notes: h.notes,
              })),
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!body?.demo && !(res.ok && body?.ok)) {
            console.error('Failed to replace portfolio:', body?.error || `HTTP ${res.status}`);
            realFailures.push('your portfolio holdings');
          }
        } catch (error) {
          console.error('Failed to replace portfolio:', error);
          realFailures.push('your portfolio holdings');
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

      // Same demo fallback for the watchlist (including typed universe tickers) - without
      // this, /api/watchlist answered {demo:true} and DROPPED every item while the banner
      // showed "Watchlist done". Live mode ignores it: the DB rows above are the truth.
      saveLocalWatchlist([
        ...state.watchlist.map((item) => ({
          symbol: item.symbol,
          targetBuyPrice: item.targetBuyPrice,
          notes: item.notes,
        })),
        ...dedupedCustomTickers.map((symbol) => ({ symbol })),
      ]);

      // Seed the in-app alert controls from the onboarding alert choices - previously the
      // panel choices went nowhere in demo mode and the alert badge ignored them entirely.
      if (state.alerts) {
        const anyInstant =
          state.alerts.strongSetupAlerts || state.alerts.watchlistTriggerAlerts || state.alerts.portfolioRiskAlerts;
        const mode: AlertMode = anyInstant ? 'live' : state.alerts.dailyDigest ? 'quiet' : 'muted';
        saveAlertPrefs({
          mode,
          frequency: state.alerts.hourlyDigest ? '1h' : state.alerts.dailyDigest && !anyInstant ? 'digest' : '1h',
        });
      }

      // Any real save failure: do NOT advance to the success beat and do NOT clear the resumable
      // checkpoint. Surface an inline retry message so the user can press Finish again - their
      // entered data is still in state and still checkpointed.
      if (realFailures.length > 0) {
        setSaveError(
          `We could not save ${realFailures.join(', ')}. Your entries are kept - check your connection and tap Finish to retry.`,
        );
        return;
      }

      // Snapshot the choices so the command centre personalises (no perpetual "New here?").
      saveOnboardingSummary({
        onboarded: true,
        tradedBefore: state.profile?.tradedBefore === 'no' ? 'no' : 'yes',
        portfolioCount: state.portfolio.length,
        watchlistCount: state.watchlist.length,
        experienceLevel: state.profile?.experienceLevel,
        riskComfort: state.profile?.riskComfort,
      });

      // Onboarding done - drop the resumable checkpoint so a re-visit starts clean.
      clearOnboardingProgress();
      logActivation('onboarding_finished', { path: state.path });

      // Show the success beat only AFTER all saves are done; it navigates to the command centre when done.
      setPhase('complete');
    } finally {
      setIsSaving(false);
    }
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
        return (
          <div className="space-y-3">
            <SetupSummaryCard state={state} onFinish={handleFinish} isSaving={isSaving} />
            {saveError && (
              <p
                role="alert"
                className="rounded-md border border-[#7a2230] bg-[#2a1115] px-3 py-2 text-[12px] leading-snug text-[#ff8a8a]"
              >
                {saveError}
              </p>
            )}
          </div>
        );

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
