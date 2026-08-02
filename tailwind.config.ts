import type { Config } from 'tailwindcss';

/*
 * Tailwind mirror of the LYRA DESIGN TOKENS - v1.0.0 (2026-08-02).
 * Source of truth: lyra-ux/TOKENS.md + src/styles/lyra-tokens.css (same version).
 * Hex values are duplicated here (not var() references) so Tailwind opacity modifiers
 * like `bg-panel/60` keep working; `node lyra-ux/check-tokens.mjs` enforces the mirror.
 * The pre-2026-08-02 "warm paper" palette (cream/paper/light-ink/cobalt/mint/slate) was
 * dead code with zero usages and was removed at v1.0.0.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#07090c',
        chrome: '#0b1016',
        panel: { DEFAULT: '#0d141c', deep: '#0d1117' },
        well: '#0a0e13',
        line: { DEFAULT: '#1b2530', strong: '#263241', hair: '#3a4754' },
        ink: {
          DEFAULT: '#eef3f8',
          title: '#dbe5ee',
          '2': '#a8b5c2',
          '3': '#8190a0',
          dim: '#5e6b78',
        },
        accent: { DEFAULT: '#f3a33a', border: '#9a6a1f', tint: '#2a1f0f' },
        positive: { DEFAULT: '#43d18b', tint: '#0d251b' },
        negative: { DEFAULT: '#ff6b6b', soft: '#f0758a' },
        pending: '#8aa2ff',
        blue: {
          DEFAULT: '#1e63ff',
          deep: '#3b5bdb',
          info: '#7fb0ff',
          focus: '#60a5fa',
          tint: '#0e1e3a',
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
