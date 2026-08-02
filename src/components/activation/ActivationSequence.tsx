'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { prefersReducedMotion } from '@/lib/activation/animationTiming';
import { CalibrationShell } from './CalibrationShell';
import { SceneSlider } from './SceneSlider';
import { ChooseMarketAnimation } from './ChooseMarketAnimation';
import { MomentumAnimation } from './MomentumAnimation';
import { CommandCentreAnimation } from './CommandCentreAnimation';
import { PaperBotAnimation } from './PaperBotAnimation';
import { ModelsAnimation } from './ModelsAnimation';

type SceneId = 'choose-market' | 'read-momentum' | 'act-console' | 'paper-bot' | 'models' | 'ready';

interface Scene {
  id: SceneId;
  step: number;
}

const SCENES: Scene[] = [
  { id: 'choose-market', step: 1 },
  { id: 'read-momentum', step: 2 },
  { id: 'act-console', step: 3 },
  { id: 'paper-bot', step: 4 },
  { id: 'models', step: 5 },
  { id: 'ready', step: 6 },
];

/**
 * ActivationSequence: Master orchestrator for the Signal Calibration activation.
 * Manages scene state, timers, skip/replay logic, progress display, and scene wipes.
 * Respects prefers-reduced-motion and renders static explanation cards instead of animations.
 */
export function ActivationSequence({ mode = 'outro', onDone }: { mode?: 'intro' | 'outro'; onDone?: () => void }) {
  const router = useRouter();
  const reduced = prefersReducedMotion();

  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);

  const currentScene = SCENES[currentSceneIdx];
  const isLastScene = currentSceneIdx === SCENES.length - 1;

  // Scenes are advanced manually via the Continue button so each one can play out
  // fully and the user moves on when ready (no auto-cut).

  const handleAdvanceScene = () => {
    if (currentSceneIdx < SCENES.length - 1) {
      setCurrentSceneIdx(currentSceneIdx + 1);
    }
  };

  const handleBack = () => {
    if (currentSceneIdx > 0) {
      setCurrentSceneIdx(currentSceneIdx - 1);
      return;
    }
    // First scene: back to where we came from - the landing page for the intro primer.
    router.push(mode === 'intro' ? '/welcome' : '/');
  };

  const handleSkip = async () => {
    if (mode === 'intro' && onDone) {
      onDone();
      return;
    }
    await markActivationSeen();
    router.push('/');
  };

  const handleFinish = async () => {
    if (mode === 'intro' && onDone) {
      onDone();
      return;
    }
    await markActivationSeen();
    router.push('/');
  };

  const handleReplay = () => {
    setCurrentSceneIdx(0);
  };

  return (
    <CalibrationShell
      step={currentScene.step}
      totalSteps={SCENES.length}
      onSkip={handleSkip}
      showSkip={!isLastScene}
      onBack={handleBack}
      showBack
      onContinue={handleAdvanceScene}
      showContinue={!isLastScene}
      continueLabel={currentSceneIdx === SCENES.length - 2 ? 'Finish' : 'Continue'}
    >
      <SceneSlider sceneIndex={currentSceneIdx}>
        {/* Scene 1: Choose Market */}
        {currentScene.id === 'choose-market' && (
          <ChooseMarketAnimation
            onComplete={reduced ? handleAdvanceScene : undefined}
          />
        )}

        {/* Scene 2: Read Momentum */}
        {currentScene.id === 'read-momentum' && (
          <MomentumAnimation
            onComplete={reduced ? handleAdvanceScene : undefined}
          />
        )}

        {/* Scene 3: Act from Console */}
        {currentScene.id === 'act-console' && (
          <CommandCentreAnimation
            onComplete={reduced ? handleAdvanceScene : undefined}
          />
        )}

        {/* Scene 4: Paper Bot */}
        {currentScene.id === 'paper-bot' && (
          <PaperBotAnimation
            onComplete={reduced ? handleAdvanceScene : undefined}
          />
        )}

        {/* Scene 5: Models that earn their way */}
        {currentScene.id === 'models' && (
          <ModelsAnimation
            onComplete={reduced ? handleAdvanceScene : undefined}
          />
        )}

        {/* Scene 6: Ready (Final) */}
        {currentScene.id === 'ready' && (
          <div className="text-center max-w-2xl mx-auto w-full px-4">
            <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-4">
              {mode === 'intro' ? 'Build your command centre' : 'Command Centre Ready'}
            </h2>
            <p className="text-base md:text-lg text-ink-2 mb-8 leading-relaxed">
              {mode === 'intro'
                ? 'A couple of minutes to tailor Lyra to you - your market, your book, and how you want to be alerted.'
                : "Your scanner is active. We'll surface what changes, what matters and what deserves review."}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button
                onClick={handleFinish}
                className="px-6 py-3 rounded-cell bg-[image:var(--lyra-cta-gradient)] text-white text-sm font-semibold uppercase tracking-[0.16em] shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110 w-full md:w-auto"
              >
                {mode === 'intro' ? 'Set up my console' : 'Enter Command Centre'}
              </button>
              <button
                onClick={handleReplay}
                className="px-6 py-3 rounded-cell border border-line-strong bg-panel text-ink-2 text-sm font-semibold uppercase tracking-[0.16em] transition hover:text-ink w-full md:w-auto"
              >
                Replay
              </button>
            </div>
          </div>
        )}
      </SceneSlider>
    </CalibrationShell>
  );
}

/**
 * Mark activation sequence as seen in localStorage.
 * Guarded with try/catch for safety (localStorage may not be available in some contexts).
 */
async function markActivationSeen(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('lyra.activationSeen', 'true');
    }
  } catch (error) {
    console.error('Failed to mark activation as seen:', error);
  }
}
