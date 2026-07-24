import { describe, expect, it } from 'vitest';
import { getWelcomeEntry } from '@/lib/welcome-entry';

describe('getWelcomeEntry', () => {
  it('starts onboarding for a first-time Solo visitor', () => {
    expect(getWelcomeEntry(false, false)).toEqual({
      href: '/onboarding',
      label: 'Enter my console',
    });
  });

  it('sends a returning Solo visitor straight to the console', () => {
    expect(getWelcomeEntry(false, true)).toEqual({
      href: '/',
      label: 'Open my console',
    });
  });

  it('keeps the community account entry when Supabase is configured', () => {
    expect(getWelcomeEntry(true, false)).toEqual({
      href: '/auth/signup',
      label: 'Create account',
    });
  });
});
