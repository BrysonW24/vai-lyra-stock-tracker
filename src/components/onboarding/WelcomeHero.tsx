'use client';

import { ArrowRight, Radar, Star, BriefcaseBusiness, Sparkles, ShieldCheck, type LucideIcon } from 'lucide-react';

type PathId = 'quick_start' | 'watchlist_first' | 'portfolio_first' | 'full_setup';

interface WelcomeHeroProps {
  onChoosePath: (path: PathId) => void;
}

const PATHS: { id: PathId; title: string; description: string; icon: LucideIcon; recommended?: boolean }[] = [
  { id: 'quick_start', title: 'Scan the market', description: 'Start with the US tech 100 and explore signals now.', icon: Radar },
  { id: 'watchlist_first', title: 'Build a watchlist', description: 'Track names you care about and get setup alerts.', icon: Star },
  { id: 'portfolio_first', title: 'Add your portfolio', description: 'Bring in your holdings, P/L and risk.', icon: BriefcaseBusiness },
  { id: 'full_setup', title: 'Full setup', description: 'Watchlist, portfolio, goals and alerts in one go.', icon: Sparkles, recommended: true },
];

/**
 * Onboarding entry. Each path is a direct entry point - tapping a tile starts that flow
 * straight away (no select-then-continue). An ambient pulsing glow behind every tile
 * signals they are live features to choose from, not a single-select where one is picked.
 */
export function WelcomeHero({ onChoosePath }: WelcomeHeroProps) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-snug text-[#a8b5c2]">
        Track major US tech companies, your holdings and watchlists - momentum signals and alerts the moment
        something meaningful shifts, in one console.
      </p>

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5e6b78]">
        Pick where to start - you can do the rest anytime
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {PATHS.map((path, i) => (
          <div key={path.id} className="relative">
            {/* Ambient pulsing glow - these are live entry points, not a single select. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#3b5bdb]/25 via-[#43d18b]/15 to-[#f3a33a]/25 blur-md animate-pulse"
              style={{ animationDuration: '3.6s', animationDelay: `${i * 0.45}s` }}
            />
            <button
              type="button"
              onClick={() => onChoosePath(path.id)}
              className="group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]/90 p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#f3a33a]/50"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] text-white shadow-[0_4px_12px_-4px_rgba(59,91,219,0.6)]">
                  <path.icon size={15} />
                </span>
                <h3 className="text-[13px] font-semibold text-[#eef3f8]">{path.title}</h3>
                <ArrowRight size={13} className="ml-auto shrink-0 text-[#5e6b78] transition group-hover:translate-x-0.5 group-hover:text-[#f3a33a]" />
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[#8190a0]">{path.description}</p>
              {path.recommended && (
                <span className="mt-1.5 inline-flex w-fit items-center rounded-full border border-[#43d18b]/40 bg-[#0d251b] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-[#43d18b]">
                  Recommended
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[#1d4f3a] bg-[#0d251b] px-3 py-2">
        <ShieldCheck size={14} className="shrink-0 text-[#43d18b]" />
        <p className="text-[11px] leading-snug text-[#43d18b]">
          Your data stays private - used only to personalise your signals, risk states and alerts.
        </p>
      </div>
    </div>
  );
}
