import type { Config } from 'tailwindcss';

/*
 * Tailwind mirror of the LYRA DESIGN TOKENS - v1.1.0 (2026-08-05).
 * Source of truth: lyra-ux/TOKENS.md + src/styles/lyra-tokens.css (same version).
 * v1.1.0 THEMING: colours reference the token RGB-channel vars via
 * `rgb(var(--lyra-x-rgb) / <alpha-value>)` - this keeps opacity modifiers (bg-panel/60)
 * working AND lets a light theme re-theme every utility by overriding the vars under
 * :root[data-theme="light"]. `node lyra-ux/check-tokens.mjs` enforces the mirror.
 * The pre-2026-08-02 "warm paper" palette was removed at v1.0.0; the real light palette
 * lives in lyra-tokens.css (light block), not here.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // rgb(var(--lyra-x-rgb) / <alpha-value>): opacity modifiers work AND the token re-themes
        // when :root[data-theme="light"] overrides the channel vars. Var names are spelled out (not
        // built from a helper) so lyra-ux/check-tokens.mjs can verify each reference in the file text.
        ground: 'rgb(var(--lyra-ground-rgb) / <alpha-value>)',
        chrome: 'rgb(var(--lyra-chrome-rgb) / <alpha-value>)',
        panel: {
          DEFAULT: 'rgb(var(--lyra-panel-rgb) / <alpha-value>)',
          deep: 'rgb(var(--lyra-panel-deep-rgb) / <alpha-value>)',
        },
        well: 'rgb(var(--lyra-well-rgb) / <alpha-value>)',
        line: {
          DEFAULT: 'rgb(var(--lyra-line-rgb) / <alpha-value>)',
          strong: 'rgb(var(--lyra-line-strong-rgb) / <alpha-value>)',
          hair: 'rgb(var(--lyra-hairline-rgb) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--lyra-ink-rgb) / <alpha-value>)',
          title: 'rgb(var(--lyra-ink-title-rgb) / <alpha-value>)',
          '2': 'rgb(var(--lyra-ink-2-rgb) / <alpha-value>)',
          '3': 'rgb(var(--lyra-ink-3-rgb) / <alpha-value>)',
          dim: 'rgb(var(--lyra-ink-dim-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--lyra-accent-rgb) / <alpha-value>)',
          border: 'rgb(var(--lyra-accent-border-rgb) / <alpha-value>)',
          tint: 'rgb(var(--lyra-accent-tint-rgb) / <alpha-value>)',
        },
        positive: {
          DEFAULT: 'rgb(var(--lyra-positive-rgb) / <alpha-value>)',
          tint: 'rgb(var(--lyra-positive-tint-rgb) / <alpha-value>)',
        },
        negative: {
          DEFAULT: 'rgb(var(--lyra-negative-rgb) / <alpha-value>)',
          soft: 'rgb(var(--lyra-negative-soft-rgb) / <alpha-value>)',
        },
        pending: 'rgb(var(--lyra-pending-rgb) / <alpha-value>)',
        blue: {
          DEFAULT: 'rgb(var(--lyra-blue-rgb) / <alpha-value>)',
          deep: 'rgb(var(--lyra-blue-deep-rgb) / <alpha-value>)',
          info: 'rgb(var(--lyra-blue-info-rgb) / <alpha-value>)',
          focus: 'rgb(var(--lyra-blue-focus-rgb) / <alpha-value>)',
          tint: 'rgb(var(--lyra-blue-tint-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        panel: '0.75rem',
        cell: '0.5rem',
      },
      fontFamily: {
        // Apple-native UI face first (San Francisco on Safari/iOS/macOS) for a consistent, premium
        // system look; the rest are graceful fallbacks on other platforms.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        // Apple's SF Mono first so tabular/terminal text stays crisp and on-brand, not Consolas.
        mono: ['ui-monospace', 'SF Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
