'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme';

/**
 * Appearance control (Settings). Dark is Lyra's default; this offers the app-wide light theme.
 * Reads the stored theme on mount (the no-FOUC script already applied it to <html>), and writes
 * both localStorage and the <html> attribute on change so every token-driven surface re-themes.
 */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(getStoredTheme());
    setReady(true);
  }, []);

  function choose(next: Theme) {
    setThemeState(next);
    setTheme(next);
  }

  const options: { value: Theme; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
  ];

  return (
    <div className="glass-segment inline-flex gap-1 rounded-chip p-1" role="group" aria-label="Theme">
      {options.map((o) => {
        const active = ready && theme === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active ? 'glass-thumb text-ink' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            <Icon size={14} className={active ? 'text-accent' : ''} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
