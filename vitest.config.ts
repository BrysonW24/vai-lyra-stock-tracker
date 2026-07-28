import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // JSX transform for component render tests (.tsx, via @testing-library/react). The node .ts tests
  // that make up the bulk of the suite are unaffected - only files containing JSX are transformed.
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    // The content/AI module graph is heavy to cold-import; under parallel workers a test's first
    // await can exceed the 5s default while imports resolve (the tests themselves run in <5s in
    // isolation). Give headroom so import contention does not flake the suite.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
