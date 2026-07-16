'use client';

import { useEffect, useState } from 'react';
import {
  ANIMATION_TIMING,
  prefersReducedMotion,
} from '@/lib/activation/animationTiming';
import {
  ACTIVATION_SCENES,
  PORTFOLIO_EXAMPLE,
  WATCHLIST_EXAMPLE,
} from '@/lib/activation/activationSteps';
import { AnimatedTickerChip } from './AnimatedTickerChip';

interface ChooseMarketAnimationProps {
  onComplete?: () => void;
}

/**
 * Scene 1: Choose your market
 * Fade-in search box, glide ticker chips into Portfolio and Watchlist cards,
 * subtle pulsing radar rings behind. ~2.8s total.
 *
 * Reduced motion: static cards with chips listed.
 */
export function ChooseMarketAnimation({
  onComplete,
}: ChooseMarketAnimationProps) {
  const reduced = prefersReducedMotion();
  const scene = ACTIVATION_SCENES.chooseMarket;
  const [searchVisible, setSearchVisible] = useState(reduced);
  const [cardsVisible, setCardsVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) return;

    const searchTimer = setTimeout(
      () => setSearchVisible(true),
      ANIMATION_TIMING.scene1.searchFadeIn
    );
    const cardsTimer = setTimeout(
      () => setCardsVisible(true),
      ANIMATION_TIMING.scene1.cardSlideDelay
    );
    const completeTimer = onComplete
      ? setTimeout(
          onComplete,
          ANIMATION_TIMING.scene1.totalDuration
        )
      : undefined;

    return () => {
      clearTimeout(searchTimer);
      clearTimeout(cardsTimer);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [onComplete, reduced]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-semibold text-[#eef3f8] mb-2">
          {scene.title}
        </h2>
        <p className="text-sm md:text-base text-[#a8b5c2]">{scene.description}</p>
      </div>

      {/* Search Box */}
      <div
        className={`mb-8 transition-opacity duration-300 ${
          searchVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="terminal-panel px-4 py-3 rounded">
          <input
            type="text"
            placeholder="Search tickers, e.g. NVDA, AMD, MSFT..."
            className="w-full bg-transparent text-[#eef3f8] placeholder-[#8190a0] text-sm font-mono focus:outline-none"
            disabled
          />
        </div>
      </div>

      {/* Portfolio and Watchlist Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Portfolio Card */}
        <div
          className={`terminal-panel rounded px-4 py-4 transition-all duration-600 ${
            cardsVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transform: cardsVisible ? 'translateY(0)' : 'translateY(16px)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
              Portfolio
            </p>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-[#263241] text-[9px] text-[#60a5fa] font-mono">
              {PORTFOLIO_EXAMPLE.length}
            </span>
          </div>
          <div className="space-y-2">
            {PORTFOLIO_EXAMPLE.map((symbol, i) => (
              <AnimatedTickerChip
                key={symbol}
                symbol={symbol}
                delay={
                  ANIMATION_TIMING.scene1.chipGlideDelay +
                  i * 100
                }
                duration={ANIMATION_TIMING.scene1.chipGlideDuration}
                reduced={reduced}
              />
            ))}
          </div>
        </div>

        {/* Watchlist Card */}
        <div
          className={`terminal-panel rounded px-4 py-4 transition-all duration-600 ${
            cardsVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transform: cardsVisible ? 'translateY(0)' : 'translateY(16px)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
              Watchlist
            </p>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-[#263241] text-[9px] text-[#43d18b] font-mono">
              {WATCHLIST_EXAMPLE.length}
            </span>
          </div>
          <div className="space-y-2">
            {WATCHLIST_EXAMPLE.map((symbol, i) => (
              <AnimatedTickerChip
                key={symbol}
                symbol={symbol}
                delay={
                  ANIMATION_TIMING.scene1.chipGlideDelay +
                  (PORTFOLIO_EXAMPLE.length + i) * 100
                }
                duration={ANIMATION_TIMING.scene1.chipGlideDuration}
                reduced={reduced}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Background Radar Rings (subtle pulsing) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-10 -z-10">
        <svg
          className="w-96 h-96"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {[1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={40 + i * 30}
              stroke="rgba(96, 165, 250, 0.5)"
              strokeWidth="1"
              style={{
                animation: `radarPulse 2s ease-in-out infinite`,
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </svg>
        <style jsx>{`
          @keyframes radarPulse {
            0% {
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
