import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f7f1e8',
        paper: '#fffaf2',
        ink: '#201f1b',
        muted: '#736f66',
        line: '#e8dece',
        amber: '#f07c2b',
        cobalt: '#2764c7',
        mint: '#2e9b73',
        slate: '#2b3137',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(44, 38, 28, 0.10)',
        insetGlass: 'inset 0 1px 0 rgba(255,255,255,0.72)',
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
