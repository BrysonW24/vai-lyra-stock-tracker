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
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
