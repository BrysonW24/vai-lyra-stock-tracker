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
import { saveAlertPrefsWithStatus, type AlertMode } from '@/lib/alert-prefs';
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
import { ActivationSequence } from '@/components/activation/ActivationSequence';
import { LyraReveal } from '@/components/activation/LyraReveal';
import { SceneSlider } from '@/components/activation/SceneSlider';
import { SetupCompleteBeat } from '@/components/activation/SetupCompleteBeat';
import { AddToHomeScreenStep } from '@/components/onboarding/AddToHomeScreenStep';
import { DemoCarryoverConfirm } from '@/components/onboarding/DemoCarryoverConfirm';
import { saveDemoCarryover, loadDemoCarryover, clearDemoCarryover } from '@/lib/demo-carryover';

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
  const [phase, setPhase] = useState<'reveal' | 'primer' | 'questionnaire' | 'homescreen' | 'complete' | 'carryover'>('reveal');
  const [isSaving, setIsSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mount: resume from a saved checkpoint if one exists (so a returning user picks up where they
  // left off), otherwise start a fresh setup. Done in an effect (client-only) to avoid an SSR/
  // hydration mismatch from reading localStorage.
  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    // ?fresh=1 (the /api/demo reset switch) replays the journey from the very first beat:
    // drop the resume checkpoint so the reveal plays again instead of resuming mid-flow.
    if (params?.get('fresh') === '1') {
      clearOnboardingProgress();
    }
    // ?beat=homescreen deep-links straight to the Add-to-Home-Screen beat - for reviewing,
    // demos and screenshots without replaying the questionnaire. Preview-only convenience:
    // its onDone still runs the normal completion path.
    if (params?.get('beat') === 'homescreen') {
      setState(createInitialOnboardingState('full_setup'));
      setPhase('homescreen');
      setHydrated(true);
      return;
    }
    const saved = loadOnboardingProgress();
    const carried = isSupabaseConfigured() ? loadDemoCarryover() : null;
    if (saved) {
      setState(saved.state);
      setCurrentStep(saved.currentStep);
      setPhase(saved.phase);
    } else if (carried) {
      // Post-signup demo carryover: the visitor built a FULL setup in the read-only demo tour.
      // Rehydrate all of it and fast-path - skip the reveal + primer they already saw and land on
      // a one-tap "save your demo setup to your account" confirmation, instead of replaying the
      // whole questionnaire from scratch.
      setState(carried);
      setPhase('carryover');
      logActivation('demo_carryover_resumed');
    } else {
      const fresh = createInitialOnboardingState('full_setup');
      // Legacy fallback: an older demo visitor may carry local holdings/watchlist but no full
      // carryover snapshot. Prefill those two so finishing still uploads them to the account.
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

  // Checkpoint progress on every change so it's resumable; cleared on completion. The 'carryover'
  // fast-path is deliberately NOT checkpointed - its source of truth is the demo-carryover snapshot
  // (which drives the branch on mount), so persisting it to the resume checkpoint would be redundant
  // and could resurrect the confirm screen after the user has moved into the questionnaire.
  useEffect(() => {
    if (hydrated && state && phase !== 'complete' && phase !== 'carryover') {
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
  if (phase === 'homescreen') {
    // Final beat: put Lyra on the Home Screen (functional on iPhone - push alerts need it).
    // Clears the checkpoint on the way out so a later visit starts clean.
    return (
      <AddToHomeScreenStep
        onDone={() => {
          clearOnboardingProgress();
          setPhase('complete');
        }}
      />
    );
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

    // Demo tour on a CONFIGURED deploy: the visitor has the lyra_demo cookie but NO session, so
    // every cloud save would 401 - which used to block Finish forever with a retry error. The
    // demo tour skips cloud writes entirely (the local persistence below is the demo's truth)
    // and completes like the unconfigured demo does. A signed-in user never carries this cookie
    // through onboarding, so live saves are unaffected.
    const demoTour = typeof document !== 'undefined' && /(?:^|;\s*)lyra_demo=1(?:;|$)/.test(document.cookie);
    const localMode = !isSupabaseConfigured() || demoTour;

    // Collect REAL (non-demo) save failures. A 401 (server-side cookie not valid) or a 5xx must
    // NOT be swallowed - if any real failure lands we keep the resumable checkpoint and let the
    // user retry, instead of showing "You're all set" while their book silently dropped. Demo-mode
    // ({demo:true}) responses are expected and never count as failures.
    const realFailures: string[] = [];

    // Post one watchlist item; returns 'ok' | 'demo' | 'failed'. Demo never blocks completion.
    const postWatchlist = async (item: WatchlistItem): Promise<'ok' | 'demo' | 'failed'> => {
      if (demoTour) return 'demo'; // session-less tour: the local watchlist below is the truth
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
      if (isSupabaseConfigured() && !demoTour && state.profile) {
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
      if (isSupabaseConfigured() && !demoTour) {
        try {
          const supabase = createSupabaseBrowserClient();
          if (!supabase) {
            realFailures.push('your onboarding status');
          } else {
            const { error } = await supabase.auth.updateUser({ data: { onboarded: true } });
            if (error) {
              console.warn('Failed to mark account onboarded:', error.message);
              realFailures.push('your onboarding status');
            }
          }
        } catch (error) {
          console.warn('Failed to mark account onboarded:', error);
          realFailures.push('your onboarding status');
        }
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
      // Skipped on the session-less demo tour (would 401); saveLocalHoldings below is its truth.
      if (state.portfolio.length > 0 && !demoTour) {
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
      if (
        localMode &&
        !saveLocalHoldings(
          state.portfolio.map((holding) => ({
            symbol: holding.symbol,
            quantity: holding.quantity || 1,
            averageBuyPrice: holding.averageBuyPrice || 0,
            purchaseDate: holding.purchaseDate,
            notes: holding.notes,
          })),
        )
      ) {
        realFailures.push('your portfolio on this device');
      }

      // Same demo fallback for the watchlist (including typed universe tickers) - without
      // this, /api/watchlist answered {demo:true} and DROPPED every item while the banner
      // showed "Watchlist done". Live mode ignores it: the DB rows above are the truth.
      if (
        localMode &&
        !saveLocalWatchlist([
          ...state.watchlist.map((item) => ({
            symbol: item.symbol,
            targetBuyPrice: item.targetBuyPrice,
            notes: item.notes,
          })),
          ...dedupedCustomTickers.map((symbol) => ({ symbol })),
        ])
      ) {
        realFailures.push('your watchlist on this device');
      }

      // Seed the in-app alert controls from the onboarding alert choices - previously the
      // panel choices went nowhere in demo mode and the alert badge ignored them entirely.
      if (state.alerts) {
        const anyInstant =
          state.alerts.strongSetupAlerts || state.alerts.watchlistTriggerAlerts || state.alerts.portfolioRiskAlerts;
        const mode: AlertMode = localMode
          ? 'muted'
          : anyInstant
            ? 'live'
            : state.alerts.dailyDigest
              ? 'quiet'
              : 'muted';
        // Only the mode is a real, enforced preference now (the dead frequency/scope fields were
        // removed in the 2026-07-27 audit V6 fix). Onboarding's digest choices already drive the
        // server digest prefs separately; the alert mode is what the dispatch router reads.
        const alertPrefsSaved = saveAlertPrefsWithStatus({ mode });
        if (localMode && !alertPrefsSaved) realFailures.push('your alert preferences on this device');
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
      const summarySaved = saveOnboardingSummary({
        onboarded: true,
        tradedBefore: state.profile?.tradedBefore === 'no' ? 'no' : 'yes',
        portfolioCount: state.portfolio.length,
        watchlistCount: new Set([
          ...state.watchlist.map((item) => item.symbol.toUpperCase().trim()),
          ...dedupedCustomTickers,
        ]).size,
        experienceLevel: state.profile?.experienceLevel,
        riskComfort: state.profile?.riskComfort,
        capital: state.capital,
      });
      if (localMode && !summarySaved) {
        setSaveError(
          'We could not save your setup summary on this device. Your entries are kept - check browser storage permissions and tap Finish to retry.',
        );
        return;
      }

      if (localMode) {
        // Only stamp completion after every required browser write succeeds. Otherwise a private-
        // mode/quota failure would bypass onboarding on the next visit while silently losing data.
        document.cookie = 'lyra_onboarded=1; path=/; max-age=31536000; samesite=lax';
        document.cookie = 'lyra_demo_toured=1; path=/; max-age=31536000; samesite=lax';
        // Demo tour on a CONFIGURED deploy: snapshot the FULL setup (profile, strategy, universe,
        // watchlist, portfolio, capital, alerts) so signing up later rehydrates everything in one
        // tap - not just holdings/watchlist - instead of replaying the whole questionnaire.
        if (demoTour && isSupabaseConfigured()) {
          saveDemoCarryover(state, new Date().toISOString());
        }
      }

      // Onboarding done - drop the resumable checkpoint so a re-visit starts clean. (The
      // homescreen beat re-checkpoints itself so a closed tab resumes there; its onDone clears.)
      clearOnboardingProgress();
      // A real account save (live mode, not the session-less demo tour) has consumed any demo
      // carryover snapshot - drop it so it cannot rehydrate a future fresh onboarding on this device.
      if (isSupabaseConfigured() && !demoTour) {
        clearDemoCarryover();
      }
      logActivation('onboarding_finished', { path: state.path });

      // Saves done - one last beat teaches Add-to-Home-Screen (alerts on iPhone depend on it),
      // then the success beat hands off to the command centre.
      setPhase('homescreen');
    } finally {
      setIsSaving(false);
    }
  };

  // Fast-path for a post-signup demo visitor: one tap saves the setup they built in the demo to
  // their new account, no questionnaire replay. Rendered here (after handleFinish is defined)
  // because it wires straight into it; "Review & edit" drops into the normal prefilled flow.
  if (phase === 'carryover') {
    return (
      <DemoCarryoverConfirm
        state={state}
        saving={isSaving}
        error={saveError}
        onSave={handleFinish}
        onReview={() => {
          const steps = SETUP_PATHS[state.path].steps;
          setCurrentStep(steps[1] ?? steps[0]);
          setPhase('questionnaire');
        }}
      />
    );
  }

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
