import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
