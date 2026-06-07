'use client';

import { ActivationSequence } from '@/components/activation/ActivationSequence';

/**
 * Signal Calibration Activation Page
 *
 * Route: /onboarding/activation
 *
 * A short cinematic primer (~10-14s) shown after onboarding and before the dashboard.
 * Full-screen, dark glassmorphism stock console aesthetic.
 * Respects prefers-reduced-motion for accessibility.
 *
 * Four scenes:
 * 1. Choose your market (~2.8s)
 * 2. Read the momentum (~3.8s)
 * 3. Act from the console (~3.2s)
 * 4. Command Centre Ready (final, CTAs)
 *
 * Auto-advances with scene wipes; Skip button available (top-right).
 * On final screen: "Enter Command Centre" → push('/'), "Replay" → restart.
 */
export default function ActivationPage() {
  return <ActivationSequence />;
}
