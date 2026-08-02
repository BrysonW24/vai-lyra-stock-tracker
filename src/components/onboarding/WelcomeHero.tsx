'use client';

import { Radar, Star, BriefcaseBusiness, Sparkles, ShieldCheck, type LucideIcon } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type PathId = 'quick_start' | 'watchlist_first' | 'portfolio_first' | 'full_setup';

interface WelcomeHeroProps {
  onChoosePath: (path: PathId) => void;
}

// These four boxes are feature highlights, not a choice - everyone goes through full
// setup. Each just gets an ambient pulsing glow so they read as live, not selectable.
const FEATURES: { title: string; description: string; icon: LucideIcon }[] = [
  { title: 'Scan the market', description: 'Start with the US tech 100 and explore signals now.', icon: Radar },
  { title: 'Build a watchlist', description: 'Track names you care about and get setup alerts.', icon: Star },
  { title: 'Add your portfolio', description: 'Bring in your holdings, P/L and risk.', icon: BriefcaseBusiness },
  { title: 'Full setup', description: 'Watchlist, portfolio, goals and alerts in one go.', icon: Sparkles },
];

export function WelcomeHero({ onChoosePath }: WelcomeHeroProps) {
  const soloMode = !isSupabaseConfigured();
  const features = FEATURES.map((feature) => {
    if (!soloMode) return feature;
    if (feature.title === 'Build a watchlist') {
      return {
        ...feature,
        description: 'Track names on this device and review their latest market snapshot.',
      };
    }
    if (feature.title === 'Full setup') {
      return {
        ...feature,
        description: 'Watchlist, portfolio, goals and preferences in one guided flow.',
      };
    }
    return feature;
  });

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-snug text-ink-2">
        {soloMode
          ? 'Track major US tech companies, your holdings and watchlist - with momentum changes visible whenever you open the console.'
          : 'Track major US tech companies, your holdings and watchlists - with momentum signals and account-backed alerts in one console.'}
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {features.map((feature, i) => (
          <div key={feature.title} className="relative">
            {/* Pulsing colour glow behind each box. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-panel bg-gradient-to-br from-blue-deep/30 via-positive/20 to-accent/30 blur-md animate-pulse"
              style={{ animationDuration: '3.6s', animationDelay: `${i * 0.45}s` }}
            />
            <div className="relative h-full overflow-hidden rounded-panel border border-line bg-panel-deep/90 p-2.5">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/25 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-cell bg-gradient-to-br from-blue-deep via-positive to-accent text-white shadow-[0_4px_12px_-4px_rgba(59,91,219,0.6)]">
                  <feature.icon size={15} />
                </span>
                <h3 className="text-[13px] font-semibold text-ink">{feature.title}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-cell border border-positive/30 bg-positive-tint px-3 py-2">
        <ShieldCheck size={14} className="shrink-0 text-positive" />
        <p className="text-[11px] leading-snug text-positive">
          {soloMode
            ? 'Solo saves your setup on this device only - no account or cloud profile.'
            : 'Your data stays private - used only to personalise your signals, risk states and alerts.'}
        </p>
      </div>

      <button
        onClick={() => onChoosePath('full_setup')}
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
