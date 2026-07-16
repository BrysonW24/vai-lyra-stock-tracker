import { FlatCompat } from '@eslint/eslintrc';

// ESLint 9 flat config. `next lint` is deprecated (removed in Next 16), so the
// `lint` script runs `eslint .` directly against this file. Rules come from the
// official Next.js presets (core-web-vitals + typescript).
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next*/**', // .next plus isolated build dirs like .next-verify
      '.venv/**',
      'out/**',
      'coverage/**',
      'src/lib/generated/**', // compiled from content/*.jsonl - never hand-edited
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Strict-mode posture: an `any` needs an inline justification, same as @ts-expect-error.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': false },
      ],
      // Unused code is an error here, not a warning - dead imports/locals rot fast.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // CommonJS config/scripts (next.config.js, tooling) legitimately use require().
    files: ['**/*.js', '**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];

export default config;
