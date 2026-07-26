import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldShowSoloUpgradeCta, soloUpgradeCtaEnabled } from '@/lib/flags';

describe('feature control: solo -> account upgrade CTA', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is OFF by default (no env set) - ships dark', () => {
    vi.stubEnv('NEXT_PUBLIC_SOLO_UPGRADE_CTA', '');
    expect(soloUpgradeCtaEnabled()).toBe(false);
  });

  it('arms ONLY on the exact opt-in value "1"', () => {
    vi.stubEnv('NEXT_PUBLIC_SOLO_UPGRADE_CTA', '1');
    expect(soloUpgradeCtaEnabled()).toBe(true);
    // Anything else is treated as off, so a stray/typo'd value can never accidentally arm it.
    for (const v of ['true', '0', 'yes', 'on', ' 1']) {
      vi.stubEnv('NEXT_PUBLIC_SOLO_UPGRADE_CTA', v);
      expect(soloUpgradeCtaEnabled()).toBe(false);
    }
  });

  it('shows only in Solo mode AND when armed', () => {
    // Solo but not armed -> dark (the default state this release ships in).
    expect(shouldShowSoloUpgradeCta(false, false)).toBe(false);
    // Solo AND armed -> show.
    expect(shouldShowSoloUpgradeCta(false, true)).toBe(true);
    // The accounted build never shows it - it already has accounts - armed or not.
    expect(shouldShowSoloUpgradeCta(true, true)).toBe(false);
    expect(shouldShowSoloUpgradeCta(true, false)).toBe(false);
  });
});
