export interface WelcomeEntry {
  href: string;
  label: string;
}

/**
 * Choose the honest front-door action. Solo visitors set up once; the completion cookie then
 * turns the welcome CTA into a direct console entry instead of restarting onboarding.
 */
export function getWelcomeEntry(supabaseConfigured: boolean, soloOnboarded: boolean): WelcomeEntry {
  if (supabaseConfigured) return { href: '/auth/signup', label: 'Create account' };
  if (soloOnboarded) return { href: '/', label: 'Open my console' };
  return { href: '/onboarding', label: 'Enter my console' };
}
